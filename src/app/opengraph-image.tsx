import { ImageResponse } from 'next/og';

// Was attempted as region-aware via headers() — that's not actually
// supported here. Per Next.js's own docs (node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/01-metadata/
// opengraph-image.md), this special file's default export only ever
// receives a `params` prop; there's no request context available for
// headers()/cookies() the way a normal Server Component gets one.
// Calling headers() here threw on every request, returning a 500 for
// any shared link. Static (not region-specific), but the background
// gradient now runs through every province's brand color from
// src/config/regions.ts (BC → Alberta → Saskatchewan → Manitoba,
// primary + accent each, west to east) so a single shared image still
// visually represents all four regions rather than one neutral scheme.
// A dark overlay sits between the gradient and the text/logo so white
// text stays readable regardless of which color falls behind it.
export const alt = 'Western Canada News Feed — regional Canadian news, all in one place';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            'linear-gradient(135deg, #003087 0%, #fcb514 14%, #0b3d91 29%, #f2b705 43%, #1b5e3f 57%, #d4a72c 71%, #a6192e 86%, #e8d9be 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
        }}
      >
        {/* Darkens the busy multi-color gradient so the white headline
            stays legible no matter which province's color lands behind
            it — without this, light stops like the gold/cream accents
            wash the text out. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(10,8,6,0.6) 0%, rgba(10,8,6,0.35) 50%, rgba(10,8,6,0.6) 100%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'relative',
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
      </div>
    ),
    { ...size }
  );
}
