import type { GitHubStats } from './github';
import { buildMeme } from './meme';
import { scoreProfile, type ProfileScore } from './scoring';
import { formatCount, measureText, truncate, wrapText } from './text';

export const THEMES = ['dark', 'light', 'auto'] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: string | null | undefined): value is Theme {
  return !!value && (THEMES as readonly string[]).includes(value);
}

/**
 * Colour roles. Each one doubles as a CSS class so the `auto` theme can
 * override it from a media query.
 */
type Role = 'bg' | 'bd' | 'tx' | 'mu' | 'ac' | 'acBg' | 'pill' | 'pillTx';
type Palette = Record<Role, string>;

const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: '#0d1117',
    bd: '#30363d',
    tx: '#e6edf3',
    mu: '#8b949e',
    ac: '#3fb950',
    acBg: '#12261a',
    pill: '#21262d',
    pillTx: '#79c0ff',
  },
  light: {
    bg: '#ffffff',
    bd: '#d0d7de',
    tx: '#1f2328',
    mu: '#59636e',
    ac: '#1a7f37',
    acBg: '#dafbe1',
    pill: '#f0f3f6',
    pillTx: '#0969da',
  },
};

const WIDTH = 480;
const PADDING = 22;
const INNER = WIDTH - PADDING * 2;
const AVATAR = 52;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Every value that reaches the SVG comes from the GitHub API or the request, so
 * it is escaped here. An unescaped `<` in a display name would otherwise let a
 * profile inject markup into an image served from our own origin.
 */
export function escapeXml(value: string): string {
  return value
    // Control characters are not legal in XML 1.0 and break strict parsers.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

/** Only ever emit an href we produced ourselves. */
function safeDataUri(value: string | null): string | null {
  return value && /^data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}

/**
 * Colours are written as literal presentation attributes rather than CSS
 * custom properties: `var()` is a browser-only feature, and the badge also has
 * to survive rasterisers such as librsvg and resvg, which render an unresolved
 * `var()` as black.
 *
 * `auto` layers a `prefers-color-scheme` rule on top. Any CSS declaration wins
 * over a presentation attribute, so browsers switch to light while renderers
 * that ignore the rule keep the dark defaults.
 */
function paint(palette: Palette, fill: Role, stroke?: Role): string {
  const classes = stroke ? `${fill} ${stroke}` : fill;
  const strokeAttr = stroke ? ` stroke="${palette[stroke]}"` : '';
  return ` fill="${palette[fill]}"${strokeAttr} class="${classes}"`;
}

function autoThemeStyle(): string {
  const light = PALETTES.light;
  const fills = (Object.keys(light) as Role[])
    .filter((role) => role !== 'bd')
    .map((role) => `.${role}{fill:${light[role]}}`)
    .join('');

  return `<style>@media (prefers-color-scheme:light){${fills}.bd{stroke:${light.bd}}}</style>`;
}

function textNode(
  content: string,
  opts: {
    x: number;
    y: number;
    size: number;
    role: Role;
    palette: Palette;
    bold?: boolean;
    anchor?: string;
  },
): string {
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : '';
  const weight = opts.bold ? ' font-weight="600"' : '';
  const x = Number(opts.x.toFixed(2));
  return `<text x="${x}" y="${opts.y}" font-size="${opts.size}"${paint(opts.palette, opts.role)}${weight}${anchor}>${escapeXml(content)}</text>`;
}

function avatarNode(stats: GitHubStats, palette: Palette, x: number, y: number): string {
  const href = safeDataUri(stats.avatarDataUri);
  const r = AVATAR / 2;
  const ring = `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="none" stroke="${palette.bd}" stroke-width="1" class="bd"/>`;

  if (href) {
    return [
      `<clipPath id="avatar"><circle cx="${x + r}" cy="${y + r}" r="${r}"/></clipPath>`,
      `<image href="${href}" x="${x}" y="${y}" width="${AVATAR}" height="${AVATAR}" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice"/>`,
      ring,
    ].join('');
  }

  const initial = stats.displayName.trim().charAt(0).toUpperCase() || '?';
  return [
    `<circle cx="${x + r}" cy="${y + r}" r="${r}"${paint(palette, 'pill')}/>`,
    textNode(initial, {
      x: x + r,
      y: y + r + 7,
      size: 22,
      role: 'pillTx',
      palette,
      bold: true,
      anchor: 'middle',
    }),
    ring,
  ].join('');
}

/** Rounded tag. `align: 'right'` anchors it to `x` as a right edge instead. */
function pillNode(
  label: string,
  palette: Palette,
  opts: {
    x: number;
    y: number;
    bg: Role;
    fg: Role;
    size?: number;
    maxWidth?: number;
    align?: 'left' | 'right';
  },
): string {
  const size = opts.size ?? 11.5;
  const text = truncate(label, opts.maxWidth ?? 110, size);
  // A one-letter language such as "C" would otherwise collapse into a dot.
  const width = Number(Math.max(measureText(text, size, true) + 22, 54).toFixed(1));
  const height = Math.round(size * 1.9);
  const x = Number((opts.align === 'right' ? opts.x - width : opts.x).toFixed(1));

  return [
    `<rect x="${x}" y="${opts.y}" width="${width}" height="${height}" rx="${height / 2}"${paint(palette, opts.bg)}/>`,
    textNode(text, {
      x: x + width / 2,
      y: opts.y + height / 2 + size * 0.36,
      size,
      role: opts.fg,
      palette,
      bold: true,
      anchor: 'middle',
    }),
  ].join('');
}

function statsRow(stats: GitHubStats, palette: Palette, y: number): string {
  const columns: Array<[string, string]> = [
    [formatCount(stats.publicRepos), 'repos'],
    [`${formatCount(stats.stars)}${stats.truncated ? '+' : ''}`, 'stars'],
    [`${formatCount(stats.forks)}${stats.truncated ? '+' : ''}`, 'forks'],
    [formatCount(stats.followers), 'followers'],
  ];

  const columnWidth = INNER / columns.length;

  return columns
    .map(([value, label], i) => {
      const centre = PADDING + columnWidth * i + columnWidth / 2;
      return [
        textNode(value, { x: centre, y, size: 16, role: 'tx', palette, bold: true, anchor: 'middle' }),
        textNode(label, { x: centre, y: y + 15, size: 10, role: 'mu', palette, anchor: 'middle' }),
      ].join('');
    })
    .join('');
}

function document(height: number, theme: Theme, title: string, palette: Palette, body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="badge-title">`,
    `<title id="badge-title">${escapeXml(title)}</title>`,
    theme === 'auto' ? autoThemeStyle() : '',
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="12"${paint(palette, 'bg', 'bd')}/>`,
    // font-family inherits, so it is declared once rather than per node.
    `<g font-family="${FONT}">${body}</g>`,
    '</svg>',
  ].join('');
}

export function renderBadge(
  stats: GitHubStats,
  theme: Theme = 'dark',
  score: ProfileScore = scoreProfile(stats),
): string {
  // `auto` renders dark by default and lets the media query swap it.
  const palette = PALETTES[theme === 'light' ? 'light' : 'dark'];
  const meme = buildMeme(stats, score);

  const nameWidth = INNER - AVATAR - 16 - 130;
  const name = truncate(stats.displayName, nameWidth, 17);
  const handle = truncate(`@${stats.username}`, nameWidth, 12.5);

  const taglineLines = wrapText(meme.tagline, INNER, 14, 2);
  const punchlineLines = wrapText(meme.punchline, INNER, 13, 2);

  const parts: string[] = [
    avatarNode(stats, palette, PADDING, PADDING),
    textNode(name, { x: PADDING + AVATAR + 14, y: PADDING + 22, size: 17, role: 'tx', palette, bold: true }),
    textNode(handle, { x: PADDING + AVATAR + 14, y: PADDING + 41, size: 12.5, role: 'mu', palette }),
    // The earned title is the headline of the card, so it gets the accent.
    pillNode(meme.title, palette, {
      x: PADDING,
      y: PADDING + AVATAR + 12,
      bg: 'acBg',
      fg: 'ac',
      size: 12.5,
      maxWidth: INNER - 20,
    }),
  ];

  if (stats.topLanguage) {
    parts.push(
      pillNode(stats.topLanguage, palette, {
        x: WIDTH - PADDING,
        y: PADDING + 15,
        bg: 'pill',
        fg: 'pillTx',
        align: 'right',
      }),
    );
  }

  let y = PADDING + AVATAR + 12 + 24 + 24;
  for (const line of taglineLines) {
    parts.push(textNode(line, { x: PADDING, y, size: 14, role: 'tx', palette, bold: true }));
    y += 19;
  }

  y += 3;
  for (const line of punchlineLines) {
    parts.push(textNode(line, { x: PADDING, y, size: 13, role: 'mu', palette }));
    y += 18;
  }

  y += 10;
  parts.push(
    `<line x1="${PADDING}" y1="${y}" x2="${WIDTH - PADDING}" y2="${y}" stroke="${palette.bd}" class="bd"/>`,
  );

  y += 24;
  parts.push(statsRow(stats, palette, y));

  const height = Math.round(y + 15 + PADDING);
  return document(height, theme, `${stats.displayName}'s GitHub meme badge`, palette, parts.join(''));
}

/**
 * Errors are rendered as a badge too: the endpoint is consumed as an image, so
 * a JSON body would show up as a broken-image icon with no explanation.
 */
export function renderErrorBadge(message: string, theme: Theme = 'dark'): string {
  const palette = PALETTES[theme === 'light' ? 'light' : 'dark'];
  const height = 96;

  const parts = [
    textNode('Badge unavailable', { x: PADDING, y: 34, size: 15, role: 'tx', palette, bold: true }),
    ...wrapText(message, INNER, 13, 2).map((line, i) =>
      textNode(line, { x: PADDING, y: 58 + i * 17, size: 13, role: 'mu', palette }),
    ),
  ];

  return document(height, theme, `GitHub meme badge error: ${message}`, palette, parts.join(''));
}
