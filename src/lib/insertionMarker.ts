import type { Editor } from '@tiptap/react';

export const INSERT_SENTINEL = '<<<SKRIBE_INSERT_HERE>>>';

const MARKER_BLOCK = `\n\n${INSERT_SENTINEL}\n\n`;

let activeEditor: Editor | null = null;

export function registerInsertionEditor(editor: Editor | null) {
  activeEditor = editor;
}

export function getInsertionEditor(): Editor | null {
  return activeEditor;
}

export function buildMarkedDocument(pos: number): string | null {
  const editor = activeEditor;
  if (!editor) return null;

  const { state } = editor;
  const clampedPos = Math.max(0, Math.min(pos, state.doc.content.size));

  // Guard against collisions: if the document already contains the sentinel
  // string we'd inject (e.g. a user pasted in a previous marked document or
  // happens to be writing about this app), injecting another occurrence would
  // make the downstream splice ambiguous. Bail out so the caller can surface
  // an explicit error rather than silently corrupting the prompt.
  const existingText = state.doc.textBetween(
    0,
    state.doc.content.size,
    '\n',
    '\n',
  );
  if (existingText.includes(INSERT_SENTINEL)) {
    console.warn(
      'Aborting marked-document build: document already contains the insertion sentinel.',
    );
    return null;
  }

  try {
    const tr = state.tr.insertText(MARKER_BLOCK, clampedPos);
    const storage = editor.storage as unknown as {
      markdown?: {
        serializer?: { serialize: (doc: typeof state.doc) => string };
      };
    };
    const serializer = storage.markdown?.serializer;
    if (!serializer) return null;
    return serializer.serialize(tr.doc);
  } catch (error) {
    console.error('Failed to build marked insertion document.', error);
    return null;
  }
}

export function blockSnippetsAt(
  editor: Editor,
  pos: number,
  length = 40,
): { blockBefore: string; blockAfter: string } {
  const { doc } = editor.state;
  const maxPos = doc.content.size;
  const safePos = Math.max(0, Math.min(pos, maxPos));
  const beforeStart = Math.max(0, safePos - length);
  const afterEnd = Math.min(maxPos, safePos + length);
  const blockBefore = doc.textBetween(beforeStart, safePos, '\n\n');
  const blockAfter = doc.textBetween(safePos, afterEnd, '\n\n');
  return { blockBefore, blockAfter };
}
