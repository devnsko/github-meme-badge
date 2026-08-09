import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#171412';

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
          background: '#fffdf5',
          color: INK,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '10px 26px',
            marginBottom: 40,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 2,
            background: '#ffb3c7',
            border: `5px solid ${INK}`,
            borderRadius: 999,
            boxShadow: `9px 9px 0 ${INK}`,
            transform: 'rotate(-2deg)',
          }}
        >
          STICKERS FOR YOUR README
        </div>
        <div style={{ display: 'flex', fontSize: 82, fontWeight: 800, lineHeight: 1.1 }}>
          Your GitHub stats,
        </div>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            marginTop: 12,
            padding: '6px 22px',
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 1.1,
            background: '#ffd93d',
            border: `5px solid ${INK}`,
            borderRadius: 20,
            boxShadow: `9px 9px 0 ${INK}`,
            transform: 'rotate(-1deg)',
          }}
        >
          with a punchline
        </div>
      </div>
    ),
    size,
  );
}
