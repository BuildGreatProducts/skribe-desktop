import { describe, expect, it } from 'vitest';
import {
  selectedTextForPromptTarget,
  targetFromInsertionPoint,
  targetFromSelection,
} from './aiPromptTarget';
import type { HighlightedTextSelection, InsertionPoint } from '../types';

const selection: HighlightedTextSelection = {
  filePath: '/tmp/project/README.md',
  from: 2,
  to: 14,
  text: 'selected text',
};

const insertion: InsertionPoint = {
  filePath: '/tmp/project/README.md',
  pos: 42,
  blockBefore: 'previous block',
  blockAfter: 'next block',
};

describe('AI prompt targets', () => {
  it('uses selected text only when the selection belongs to the active file', () => {
    const target = targetFromSelection('/tmp/project/README.md', selection);

    expect(target).toEqual({ type: 'selection', selection });
    expect(selectedTextForPromptTarget('/tmp/project/README.md', target)).toBe(
      'selected text',
    );
  });

  it('falls back to the document target for stale file selections', () => {
    const target = targetFromSelection('/tmp/project/Other.md', selection);

    expect(target).toEqual({ type: 'document' });
    expect(selectedTextForPromptTarget('/tmp/project/Other.md', target)).toBeUndefined();
  });

  it('returns the insertion target when the insertion belongs to the active file', () => {
    const target = targetFromInsertionPoint('/tmp/project/README.md', insertion);

    expect(target).toEqual({ type: 'insertion', insertion });
  });

  it('falls back to the document target for stale-file insertion points', () => {
    const target = targetFromInsertionPoint('/tmp/project/Other.md', insertion);

    expect(target).toEqual({ type: 'document' });
  });

  it('does not return selected text for insertion targets', () => {
    const target = targetFromInsertionPoint('/tmp/project/README.md', insertion);

    expect(
      selectedTextForPromptTarget('/tmp/project/README.md', target),
    ).toBeUndefined();
  });
});
