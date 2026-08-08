import { describe, expect, it } from 'vitest';
import { escapeXml, isTheme, renderBadge, renderErrorBadge } from './badge';
import { makeStats } from './__fixtures__/stats';
import { TITLES } from './copy';
import { buildMeme } from './meme';
import { scoreProfile } from './scoring';

const stats = makeStats;

describe('escapeXml', () => {
  it('escapes every XML-significant character', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;');
  });

  it('strips control characters that would break the document', () => {
    expect(escapeXml('a\u0007b\u001fc')).toBe('abc');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeXml('Ada Lovelace 1843')).toBe('Ada Lovelace 1843');
  });
});

describe('renderBadge', () => {
  it('produces a well-formed, self-contained SVG', () => {
    const svg = renderBadge(stats());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 480');
    // No external fetches: README proxies would drop them. The SVG namespace
    // declaration is the one permitted URL.
    expect(svg.replace(/xmlns="[^"]*"/g, '')).not.toMatch(/https?:\/\//);
  });

  it('escapes hostile profile fields instead of emitting markup', () => {
    const svg = renderBadge(
      stats({ displayName: '<script>alert(1)</script>', topLanguage: '"><script>x</script>' }),
    );
    expect(svg).not.toContain('<script');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('rejects an avatar that is not a base64 image data URI', () => {
    const svg = renderBadge(stats({ avatarDataUri: 'javascript:alert(1)' }));
    expect(svg).not.toContain('javascript:');
    expect(svg).not.toContain('<image');
  });

  it('embeds an avatar that is a valid data URI', () => {
    const svg = renderBadge(stats({ avatarDataUri: 'data:image/png;base64,aGVsbG8=' }));
    expect(svg).toContain('<image href="data:image/png;base64,aGVsbG8="');
  });

  it('renders the same badge for the same user', () => {
    expect(renderBadge(stats())).toBe(renderBadge(stats()));
  });

  it('varies the copy between users', () => {
    const a = renderBadge(stats({ username: 'octocat' }));
    const b = renderBadge(stats({ username: 'defunkt' }));
    expect(a).not.toBe(b);
  });

  it('formats large counts compactly', () => {
    expect(renderBadge(stats())).toContain('>12k<');
  });

  it('marks sampled totals as a lower bound', () => {
    expect(renderBadge(stats({ truncated: true }))).toContain('>421+<');
  });

  it('paints each theme with literal colours', () => {
    expect(renderBadge(stats(), 'dark')).toContain('fill="#0d1117"');
    expect(renderBadge(stats(), 'light')).toContain('fill="#ffffff"');
  });

  it('never emits a CSS custom property', () => {
    // `var()` renders as black in librsvg/resvg, which some README and unfurl
    // pipelines use instead of a browser.
    for (const theme of ['dark', 'light', 'auto'] as const) {
      expect(renderBadge(stats(), theme)).not.toContain('var(--');
    }
  });

  it('ships auto as dark plus a light media query', () => {
    const svg = renderBadge(stats(), 'auto');
    // Renderers that ignore the media query must still get a readable badge.
    expect(svg).toContain('fill="#0d1117"');
    expect(svg).toContain('@media (prefers-color-scheme:light)');
    expect(svg).toContain('.tx{fill:#1f2328}');
  });

  it('renders the earned title on the card', () => {
    const fixture = stats();
    const score = scoreProfile(fixture);
    const { title } = buildMeme(fixture, score);

    const svg = renderBadge(fixture, 'dark', score);
    expect(svg).toContain(`>${title}<`);
    // The title pill carries the accent colour, not the tagline.
    expect(svg).toContain('fill="#12261a"');
  });

  it('gives a dormant account a dormant title', () => {
    const svg = renderBadge(stats({ daysSinceLastPush: 900 }));
    const dormant = [...TITLES.dormant.low, ...TITLES.dormant.mid, ...TITLES.dormant.high];
    expect(dormant.some((title) => svg.includes(`>${title}<`))).toBe(true);
  });

  it('grows to fit longer copy', () => {
    const height = (svg: string) => Number(svg.match(/height="(\d+)"/)![1]);
    expect(height(renderBadge(stats()))).toBeGreaterThan(150);
  });
});

describe('renderErrorBadge', () => {
  it('renders the message as an image rather than failing silently', () => {
    const svg = renderErrorBadge('No GitHub user called "nope".');
    expect(svg).toContain('Badge unavailable');
    expect(svg).toContain('&quot;nope&quot;');
  });
});

describe('isTheme', () => {
  it('accepts known themes only', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('auto')).toBe(true);
    expect(isTheme('neon')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});
