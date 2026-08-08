import { describe, expect, it } from 'vitest';
import { formatCount, measureText, truncate, wrapText } from './text';

describe('measureText', () => {
  it('grows with length and font size', () => {
    expect(measureText('mm', 14)).toBeGreaterThan(measureText('ii', 14));
    expect(measureText('abc', 20)).toBeGreaterThan(measureText('abc', 10));
  });

  it('returns zero for an empty string', () => {
    expect(measureText('', 14)).toBe(0);
  });
});

describe('wrapText', () => {
  it('keeps every line within the width budget', () => {
    const lines = wrapText('the quick brown fox jumps over the lazy dog again and again', 120, 14, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 14)).toBeLessThanOrEqual(120);
    }
  });

  it('loses no words when it fits on one line', () => {
    expect(wrapText('short enough', 400, 14)).toEqual(['short enough']);
  });

  it('caps the line count and ellipsises the overflow', () => {
    const lines = wrapText('word '.repeat(60), 100, 14, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('never emits an empty line for collapsed whitespace', () => {
    expect(wrapText('  a   b  ', 400, 14)).toEqual(['a b']);
  });
});

describe('truncate', () => {
  it('leaves text that already fits', () => {
    expect(truncate('fits', 400, 14)).toBe('fits');
  });

  it('shortens and marks text that does not fit', () => {
    const result = truncate('a considerably longer piece of text', 60, 14);
    expect(result.endsWith('…')).toBe(true);
    expect(measureText(result, 14)).toBeLessThanOrEqual(60);
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1k'],
    [1234, '1.2k'],
    [12_345, '12k'],
    [1_200_000, '1.2M'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatCount(input)).toBe(expected);
  });
});
