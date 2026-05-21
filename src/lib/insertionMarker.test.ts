import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  INSERT_SENTINEL,
  blockSnippetsAt,
  buildMarkedDocument,
  getInsertionEditor,
  registerInsertionEditor,
} from './insertionMarker';

describe('INSERT_SENTINEL', () => {
  it('is a stable string token', () => {
    expect(INSERT_SENTINEL).toBe('<<<SKRIBE_INSERT_HERE>>>');
  });
});

describe('insertionMarker', () => {
  let mount: HTMLDivElement;
  let editor: Editor;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
    editor = new Editor({
      element: mount,
      extensions: [Document, Paragraph, Text],
      content: '<p>Alpha</p><p>Beta</p>',
    });
    registerInsertionEditor(editor as unknown as Parameters<typeof registerInsertionEditor>[0]);
  });

  afterEach(() => {
    registerInsertionEditor(null);
    editor.destroy();
    mount.remove();
  });

  it('returns null when no editor has been registered', () => {
    registerInsertionEditor(null);
    expect(getInsertionEditor()).toBeNull();
    expect(buildMarkedDocument(1)).toBeNull();
  });

  it('extracts the block snippet before and after the position', () => {
    const { blockBefore, blockAfter } = blockSnippetsAt(
      editor as unknown as Parameters<typeof blockSnippetsAt>[0],
      8,
    );

    expect(blockBefore).toContain('Alpha');
    expect(blockAfter).toContain('Beta');
  });

  it('clamps positions outside the document size', () => {
    const docSize = editor.state.doc.content.size;
    const { blockBefore, blockAfter } = blockSnippetsAt(
      editor as unknown as Parameters<typeof blockSnippetsAt>[0],
      docSize + 1000,
    );

    expect(typeof blockBefore).toBe('string');
    expect(blockAfter).toBe('');
  });

  it('returns null when the editor does not expose a markdown serializer', () => {
    expect(buildMarkedDocument(1)).toBeNull();
  });
});
