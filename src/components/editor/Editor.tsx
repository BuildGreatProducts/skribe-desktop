import { ArrowRight } from '@phosphor-icons/react';
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from 'react';
import { blockSnippetsAt, registerInsertionEditor } from '../../lib/insertionMarker';
import { useAiStore } from '../../stores/aiStore';
import {
  setEditorHistoryAvailability,
  useEditorHistoryStore,
} from '../../stores/editorHistoryStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type {
  AiError,
  HighlightedTextSelection,
  InsertionPoint,
} from '../../types';
import { StatusLine } from '../status/StatusLine';
import { extensions } from './extensions';
import {
  INSERTION_MARKER_META,
  PERSISTENT_SELECTION_META,
  readInsertionMarkerPos,
} from './extensions/persistentSelection';
import { EditorToolbar } from './EditorToolbar';
import { editorToMarkdown, setMarkdown, tryInsertMarkdownAt, trySetMarkdown } from './markdown';
import { shouldApplyStream } from './streaming';

const GUTTER_TEXT_PADDING = 32;
// Shift the arrow's center up from the raw line-top coord so that the icon
// visually sits next to the gap where text would actually be inserted, rather
// than overlapping the first line of the next block.
const INSERTION_ARROW_Y_OFFSET = -8;

type HoverState = {
  pos: number;
  top: number;
};

export function Editor() {
  const filePath = useEditorStore((state) => state.filePath);
  const content = useEditorStore((state) => state.content);
  const setContent = useEditorStore((state) => state.setContent);
  const saveNow = useEditorStore((state) => state.saveNow);
  const highlightedSelection = useEditorStore(
    (state) => state.highlightedSelection,
  );
  const insertionPoint = useEditorStore((state) => state.insertionPoint);
  const setInsertionPoint = useEditorStore((state) => state.setInsertionPoint);
  const clearInsertionPoint = useEditorStore((state) => state.clearInsertionPoint);
  const settings = useSettingsStore((state) => state.settings.editor);
  const aiStatus = useAiStore((state) => state.status);
  const promptFilePath = useAiStore((state) => state.promptFilePath);
  const partialResponse = useAiStore((state) => state.partialResponse);
  const promptTarget = useAiStore((state) => state.promptTarget);
  const streamComplete = useAiStore((state) => state.streamPreview.complete);
  const markAiError = useAiStore((state) => state.markError);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastStream = useRef('');
  const beforeAi = useRef<string | null>(null);
  const performUndoRef = useRef<() => void>(() => {});
  const performRedoRef = useRef<() => void>(() => {});
  const historyDisabled = aiStatus === 'streaming' && promptFilePath === filePath;
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [persistentTop, setPersistentTop] = useState<number | null>(null);
  const [arrowLeft, setArrowLeft] = useState<number>(8);

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
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
          if (beforeAi.current || editor?.can().undo()) {
            event.preventDefault();
            performUndoRef.current();
            return true;
          }
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          event.shiftKey &&
          event.key.toLowerCase() === 'z'
        ) {
          if (editor && !beforeAi.current && editor.can().redo()) {
            event.preventDefault();
            performRedoRef.current();
            return true;
          }
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
      if (beforeAi.current) {
        beforeAi.current = null;
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
    registerInsertionEditor(editor ?? null);
    return () => {
      registerInsertionEditor(null);
    };
  }, [editor]);

  const refreshHistory = useCallback((activeEditor: TiptapEditor) => {
    const canUndo = beforeAi.current !== null || activeEditor.can().undo();
    const canRedo = beforeAi.current === null && activeEditor.can().redo();
    setEditorHistoryAvailability(canUndo, canRedo);
  }, []);

  const performUndo = useCallback(() => {
    if (!editor) return;
    if (beforeAi.current) {
      const restored = trySetMarkdown(editor, beforeAi.current, true);
      if (restored) {
        setContent(beforeAi.current);
        beforeAi.current = null;
        refreshHistory(editor);
      }
      return;
    }
    editor.chain().focus().undo().run();
    refreshHistory(editor);
  }, [editor, refreshHistory, setContent]);

  const performRedo = useCallback(() => {
    if (!editor || beforeAi.current) return;
    editor.chain().focus().redo().run();
    refreshHistory(editor);
  }, [editor, refreshHistory]);

  useEffect(() => {
    performUndoRef.current = performUndo;
    performRedoRef.current = performRedo;
  }, [performRedo, performUndo]);

  useEffect(() => {
    if (!editor || !filePath) {
      useEditorHistoryStore.getState().setDisabled(true);
      useEditorHistoryStore.getState().clear();
      return undefined;
    }

    const refresh = () => refreshHistory(editor);
    useEditorHistoryStore.getState().register({
      undo: performUndo,
      redo: performRedo,
      refresh,
    });
    useEditorHistoryStore.getState().setDisabled(historyDisabled);

    refresh();
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);

    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
      useEditorHistoryStore.getState().clear();
    };
  }, [editor, filePath, performRedo, performUndo, refreshHistory]);

  useEffect(() => {
    useEditorHistoryStore.getState().setDisabled(historyDisabled);
  }, [historyDisabled]);

  useEffect(() => {
    if (!editor || !filePath) return;
    setMarkdown(editor, content, false);
    beforeAi.current = null;
    lastStream.current = '';
    refreshHistory(editor);
    // Run only when a new document becomes active; live edits flow through Tiptap updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, filePath]);

  useEffect(() => {
    if (!editor) return;
    const range =
      highlightedSelection && highlightedSelection.filePath === filePath
        ? { from: highlightedSelection.from, to: highlightedSelection.to }
        : null;
    editor.view.dispatch(
      editor.state.tr.setMeta(PERSISTENT_SELECTION_META, range),
    );
  }, [editor, filePath, highlightedSelection]);

  useEffect(() => {
    if (!editor) return;
    const pos =
      insertionPoint && insertionPoint.filePath === filePath
        ? insertionPoint.pos
        : null;
    editor.view.dispatch(editor.state.tr.setMeta(INSERTION_MARKER_META, pos));
  }, [editor, filePath, insertionPoint]);

  useEffect(() => {
    if (!editor) return undefined;
    const handleTransaction = () => {
      const stateInsertion = useEditorStore.getState().insertionPoint;
      const activeFilePath = useEditorStore.getState().filePath;
      if (!stateInsertion || stateInsertion.filePath !== activeFilePath) return;
      const mappedPos = readInsertionMarkerPos(editor.state);
      if (mappedPos === null || mappedPos === stateInsertion.pos) return;
      const { blockBefore, blockAfter } = blockSnippetsAt(editor, mappedPos);
      useEditorStore.getState().setInsertionPoint({
        filePath: stateInsertion.filePath,
        pos: mappedPos,
        blockBefore,
        blockAfter,
      });
    };
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  useEffect(() => {
    if (!scrollRef.current) return undefined;
    const container = scrollRef.current;

    const computeLeft = () => {
      const proseMirror = container.querySelector<HTMLElement>('.ProseMirror');
      if (!proseMirror) return;
      const containerRect = container.getBoundingClientRect();
      const proseRect = proseMirror.getBoundingClientRect();
      const columnOffset = proseRect.left - containerRect.left;
      const externalCandidate = columnOffset - 12;
      const insidePaddingFallback = Math.max(0, columnOffset - 6);
      const safeFloor = 8;
      setArrowLeft(
        externalCandidate >= safeFloor
          ? externalCandidate
          : insidePaddingFallback,
      );
    };

    computeLeft();
    window.addEventListener('resize', computeLeft);
    const observer = new ResizeObserver(computeLeft);
    observer.observe(container);
    return () => {
      window.removeEventListener('resize', computeLeft);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!editor || !scrollRef.current) {
      setPersistentTop(null);
      return undefined;
    }
    if (!insertionPoint || insertionPoint.filePath !== filePath) {
      setPersistentTop(null);
      return undefined;
    }

    const compute = () => {
      const container = scrollRef.current;
      if (!container) return;
      try {
        const coords = editor.view.coordsAtPos(insertionPoint.pos);
        const rect = container.getBoundingClientRect();
        const top =
          coords.top -
          rect.top +
          container.scrollTop +
          INSERTION_ARROW_Y_OFFSET;
        setPersistentTop(top);
      } catch {
        setPersistentTop(null);
      }
    };

    compute();
    const container = scrollRef.current;
    container.addEventListener('scroll', compute, { passive: true });
    editor.on('transaction', compute);
    window.addEventListener('resize', compute);
    return () => {
      container.removeEventListener('scroll', compute);
      editor.off('transaction', compute);
      window.removeEventListener('resize', compute);
    };
  }, [editor, filePath, insertionPoint]);

  useEffect(() => {
    if (!editor || aiStatus !== 'streaming' || filePath !== promptFilePath) return;
    if (!beforeAi.current) beforeAi.current = content;
    refreshHistory(editor);
    if (!shouldApplyStream(lastStream.current, partialResponse)) return;
    if (promptTarget.type === 'selection') return;
    if (promptTarget.type === 'insertion') return;
    if (trySetMarkdown(editor, partialResponse, false)) {
      lastStream.current = partialResponse;
    }
  }, [aiStatus, content, editor, filePath, partialResponse, promptFilePath, promptTarget]);

  useEffect(() => {
    if (aiStatus === 'error' || (aiStatus === 'idle' && !streamComplete)) {
      beforeAi.current = null;
      lastStream.current = '';
      if (editor) refreshHistory(editor);
    }
  }, [aiStatus, editor, refreshHistory, streamComplete]);

  useEffect(() => {
    if (!editor || aiStatus === 'streaming' || !streamComplete) return;
    if (promptFilePath && filePath !== promptFilePath) return;
    if (
      !partialResponse &&
      !lastStream.current &&
      promptTarget.type !== 'selection' &&
      promptTarget.type !== 'insertion'
    )
      return;

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

    if (promptTarget.type === 'insertion') {
      const insertion = promptTarget.insertion;
      if (filePath !== insertion.filePath || insertionIsStale(editor, insertion)) {
        beforeAi.current = null;
        lastStream.current = '';
        clearInsertionPoint();
        markAiError({
          code: 'AI_INSERTION_STALE',
          message:
            'The document changed before Claude finished. Pick the insertion point again and retry.',
        });
        return;
      }

      const inserted = tryInsertMarkdownAt(
        editor,
        { from: insertion.pos, to: insertion.pos },
        finalResponse,
      );

      if (!inserted) {
        failAiApply(
          editor,
          beforeAi,
          lastStream,
          markAiError,
          'Claude returned insertion text, but Skribe could not apply it to the document.',
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
          'Claude inserted text, but Skribe could not serialize the document afterward.',
        );
        return;
      }
      setContent(updated);
      void saveNow();
      lastStream.current = '';
      clearInsertionPoint();
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
    clearInsertionPoint,
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

  const computeHoverPos = useCallback(
    (clientX: number, clientY: number): HoverState | null => {
      if (!editor || !scrollRef.current) return null;
      const proseMirror = scrollRef.current.querySelector<HTMLElement>(
        '.ProseMirror',
      );
      if (!proseMirror) return null;
      const containerRect = scrollRef.current.getBoundingClientRect();
      const proseRect = proseMirror.getBoundingClientRect();

      const gutterLeftBound = containerRect.left;
      const gutterRightBound = proseRect.left + GUTTER_TEXT_PADDING;
      const inGutter =
        clientX >= gutterLeftBound && clientX <= gutterRightBound;
      if (!inGutter) return null;
      if (clientY < proseRect.top || clientY > proseRect.bottom) return null;

      const sampleX = proseRect.left + GUTTER_TEXT_PADDING + 8;
      const hit = editor.view.posAtCoords({ left: sampleX, top: clientY });
      if (!hit) return null;

      let blockPos = hit.pos;
      try {
        const $pos = editor.state.doc.resolve(hit.pos);
        if ($pos.depth >= 1) {
          const blockStart = $pos.before(1);
          const blockEnd = $pos.after(1);
          const startCoords = editor.view.coordsAtPos(blockStart);
          const endCoords = editor.view.coordsAtPos(blockEnd);
          const startMid = (startCoords.top + startCoords.bottom) / 2;
          const endMid = (endCoords.top + endCoords.bottom) / 2;
          blockPos =
            Math.abs(clientY - startMid) <= Math.abs(clientY - endMid)
              ? blockStart
              : blockEnd;
        }
      } catch {
        blockPos = hit.pos;
      }

      let top: number;
      try {
        const coords = editor.view.coordsAtPos(blockPos);
        top =
          coords.top -
          containerRect.top +
          scrollRef.current.scrollTop +
          INSERTION_ARROW_Y_OFFSET;
      } catch {
        return null;
      }

      return { pos: blockPos, top };
    },
    [editor],
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const next = computeHoverPos(event.clientX, event.clientY);
      setHoverState(next);
    },
    [computeHoverPos],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverState(null);
  }, []);

  const handleInsertionClick = useCallback(() => {
    if (!editor || !filePath || !hoverState) return;
    const aiState = useAiStore.getState();
    if (aiState.status === 'streaming' && aiState.promptFilePath === filePath) {
      return;
    }
    const { blockBefore, blockAfter } = blockSnippetsAt(editor, hoverState.pos);
    // Snap the persistent button to the exact Y the hover button was rendered
    // at, so the green arrow appears in the same place without waiting for
    // the post-render useEffect that otherwise re-derives the position.
    setPersistentTop(hoverState.top);
    setInsertionPoint({
      filePath,
      pos: hoverState.pos,
      blockBefore,
      blockAfter,
    });
    setHoverState(null);
  }, [editor, filePath, hoverState, setInsertionPoint]);

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-ink-soft">
        Select a file to start writing or press Command-N for a new one.
      </div>
    );
  }

  const persistentVisible =
    persistentTop !== null &&
    insertionPoint !== null &&
    insertionPoint.filePath === filePath;
  // Suppress the hover button when it would target the same block as the
  // active persistent insertion point — otherwise the semi-transparent grey
  // hover circle and its dark arrow render directly on top of the green
  // persistent button, producing a "black arrow over the green icon" stack.
  const hoverTargetsPersistent =
    persistentVisible &&
    hoverState !== null &&
    insertionPoint !== null &&
    hoverState.pos === insertionPoint.pos;
  const hoverButtonVisible = hoverState !== null && !hoverTargetsPersistent;
  const isStreaming =
    aiStatus === 'streaming' && promptFilePath === filePath;

  return (
    <div
      ref={scrollRef}
      className="skribe-scrollbar relative h-full overflow-auto"
      style={{
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
      }}
      aria-label="Markdown editor"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <EditorToolbar editor={editor} disabled={isStreaming} />
      <StatusLine />
      <EditorContent editor={editor} />
      {persistentVisible ? (
        <button
          type="button"
          aria-label="Clear AI insertion point"
          className="absolute z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-success text-white shadow-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-1"
          style={{
            top: `${persistentTop}px`,
            left: `${arrowLeft}px`,
          }}
          onClick={(event) => {
            event.stopPropagation();
            clearInsertionPoint();
          }}
        >
          <ArrowRight size={18} weight="bold" />
        </button>
      ) : null}
      {hoverButtonVisible && !isStreaming ? (
        <button
          type="button"
          aria-label="Insert AI text here"
          className="absolute z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-chrome-bg text-ink shadow-sm transition hover:scale-110 hover:bg-hairline focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
          style={{
            top: `${hoverState!.top}px`,
            left: `${arrowLeft}px`,
          }}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={(event) => {
            event.stopPropagation();
            handleInsertionClick();
          }}
        >
          <ArrowRight size={18} weight="bold" />
        </button>
      ) : null}
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

function insertionIsStale(editor: TiptapEditor, insertion: InsertionPoint) {
  const maxPosition = editor.state.doc.content.size;
  if (insertion.pos < 0 || insertion.pos > maxPosition) {
    return true;
  }

  const length = 40;
  const beforeStart = Math.max(0, insertion.pos - length);
  const afterEnd = Math.min(maxPosition, insertion.pos + length);
  const currentBefore = editor.state.doc.textBetween(
    beforeStart,
    insertion.pos,
    '\n\n',
  );
  const currentAfter = editor.state.doc.textBetween(
    insertion.pos,
    afterEnd,
    '\n\n',
  );
  return (
    currentBefore !== insertion.blockBefore ||
    currentAfter !== insertion.blockAfter
  );
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
