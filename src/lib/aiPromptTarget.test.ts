import { describe, expect, it } from 'vitest';
import { selectedTextForPromptTarget, targetFromSelection } from './aiPromptTarget';
import type { HighlightedTextSelection } from '../types';

const selection: HighlightedTextSelection = {
  filePath: '/tmp/project/README.md',
  from: 2,
  to: 14,
  text: 'selected text',
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
});
