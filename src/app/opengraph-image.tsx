import { ImageResponse } from 'next/og';

// Was attempted as region-aware via headers() — that's not actually
// supported here. Per Next.js's own docs (node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/01-metadata/
// opengraph-image.md), this special file's default export only ever
// receives a `params` prop; there's no request context available for
// headers()/cookies() the way a normal Server Component gets one.
// Calling headers() here threw on every request, returning a 500 for
// any shared link. Reverted to static — same neutral "network" colors
// as icon.svg, and still fixes the real bug (this previously said
// "Sask News Feed" unconditionally, regardless of which region's page
// got shared).
export const alt = 'Western Canada News Feed — regional Canadian news, all in one place';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b18 0%, #3a322b 45%, #d1a54a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 32,
              background: '#1e1b18',
              border: '4px solid rgba(255, 255, 255, 0.35)',
              display: 'flex',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: '#d1a54a',
                position: 'absolute',
                top: 36,
                left: 52,
              }}
            />
            <div
              style={{
                width: 96,
                height: 10,
                borderRadius: 5,
                background: '#d1a54a',
                position: 'absolute',
                bottom: 40,
                left: 32,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 68, fontWeight: 800, color: 'white' }}>Western Canada News Feed</div>
            <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.85)' }}>
              Alberta, Saskatchewan, Manitoba &amp; British Columbia — all in one place
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
