import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { useAiStore } from '../../stores/aiStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { AiError, HighlightedTextSelection } from '../../types';
import { StatusLine } from '../status/StatusLine';
import { extensions } from './extensions';
import { EditorToolbar } from './EditorToolbar';
import { editorToMarkdown, setMarkdown, tryInsertMarkdownAt, trySetMarkdown } from './markdown';
import { shouldApplyStream } from './streaming';

export function Editor() {
  const filePath = useEditorStore((state) => state.filePath);
  const content = useEditorStore((state) => state.content);
  const setContent = useEditorStore((state) => state.setContent);
  const saveNow = useEditorStore((state) => state.saveNow);
  const settings = useSettingsStore((state) => state.settings.editor);
  const aiStatus = useAiStore((state) => state.status);
  const promptFilePath = useAiStore((state) => state.promptFilePath);
  const partialResponse = useAiStore((state) => state.partialResponse);
  const promptTarget = useAiStore((state) => state.promptTarget);
  const streamComplete = useAiStore((state) => state.streamPreview.complete);
  const markAiError = useAiStore((state) => state.markError);
  const lastStream = useRef('');
  const beforeAi = useRef<string | null>(null);

  const editor = useEditor({
    extensions,
    content,
    editorProps: {
      attributes: {
        class:
          'mx-auto min-h-full w-full max-w-[44rem] px-8 pb-40 pt-16 font-editor text-doc text-ink outline-none',
      },
      handleKeyDown: (_, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          void saveNow();
          return true;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && beforeAi.current) {
          event.preventDefault();
          if (editor) {
            const restored = trySetMarkdown(editor, beforeAi.current, true);
            if (restored) {
              setContent(beforeAi.current);
              beforeAi.current = null;
            }
          }
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      const aiState = useAiStore.getState();
      if (
        aiState.status === 'streaming' &&
        aiState.promptFilePath === useEditorStore.getState().filePath
      ) {
        return;
      }
      setContent(editorToMarkdown(editor));
    },
    onSelectionUpdate({ editor }) {
      const { selection } = editor.state;
      const activeFilePath = useEditorStore.getState().filePath;
      if (!activeFilePath || selection.empty) return;
      const aiState = useAiStore.getState();
      if (aiState.status === 'streaming' && aiState.promptFilePath === activeFilePath) return;

      const text = editor.state.doc.textBetween(selection.from, selection.to, '\n\n');
      if (!text.trim()) return;

      useEditorStore.getState().setHighlightedSelection({
        filePath: activeFilePath,
        from: selection.from,
        to: selection.to,
        text,
      });
    },
  });

  useEffect(() => {
    if (!editor || !filePath) return;
    setMarkdown(editor, content, false);
    beforeAi.current = null;
    lastStream.current = '';
    // Run only when a new document becomes active; live edits flow through Tiptap updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, filePath]);

  useEffect(() => {
    if (!editor || aiStatus !== 'streaming' || filePath !== promptFilePath) return;
    if (!beforeAi.current) beforeAi.current = content;
    if (!shouldApplyStream(lastStream.current, partialResponse)) return;
    if (promptTarget.type === 'selection') return;
    if (trySetMarkdown(editor, partialResponse, false)) {
      lastStream.current = partialResponse;
    }
  }, [aiStatus, content, editor, filePath, partialResponse, promptFilePath, promptTarget]);

  useEffect(() => {
    if (aiStatus === 'error' || (aiStatus === 'idle' && !streamComplete)) {
      beforeAi.current = null;
      lastStream.current = '';
    }
  }, [aiStatus, streamComplete]);

  useEffect(() => {
    if (!editor || aiStatus === 'streaming' || !streamComplete) return;
    if (promptFilePath && filePath !== promptFilePath) return;
    if (!partialResponse && !lastStream.current && promptTarget.type !== 'selection') return;

    const finalResponse = partialResponse || lastStream.current;
    if (promptTarget.type === 'selection') {
      const selection = promptTarget.selection;
      if (filePath !== selection.filePath || selectionIsStale(editor, selection)) {
        beforeAi.current = null;
        lastStream.current = '';
        markAiError({
          code: 'AI_SELECTION_STALE',
          message: 'The selected text changed before Claude finished. Select it again and retry.',
        });
        return;
      }

      const replaced = tryInsertMarkdownAt(
        editor,
        { from: selection.from, to: selection.to },
        finalResponse,
      );

      if (!replaced) {
        failAiApply(
          editor,
          beforeAi,
          lastStream,
          markAiError,
          'Claude returned replacement text, but Skribe could not apply it to the selection.',
        );
        return;
      }

      let updated: string;
      try {
        updated = editorToMarkdown(editor);
      } catch (error) {
        console.error('Failed to serialize editor content after AI insertion.', error);
        failAiApply(
          editor,
          beforeAi,
          lastStream,
          markAiError,
          'Claude updated the selection, but Skribe could not serialize the document afterward.',
        );
        return;
      }
      setContent(updated);
      void saveNow();
      lastStream.current = '';
      return;
    }

    if (finalResponse !== lastStream.current) {
      const applied = trySetMarkdown(editor, finalResponse, false);
      if (!applied) {
        failAiApply(
          editor,
          beforeAi,
          lastStream,
          markAiError,
          'Claude returned Markdown, but Skribe could not apply it to the document.',
        );
        return;
      }
    }
    setContent(finalResponse);
    void saveNow();
    lastStream.current = '';
  }, [
    aiStatus,
    editor,
    filePath,
    markAiError,
    partialResponse,
    promptFilePath,
    promptTarget,
    saveNow,
    setContent,
    streamComplete,
  ]);

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-ink-soft">
        Select a file to start writing or press Command-N for a new one.
      </div>
    );
  }

  return (
    <div
      className="skribe-scrollbar h-full overflow-auto"
      style={{
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
      }}
      aria-label="Markdown editor"
    >
      <EditorToolbar editor={editor} disabled={aiStatus === 'streaming' && promptFilePath === filePath} />
      <StatusLine />
      <EditorContent editor={editor} />
    </div>
  );
}

function selectionIsStale(editor: TiptapEditor, selection: HighlightedTextSelection) {
  const maxPosition = editor.state.doc.content.size;
  if (selection.from < 0 || selection.to > maxPosition || selection.from >= selection.to) {
    return true;
  }

  return editor.state.doc.textBetween(selection.from, selection.to, '\n\n') !== selection.text;
}

function failAiApply(
  editor: TiptapEditor,
  beforeAi: MutableRefObject<string | null>,
  lastStream: MutableRefObject<string>,
  markAiError: (error: AiError) => void,
  message: string,
) {
  if (beforeAi.current) {
    trySetMarkdown(editor, beforeAi.current, false);
  }
  beforeAi.current = null;
  lastStream.current = '';
  markAiError({
    code: 'CLAUDE_UNKNOWN_ERROR',
    message,
  });
}
