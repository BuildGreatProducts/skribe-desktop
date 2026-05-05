import { describe, expect, it } from 'vitest';
import { selectionChipLabel } from './selectionChip';

describe('selectionChipLabel', () => {
  it('collapses whitespace and truncates after ten characters', () => {
    expect(selectionChipLabel('abcdefghijklm')).toBe('abcdefghij...');
    expect(selectionChipLabel('alpha\n\nbeta')).toBe('alpha beta');
  });
});
