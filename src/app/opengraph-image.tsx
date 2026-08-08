import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#0a0c10',
          color: '#e6edf3',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, color: '#3fb950', letterSpacing: 2 }}>
          SVG BADGES FOR YOUR README
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
          Your GitHub stats,
        </div>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, color: '#58a6ff', lineHeight: 1.1 }}>
          with a punchline
        </div>
        <div style={{ display: 'flex', marginTop: 32, fontSize: 30, color: '#9099a8' }}>
          {site.name}
        </div>
      </div>
    ),
    size,
  );
}
