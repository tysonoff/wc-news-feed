import { ImageResponse } from 'next/og';

export const alt = 'Sask News Feed — Saskatchewan news, all in one place';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0d3b26 0%, #1b5e3f 40%, #4a3d1a 70%, #8a6a1f 100%)',
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
              background: '#1b5e3f',
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
                background: '#d4a72c',
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
                background: '#d4a72c',
                position: 'absolute',
                bottom: 40,
                left: 32,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 76, fontWeight: 800, color: 'white' }}>Sask News Feed</div>
            <div style={{ fontSize: 32, color: '#e8dcc0' }}>Saskatchewan news, all in one place</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}