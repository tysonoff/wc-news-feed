import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { getRegionBySlug } from '@/config/regions';

// Can't be region-specific itself — Next.js requires this as a static
// string — but the generated image below is fully dynamic, so this is
// just a reasonable fallback description for accessibility / when the
// image fails to load.
export const alt = 'Western Canada News Feed — regional Canadian news, all in one place';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // Region-aware — unlike the favicon (see icon.svg's comment on why
  // that one stays static), this image is generated fresh every time a
  // link actually gets shared rather than being cached in the visitor's
  // own browser, so there's no risk of it looking "stuck" showing the
  // wrong region the way a per-region favicon could.
  const requestHeaders = await headers();
  const region = getRegionBySlug(requestHeaders.get('x-wc-region'));

  const tagline =
    region.slug === 'national'
      ? 'Live Canadian national news, all in one place'
      : `Live ${region.displayName} news, all in one place`;

  return new ImageResponse(
    (
      <div
        style={{
          // Two flat color stops rather than the original's 4-stop
          // darkened version — next/og's rendering engine (Satori) has a
          // more limited CSS feature set than a real browser, and a
          // plain two-color linear-gradient is safely within what it
          // supports.
          background: `linear-gradient(135deg, ${region.brandPrimaryColor} 0%, ${region.brandAccentColor} 100%)`,
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
              background: region.brandPrimaryColor,
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
                background: region.brandAccentColor,
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
                background: region.brandAccentColor,
                position: 'absolute',
                bottom: 40,
                left: 32,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 76, fontWeight: 800, color: 'white' }}>{region.displayName} News Feed</div>
            <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.85)' }}>{tagline}</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
