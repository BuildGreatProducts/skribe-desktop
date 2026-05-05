import type { Editor } from '@tiptap/react';

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
