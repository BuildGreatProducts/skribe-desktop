import { describe, expect, it } from 'vitest';
import { insertionChipLabel } from './insertionChip';

describe('insertionChipLabel', () => {
  it('falls back to a generic label when no snippet is available', () => {
    expect(insertionChipLabel()).toBe('Insert here');
    expect(insertionChipLabel('')).toBe('Insert here');
    expect(insertionChipLabel('   \n\n  ')).toBe('Insert here');
  });

  it('collapses whitespace and truncates the snippet preview', () => {
    expect(insertionChipLabel('alpha\n\nbeta')).toBe('alpha beta');
    expect(insertionChipLabel('Once upon a midnight dreary')).toBe('Once upon a ...');
  });
});
