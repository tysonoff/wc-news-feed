import { NextResponse } from 'next/server';
import https from 'https';
import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';
import SOURCES_BY_REGION from '@/config/scraper-sources.json';

// Allow this function extra time to finish, since it fetches many feeds
// across every region.
export const maxDuration = 60;

const parser = new Parser();

function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';

      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return fetchFeed(redirectUrl).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP Status ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request Timeout'));
    });

    req.end();
  });
}

// A thumbnail URL that isn't HTTPS will silently fail to load, since our
// site is entirely HTTPS — the browser tries to "upgrade" the request,
// and if the source server never actually turned on HTTPS for that path,
// the image just breaks with no visible error. Treating it as "no
// thumbnail" is safer than showing a broken image icon.
function toSafeImageUrl(url) {
  if (!url || !url.startsWith('https://')) return null;
  return url;
}

function extractThumbnail(item) {
  if (item.enclosure && item.enclosure.url) return toSafeImageUrl(item.enclosure.url);

  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return toSafeImageUrl(item['media:content'].$.url);
  }

  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    return toSafeImageUrl(item['media:thumbnail'].$.url);
  }

  const html = item['content:encoded'] || item.content || '';
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  if (match) return toSafeImageUrl(match[1]);

  return null;
}

async function fetchViaProxy(url) {
  // A third-party service fetches the feed on our behalf, from a different
  // set of servers than Vercel's. Some sites that block Vercel directly
  // don't block this proxy, so it's worth trying as a fallback.
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  const data = await response.json();

  if (data.status !== 'ok') {
    throw new Error('Proxy fetch also failed: ' + (data.message || 'unknown error'));
  }

  return data.items.map((item) => ({
    title: item.title || 'Untitled',
    url: item.link,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    image_url: toSafeImageUrl(item.thumbnail || (item.enclosure && item.enclosure.link)),
    guid: item.guid || item.link,
  }));
}

async function syncFeed(name, url, region, requiresKeywordFilter, keywordFilterRegex, supabase) {
  let items;

  try {
    // Try fetching directly first — this works for most feeds and doesn't
    // depend on any third-party service being available.
    const xmlData = await fetchFeed(url);
    const feed = await parser.parseString(xmlData);

    items = feed.items.map((item) => ({
      title: item.title || 'Untitled',
      url: item.link,
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      image_url: extractThumbnail(item),
      guid: item.guid || item.link,
    }));
  } catch {
    // Direct fetch failed (often bot-protection). Try the proxy fallback
    // before giving up on this feed entirely.
    items = await fetchViaProxy(url);
  }

  // Sources flagged requiresKeywordFilter mix syndicated national/wire
  // content in with genuinely local stories (Pattison Media's "NOW"
  // network and similar sister-station setups) — filter those down to
  // headlines that actually mention this region.
  if (requiresKeywordFilter && keywordFilterRegex) {
    const re = new RegExp(keywordFilterRegex, 'i');
    items = items.filter((item) => re.test(item.title));
  }

  const rows = items.map((item) => ({ ...item, source_name: name, region }));

  // Even genuinely local stories sometimes get picked up identically by
  // more than one sister site. This is a backup safety net on top of the
  // keyword filter above — skip anything whose exact headline already
  // exists under a DIFFERENT url WITHIN THE SAME REGION (a real
  // cross-source duplicate). This is scoped per-region on purpose: the
  // same national story legitimately appearing under, say, both Alberta
  // and Saskatchewan is not a duplicate — dropping it there was a real
  // bug in the single-region version this app started from. If the url
  // matches, it's just this same article being normally re-synced, not a
  // duplicate — that has to be allowed through every time, since every
  // hourly sync naturally re-fetches articles it already has.
  const titles = rows.map((r) => r.title);
  const { data: existing } = await supabase
    .from('articles')
    .select('title, url')
    .eq('region', region)
    .in('title', titles);

  const existingUrlByTitle = new Map((existing ?? []).map((a) => [a.title, a.url]));
  const dedupedRows = rows.filter((r) => {
    const existingUrl = existingUrlByTitle.get(r.title);
    return existingUrl === undefined || existingUrl === r.url;
  });

  const { error } = await supabase
    .from('articles')
    .upsert(dedupedRows, { onConflict: 'url' });

  if (error) throw error;
  return dedupedRows.length;
}

export async function GET(request) {
  // Check the secret password before doing anything, so random visitors
  // can't trigger your scraper (or see whether it succeeded/failed).
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );

  // Flatten every region's source list into one job list, each job
  // carrying its own region tag — this is what "scraper reorganized by
  // region" actually means at sync time: one flat fetch pass, but every
  // article gets stamped with the region it belongs to on the way in.
  const jobs = Object.entries(SOURCES_BY_REGION).flatMap(([region, config]) => {
    if (region.startsWith('_') || !config.sources) return [];
    return config.sources.map((source) => ({
      region,
      name: source.name,
      url: source.url,
      requiresKeywordFilter: Boolean(source.requiresKeywordFilter),
      keywordFilterRegex: config.keywordFilter,
    }));
  });

  // Fetch all feeds at the same time instead of one-by-one — much faster,
  // and keeps us safely under Vercel's time limit for this function.
  const results = await Promise.allSettled(
    jobs.map((job) =>
      syncFeed(job.name, job.url, job.region, job.requiresKeywordFilter, job.keywordFilterRegex, supabase)
    )
  );

  const summary = jobs.map((job, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      return { name: job.name, region: job.region, status: 'success', articles: result.value };
    }
    return { name: job.name, region: job.region, status: 'failed', error: result.reason.message };
  });

  const successCount = summary.filter((s) => s.status === 'success').length;

  // Clean up old articles — nothing in the main feed needs anything older
  // than 30 days, and this keeps the database from growing forever. No
  // exceptions needed: saved articles keep their own permanent copy of
  // the details, so this cleanup doesn't affect anyone's saved list.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError, count: deletedCount } = await supabase
    .from('articles')
    .delete({ count: 'exact' })
    .lt('published_at', thirtyDaysAgo);

  // Sweep up any duplicate headlines that slipped through despite the
  // pre-sync check — this can happen when two sources sync the exact
  // same story at nearly the same moment (a timing race, not a logic
  // gap). Scoped per-region, same reasoning as the pre-sync check above:
  // grouping by region here (not globally) is what stops a legitimate
  // national story from getting wiped out of every province but one.
  // Keeps the earliest copy of each title *within its region*, removes
  // the rest.
  const { data: allArticles } = await supabase
    .from('articles')
    .select('id, region, title, created_at')
    .order('created_at', { ascending: true });

  const seenTitlesByRegion = new Map(); // region -> Set(title)
  const duplicateIds = [];
  for (const row of allArticles ?? []) {
    let seenTitles = seenTitlesByRegion.get(row.region);
    if (!seenTitles) {
      seenTitles = new Set();
      seenTitlesByRegion.set(row.region, seenTitles);
    }
    if (seenTitles.has(row.title)) {
      duplicateIds.push(row.id);
    } else {
      seenTitles.add(row.title);
    }
  }

  let duplicatesRemoved = 0;
  if (duplicateIds.length > 0) {
    const { count } = await supabase
      .from('articles')
      .delete({ count: 'exact' })
      .in('id', duplicateIds);
    duplicatesRemoved = count ?? 0;
  }

  return NextResponse.json({
    message: `Synced ${successCount}/${jobs.length} feeds across ${Object.keys(SOURCES_BY_REGION).filter((r) => !r.startsWith('_')).length} regions`,
    summary,
    cleanup: cleanupError
      ? { status: 'failed', error: cleanupError.message }
      : { status: 'success', deleted: deletedCount },
    duplicateCleanup: { status: 'success', removed: duplicatesRemoved },
  });
}
