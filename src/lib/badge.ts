import type { GitHubStats } from './github';
import { buildMeme } from './meme';
import { scoreProfile, type ProfileScore } from './scoring';
import { formatCount, measureText, truncate, wrapText } from './text';

export const THEMES = ['light', 'dark', 'auto'] as const;
export type Theme = (typeof THEMES)[number];

/** Used by the renderer and by the route that parses `?theme=`. */
export const DEFAULT_THEME: Theme = 'light';

export function isTheme(value: string | null | undefined): value is Theme {
  return !!value && (THEMES as readonly string[]).includes(value);
}

/**
 * Colour roles. Each one doubles as a CSS class so the `auto` theme can
 * override it from a media query.
 *
 * The look is a paper sticker: a thick ink outline, a hard offset shadow with
 * no blur, and flat fills. Nothing here uses a filter or a gradient, so it
 * survives the non-browser rasterisers that render README images.
 */
type Role = 'bg' | 'ink' | 'sh' | 'tx' | 'mu' | 'ac' | 'acTx' | 'pill' | 'pillTx';
type Palette = Record<Role, string>;

const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#fffdf5',
    ink: '#171412',
    sh: '#171412',
    tx: '#171412',
    mu: '#6b625a',
    ac: '#ffd93d',
    acTx: '#171412',
    pill: '#8be0ff',
    pillTx: '#171412',
  },
  dark: {
    bg: '#2a2733',
    ink: '#0b0a0e',
    sh: '#0b0a0e',
    tx: '#fffdf5',
    mu: '#a79fb4',
    ac: '#ffd93d',
    acTx: '#171412',
    pill: '#8be0ff',
    pillTx: '#171412',
  },
};

const WIDTH = 480;
/** Hard shadow offset. The card is inset by this much so nothing is clipped. */
const SHADOW = 6;
const OUTLINE = 3;
const CARD_WIDTH = WIDTH - SHADOW;
const PADDING = 24;
const INNER = CARD_WIDTH - PADDING * 2;
const AVATAR = 54;
const CARD_RADIUS = 22;
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
 * `auto` layers a `prefers-color-scheme: dark` rule on top. Any CSS declaration
 * wins over a presentation attribute, so browsers switch to dark while
 * renderers that ignore the rule keep the light defaults.
 */
function paint(
  palette: Palette,
  opts: { fill?: Role | 'none'; stroke?: Role; strokeWidth?: number },
): string {
  const attrs: string[] = [];
  const classes: Role[] = [];

  if (opts.fill === 'none') {
    attrs.push('fill="none"');
  } else if (opts.fill) {
    attrs.push(`fill="${palette[opts.fill]}"`);
    classes.push(opts.fill);
  }

  if (opts.stroke) {
    attrs.push(`stroke="${palette[opts.stroke]}"`, `stroke-width="${opts.strokeWidth ?? OUTLINE}"`);
    classes.push(opts.stroke);
  }

  // One `class` attribute, always: emitting fill and stroke separately produced
  // two of them on outlined shapes, which is malformed XML. Browsers shrug it
  // off; librsvg rejects the whole document.
  if (classes.length) attrs.push(`class="${classes.join(' ')}"`);

  return ` ${attrs.join(' ')}`;
}

const fill = (palette: Palette, role: Role) => paint(palette, { fill: role });

function autoThemeStyle(): string {
  const dark = PALETTES.dark;
  const fills = (Object.keys(dark) as Role[])
    .filter((role) => role !== 'ink')
    .map((role) => `.${role}{fill:${dark[role]}}`)
    .join('');

  return `<style>@media (prefers-color-scheme:dark){${fills}.ink{stroke:${dark.ink}}}</style>`;
}

function textNode(
  content: string,
  opts: {
    x: number;
    y: number;
    size: number;
    role: Role;
    palette: Palette;
    weight?: number;
    anchor?: string;
  },
): string {
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : '';
  const weight = ` font-weight="${opts.weight ?? 500}"`;
  const x = Number(opts.x.toFixed(2));
  return `<text x="${x}" y="${opts.y}" font-size="${opts.size}"${fill(opts.palette, opts.role)}${weight}${anchor}>${escapeXml(content)}</text>`;
}

function avatarNode(stats: GitHubStats, palette: Palette, x: number, y: number): string {
  const href = safeDataUri(stats.avatarDataUri);
  const r = AVATAR / 2;
  const cx = x + r;
  const cy = y + r;

  // The shadow sits under the avatar exactly as it does under the card.
  const shadow = `<circle cx="${cx + SHADOW / 2}" cy="${cy + SHADOW / 2}" r="${r}"${fill(palette, 'sh')}/>`;
  const ring = `<circle cx="${cx}" cy="${cy}" r="${r - OUTLINE / 2}"${paint(palette, { fill: 'none', stroke: 'ink' })}/>`;

  if (href) {
    return [
      shadow,
      `<clipPath id="avatar"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`,
      `<image href="${href}" x="${x}" y="${y}" width="${AVATAR}" height="${AVATAR}" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice"/>`,
      ring,
    ].join('');
  }

  const initial = stats.displayName.trim().charAt(0).toUpperCase() || '?';
  return [
    shadow,
    `<circle cx="${cx}" cy="${cy}" r="${r}"${fill(palette, 'pill')}/>`,
    textNode(initial, {
      x: cx,
      y: cy + 8,
      size: 24,
      role: 'pillTx',
      palette,
      weight: 800,
      anchor: 'middle',
    }),
    ring,
  ].join('');
}

/**
 * An outlined sticker with its own hard shadow, optionally tilted — the small
 * rotation is what stops the card reading as a plain rounded rectangle.
 */
function stickerNode(
  label: string,
  palette: Palette,
  opts: {
    x: number;
    y: number;
    bg: Role;
    fg: Role;
    size: number;
    maxWidth: number;
    align?: 'left' | 'right';
    tilt?: number;
  },
): string {
  const text = truncate(label, opts.maxWidth, opts.size);
  const height = Math.round(opts.size * 2.3);
  // A one-letter language such as "C" would otherwise collapse into a dot.
  const width = Number(Math.max(measureText(text, opts.size, true) + opts.size * 2, 58).toFixed(1));
  const x = Number((opts.align === 'right' ? opts.x - width : opts.x).toFixed(1));
  const radius = height / 2;

  const body = [
    `<rect x="${x + SHADOW / 2}" y="${opts.y + SHADOW / 2}" width="${width}" height="${height}" rx="${radius}"${fill(palette, 'sh')}/>`,
    `<rect x="${x}" y="${opts.y}" width="${width}" height="${height}" rx="${radius}"${paint(palette, { fill: opts.bg, stroke: 'ink' })}/>`,
    textNode(text, {
      x: x + width / 2,
      y: opts.y + height / 2 + opts.size * 0.36,
      size: opts.size,
      role: opts.fg,
      palette,
      weight: 800,
      anchor: 'middle',
    }),
  ].join('');

  if (!opts.tilt) return body;

  const cx = Number((x + width / 2).toFixed(1));
  const cy = Number((opts.y + height / 2).toFixed(1));
  return `<g transform="rotate(${opts.tilt} ${cx} ${cy})">${body}</g>`;
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
        textNode(value, { x: centre, y, size: 19, role: 'tx', palette, weight: 800, anchor: 'middle' }),
        textNode(label, { x: centre, y: y + 16, size: 10.5, role: 'mu', palette, weight: 600, anchor: 'middle' }),
      ].join('');
    })
    .join('');
}

function document(height: number, theme: Theme, title: string, palette: Palette, body: string): string {
  const cardHeight = height - SHADOW;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="badge-title">`,
    `<title id="badge-title">${escapeXml(title)}</title>`,
    theme === 'auto' ? autoThemeStyle() : '',
    // Hard offset shadow, then the card itself on top of it.
    `<rect x="${SHADOW}" y="${SHADOW}" width="${CARD_WIDTH - OUTLINE}" height="${cardHeight - OUTLINE}" rx="${CARD_RADIUS}"${fill(palette, 'sh')}/>`,
    `<rect x="${OUTLINE / 2}" y="${OUTLINE / 2}" width="${CARD_WIDTH - OUTLINE}" height="${cardHeight - OUTLINE}" rx="${CARD_RADIUS}"${paint(palette, { fill: 'bg', stroke: 'ink' })}/>`,
    // font-family inherits, so it is declared once rather than per node.
    `<g font-family="${FONT}">${body}</g>`,
    '</svg>',
  ].join('');
}

export function renderBadge(
  stats: GitHubStats,
  theme: Theme = DEFAULT_THEME,
  score: ProfileScore = scoreProfile(stats),
): string {
  // `auto` renders light by default and lets the media query swap it.
  const palette = PALETTES[theme === 'dark' ? 'dark' : 'light'];
  const meme = buildMeme(stats, score);

  const nameWidth = INNER - AVATAR - 18 - 132;
  const name = truncate(stats.displayName, nameWidth, 19);
  const handle = truncate(`@${stats.username}`, nameWidth, 13);

  const taglineLines = wrapText(meme.tagline, INNER, 14.5, 2);
  const punchlineLines = wrapText(meme.punchline, INNER, 13, 2);

  const parts: string[] = [
    avatarNode(stats, palette, PADDING, PADDING),
    textNode(name, { x: PADDING + AVATAR + 18, y: PADDING + 24, size: 19, role: 'tx', palette, weight: 800 }),
    textNode(handle, { x: PADDING + AVATAR + 18, y: PADDING + 45, size: 13, role: 'mu', palette, weight: 600 }),
  ];

  if (stats.topLanguage) {
    parts.push(
      stickerNode(stats.topLanguage, palette, {
        x: CARD_WIDTH - PADDING,
        y: PADDING + 10,
        bg: 'pill',
        fg: 'pillTx',
        size: 12,
        maxWidth: 108,
        align: 'right',
        tilt: 3,
      }),
    );
  }

  // The earned title is the headline of the card, so it gets the loudest fill.
  const titleY = PADDING + AVATAR + 16;
  const titleHeight = Math.round(13.5 * 2.3);
  parts.push(
    stickerNode(meme.title, palette, {
      x: PADDING + 4,
      y: titleY,
      bg: 'ac',
      fg: 'acTx',
      size: 13.5,
      maxWidth: INNER - 40,
      tilt: -2,
    }),
  );

  let y = titleY + titleHeight + 30;
  for (const line of taglineLines) {
    parts.push(textNode(line, { x: PADDING, y, size: 14.5, role: 'tx', palette, weight: 700 }));
    y += 20;
  }

  y += 3;
  for (const line of punchlineLines) {
    parts.push(textNode(line, { x: PADDING, y, size: 13, role: 'mu', palette, weight: 500 }));
    y += 18;
  }

  // A perforated line, like the cut edge of a sticker sheet.
  y += 14;
  parts.push(
    `<line x1="${PADDING}" y1="${y}" x2="${CARD_WIDTH - PADDING}" y2="${y}" stroke="${palette.ink}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 9" class="ink"/>`,
  );

  y += 28;
  parts.push(statsRow(stats, palette, y));

  const height = Math.round(y + 16 + PADDING + SHADOW);
  return document(height, theme, `${stats.displayName}'s GitHub meme badge`, palette, parts.join(''));
}

/**
 * Errors are rendered as a badge too: the endpoint is consumed as an image, so
 * a JSON body would show up as a broken-image icon with no explanation.
 */
export function renderErrorBadge(message: string, theme: Theme = DEFAULT_THEME): string {
  const palette = PALETTES[theme === 'dark' ? 'dark' : 'light'];
  const height = 118;

  const parts = [
    stickerNode('Badge unavailable', palette, {
      x: PADDING,
      y: 22,
      bg: 'ac',
      fg: 'acTx',
      size: 13.5,
      maxWidth: INNER - 40,
      tilt: -2,
    }),
    ...wrapText(message, INNER, 13, 2).map((line, i) =>
      textNode(line, { x: PADDING, y: 84 + i * 18, size: 13, role: 'mu', palette, weight: 500 }),
    ),
  ];

  return document(height, theme, `GitHub meme badge error: ${message}`, palette, parts.join(''));
}
