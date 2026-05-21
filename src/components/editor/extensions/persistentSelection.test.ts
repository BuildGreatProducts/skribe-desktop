import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PERSISTENT_SELECTION_CLASS,
  PERSISTENT_SELECTION_META,
  PersistentSelection,
} from './persistentSelection';

const SELECTOR = `.${PERSISTENT_SELECTION_CLASS}`;

describe('PersistentSelection extension', () => {
  let mount: HTMLDivElement;
  let editor: Editor;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
    editor = new Editor({
      element: mount,
      extensions: [Document, Paragraph, Text, PersistentSelection],
      content: '<p>Hello world</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
    mount.remove();
  });

  function setRange(range: { from: number; to: number } | null) {
    editor.view.dispatch(
      editor.state.tr.setMeta(PERSISTENT_SELECTION_META, range),
    );
  }

  it('renders a decoration node for the highlighted range and clears it when reset', () => {
    setRange({ from: 1, to: 6 });

    const decoration = mount.querySelector(SELECTOR);
    expect(decoration).not.toBeNull();
    expect(decoration?.textContent).toBe('Hello');

    setRange(null);

    expect(mount.querySelector(SELECTOR)).toBeNull();
  });

  it('keeps the decoration anchored after the user types elsewhere in the document', () => {
    setRange({ from: 7, to: 12 });
    expect(mount.querySelector(SELECTOR)?.textContent).toBe('world');

    editor.view.dispatch(editor.state.tr.insertText('Say ', 1, 1));

    const decoration = mount.querySelector(SELECTOR);
    expect(decoration).not.toBeNull();
    expect(decoration?.textContent).toBe('world');
  });

  it('clamps and ignores ranges that fall outside the current document', () => {
    setRange({ from: 1000, to: 1010 });
    expect(mount.querySelector(SELECTOR)).toBeNull();

    setRange({ from: 5, to: 5 });
    expect(mount.querySelector(SELECTOR)).toBeNull();
  });
});
