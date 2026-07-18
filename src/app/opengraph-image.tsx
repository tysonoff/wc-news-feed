import { ImageResponse } from 'next/og';

// Was attempted as region-aware via headers() — that's not actually
// supported here. Per Next.js's own docs (node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/01-metadata/
// opengraph-image.md), this special file's default export only ever
// receives a `params` prop; there's no request context available for
// headers()/cookies() the way a normal Server Component gets one.
// Calling headers() here threw on every request, returning a 500 for
// any shared link. Reverted to static — the neutral charcoal/gold
// "network" gradient from icon.svg (tried running the gradient through
// all four provinces' brand colors instead, but the original read
// better and is what shipped). Text treatment redesigned to a
// left-aligned editorial masthead — small uppercase eyebrow, big bold
// wordmark, thin accent rule, province list below — instead of the
// old centered logo-plus-tagline layout.
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
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 100px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#d1a54a',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
              display: 'flex',
            }}
          >
            Western Canada
          </div>
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.05,
            marginTop: 24,
            display: 'flex',
          }}
        >
          News Feed
        </div>
        <div
          style={{
            width: 120,
            height: 6,
            borderRadius: 3,
            background: '#d1a54a',
            marginTop: 36,
            marginBottom: 30,
            display: 'flex',
          }}
        />
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.82)',
            display: 'flex',
          }}
        >
          Alberta &middot; Saskatchewan &middot; Manitoba &middot; British Columbia
        </div>
      </div>
    ),
    { ...size }
  );
}
