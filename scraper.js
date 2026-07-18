require('dotenv').config({ path: '.env.local' });
const https = require('https');
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const SOURCES_BY_REGION = require('./src/config/scraper-sources.json');

const parser = new Parser();

// This uses the SECRET key (not the publishable one) because this script
// runs on your machine/server, not in a user's browser, and needs permission
// to write to the database, bypassing Row Level Security.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Helper function to make native HTTPS GET requests with custom headers
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
      timeout: 10000 // 10 second safety cutoff
    };

    const req = https.request(options, (res) => {
      let data = '';

      // Handle server-side redirects gracefully.
      // Some servers send back a full address (https://example.com/feed),
      // others send back just a path (/feed) — resolving against the
      // original URL handles both cases correctly.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return fetchFeed(redirectUrl).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP Status ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request Timeout'));
    });

    req.end();
  });
}

// Try a few common places RSS feeds hide a thumbnail image
function extractThumbnail(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;

  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }

  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }

  // Fall back: look for the first <img> tag inside the article's HTML content
  const html = item['content:encoded'] || item.content || '';
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  if (match) return match[1];

  return null; // no thumbnail found — that's fine, the UI just won't show one
}

/**
 * Main function to sync every region's feeds. Mirrors the region tagging
 * and per-region dedup that src/app/api/scrape/route.js does for the
 * hourly cron sync — this script is just the manual/local equivalent,
 * sharing the same source-of-truth source list
 * (src/config/scraper-sources.json) so the two never drift apart.
 */
async function syncMasterFeeds() {
  console.log("=== Starting WCNewsFeed Master Sync (all regions, long-term feed mode) ===");
  let successfulSyncs = 0;

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

  const totalFeeds = jobs.length;

  for (const job of jobs) {
    try {
      console.log(`Syncing [${job.region}]: ${job.name}...`);

      const xmlData = await fetchFeed(job.url);

      // --- PARSING STAGE ---
      const feed = await parser.parseString(xmlData);

      let items = feed.items.map((item) => ({
        title: item.title || 'Untitled',
        url: item.link,
        source_name: job.name,
        region: job.region,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        image_url: extractThumbnail(item),
        guid: item.guid || item.link, // used to avoid inserting the same article twice
      }));

      if (job.requiresKeywordFilter && job.keywordFilterRegex) {
        const re = new RegExp(job.keywordFilterRegex, 'i');
        items = items.filter((item) => re.test(item.title));
      }

      // --- DATABASE SAVE STAGE ---
      // upsert = insert new rows, but if a row with the same `url` already
      // exists, update it instead of creating a duplicate. This is what lets
      // you safely re-run this script on a schedule.
      const { error } = await supabase
        .from('articles')
        .upsert(items, { onConflict: 'url' });

      if (error) throw error;

      console.log(`  ✓ Successfully synced ${job.name} (${items.length} articles).`);
      successfulSyncs++;

    } catch (error) {
      console.log(`  ✕ Skipped ${job.name} (Error: ${error.message})`);
    }
  }

  console.log(`=== Sync Complete! Successfully compiled ${successfulSyncs}/${totalFeeds} sources across all regions. ===`);
}

// Fire the runner
syncMasterFeeds();
