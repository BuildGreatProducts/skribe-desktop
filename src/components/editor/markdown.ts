import type { Editor } from '@tiptap/react';

type MarkdownRange = {
  from: number;
  to: number;
};

export function editorToMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as {
    markdown?: { getMarkdown?: () => string };
  };
  return storage.markdown?.getMarkdown?.() ?? editor.getText();
}

export function setMarkdown(editor: Editor, markdown: string, emitUpdate = false) {
  editor.commands.setContent(markdown, emitUpdate, {
    preserveWhitespace: 'full',
  });
}

export function trySetMarkdown(editor: Editor, markdown: string, emitUpdate = false) {
  try {
    setMarkdown(editor, markdown, emitUpdate);
    return true;
  } catch (error) {
    console.error('Failed to apply markdown content.', error);
    return false;
  }
}

export function tryInsertMarkdownAt(
  editor: Editor,
  range: MarkdownRange,
  markdown: string,
) {
  try {
    return editor.commands.insertContentAt(range, markdown, {
      updateSelection: true,
      parseOptions: { preserveWhitespace: 'full' },
    });
  } catch (error) {
    console.error('Failed to insert markdown content.', error);
    return false;
  }
}
