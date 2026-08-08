/**
 * Approximate glyph advance widths, expressed as a fraction of the font size.
 * There is no font engine available in the runtime, and the badge has to know
 * how tall it is before it is rendered, so wrapping works off an estimate that
 * is deliberately a touch generous.
 */
const NARROW = new Set([...`iljI.,;:'"\`|!()[]{}/\\ `]);
const SEMI_NARROW = new Set([...'ftrsz1']);
const WIDE = new Set([...'mwMW@%']);
const UPPER = /[A-Z]/;
const DIGIT = /[0-9]/;

function charWidth(char: string): number {
  if (NARROW.has(char)) return char === ' ' ? 0.27 : 0.3;
  if (SEMI_NARROW.has(char)) return 0.38;
  if (WIDE.has(char)) return 0.85;
  if (DIGIT.test(char)) return 0.56;
  if (UPPER.test(char)) return 0.67;
  return 0.53;
}

export function measureText(text: string, fontSize: number, bold = false): number {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return width * fontSize * (bold ? 1.06 : 1);
}

/** Greedy word wrap constrained by estimated pixel width. */
export function wrapText(text: string, maxWidth: number, fontSize: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureText(candidate, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    // The dropped lines have to be signalled even when the last kept line
    // happens to fit, otherwise the copy just stops mid-thought.
    kept[maxLines - 1] = ellipsise(kept[maxLines - 1], maxWidth, fontSize);
    return kept;
  }

  return lines;
}

/** Trims to fit `maxWidth`, appending an ellipsis only if something was cut. */
export function truncate(text: string, maxWidth: number, fontSize: number): string {
  return measureText(text, fontSize) <= maxWidth ? text : ellipsise(text, maxWidth, fontSize);
}

/** Trims to fit `maxWidth` with an ellipsis, which is always appended. */
function ellipsise(text: string, maxWidth: number, fontSize: number): string {
  const chars = [...text];
  while (chars.length > 1 && measureText(`${chars.join('')}…`, fontSize) > maxWidth) {
    chars.pop();
  }

  return `${chars.join('').trimEnd()}…`;
}

/** Compact counts: 1234 -> 1.2k, 1200000 -> 1.2M. */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
  }
  const m = value / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}M`;
}
