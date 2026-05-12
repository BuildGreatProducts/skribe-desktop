import { afterEach, describe, expect, it, vi } from 'vitest';
import { tryInsertMarkdownAt, trySetMarkdown } from './markdown';
import type { Editor } from '@tiptap/react';

describe('markdown editor guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports setContent failures without throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const editor = {
      commands: {
        setContent: vi.fn(() => {
          throw new Error('parser exploded');
        }),
      },
    } as unknown as Editor;

    expect(trySetMarkdown(editor, '# Draft')).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('reports insertContentAt failures without throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const editor = {
      commands: {
        insertContentAt: vi.fn(() => {
          throw new Error('replace exploded');
        }),
      },
    } as unknown as Editor;

    expect(tryInsertMarkdownAt(editor, { from: 1, to: 4 }, 'Replacement')).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
