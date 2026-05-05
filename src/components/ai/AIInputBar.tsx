import { FileMdIcon, PaperPlaneTiltIcon, XIcon } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { targetFromSelection } from '../../lib/aiPromptTarget';
import { useAiStore } from '../../stores/aiStore';
import { useEditorStore } from '../../stores/editorStore';
import { useFolderStore } from '../../stores/folderStore';
import { usePreflightStore } from '../../stores/preflightStore';
import type { DocumentReference, MarkdownFile } from '../../types';
import { Button, Tooltip } from '../ui';
import { ClaudeStreamPreview } from './ClaudeStreamPreview';
import { ClarificationPopup } from './ClarificationPopup';
import { ErrorState } from './ErrorState';
import { selectionChipLabel } from './selectionChip';

const COLLAPSE_ANIMATION_MS = 200;

type MentionState = {
  start: number;
  end: number;
  query: string;
};

type TextPromptSegment = {
  type: 'text';
  id: string;
  text: string;
};

type DocumentPromptSegment = {
  type: 'document';
  id: string;
  reference: DocumentReference;
};

type PromptSegment = TextPromptSegment | DocumentPromptSegment;

let nextPromptSegmentId = 0;

export function AIInputBar() {
  const initialTextSegmentRef = useRef<TextPromptSegment | null>(null);
  if (!initialTextSegmentRef.current) {
    initialTextSegmentRef.current = createTextPromptSegment();
  }

  const [segments, setSegments] = useState<PromptSegment[]>(() => [initialTextSegmentRef.current!]);
  const [liveSegments, setLiveSegments] = useState<PromptSegment[]>(() => [
    initialTextSegmentRef.current!,
  ]);
  const [editorRevision, setEditorRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const pendingCaretSegmentId = useRef<string | null>(null);
  const pendingPromptFocus = useRef(false);
  const folderPath = useFolderStore((state) => state.path);
  const files = useFolderStore((state) => state.files);
  const filePath = useEditorStore((state) => state.filePath);
  const highlightedSelection = useEditorStore((state) => state.highlightedSelection);
  const clearHighlightedSelection = useEditorStore((state) => state.clearHighlightedSelection);
  const status = useAiStore((state) => state.status);
  const streamPreview = useAiStore((state) => state.streamPreview);
  const startSession = useAiStore((state) => state.startSession);
  const submitPrompt = useAiStore((state) => state.submitPrompt);
  const cancel = useAiStore((state) => state.cancel);
  const dismissStreamPreview = useAiStore((state) => state.dismissStreamPreview);
  const availability = usePreflightStore((state) => state.availability);
  const textValue = promptTextFromSegments(liveSegments);
  const documentReferences = useMemo(
    () => documentReferencesFromSegments(liveSegments),
    [liveSegments],
  );
  const liveSegmentsRef = useRef(liveSegments);

  useEffect(() => {
    liveSegmentsRef.current = liveSegments;
  }, [liveSegments]);

  useEffect(() => {
    if (folderPath && availability.status === 'ready') void startSession(folderPath);
  }, [availability.status, folderPath, startSession]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setExpanded(true);
        setPromptVisible(true);
        pendingPromptFocus.current = true;
      }
      if (event.key === 'Escape' && status === 'streaming') {
        void cancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancel, status]);

  useEffect(() => {
    if (status !== 'idle' || textValue.trim() || documentReferences.length > 0) return;

    const handler = (event: { target: unknown }) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      clearHighlightedSelection();
      setExpanded(false);
    };

    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [clearHighlightedSelection, documentReferences.length, status, textValue]);

  useLayoutEffect(() => {
    const segmentId = pendingCaretSegmentId.current;
    if (!segmentId || !editorRef.current) return;
    pendingCaretSegmentId.current = null;
    const segment = editorRef.current.querySelector<HTMLElement>(
      `[data-segment-id="${segmentId}"]`,
    );
    if (segment) placeCaretInsideTextSegment(segment);
  }, [segments]);

  const disabledReason = !folderPath
    ? 'Open a folder first'
    : !filePath
      ? 'Select a document first'
      : claudeDisabledReason(availability.status);
  const disabled = Boolean(disabledReason) || status === 'submitting' || status === 'awaiting_clarification';
  const busy = ['submitting', 'streaming', 'awaiting_clarification'].includes(status);
  const selection =
    highlightedSelection && highlightedSelection.filePath === filePath ? highlightedSelection : null;
  const selectionLabel = selection ? selectionChipLabel(selection.text) : null;
  const mentionableDocuments = useMemo(
    () =>
      files.filter(
        (file) =>
          file.path !== filePath &&
          !documentReferences.some((reference) => reference.path === file.path),
      ),
    [documentReferences, filePath, files],
  );
  const filteredMentionDocuments = useMemo(() => {
    const query = mention?.query.trim().toLowerCase() ?? '';
    if (!query) return mentionableDocuments;
    return mentionableDocuments.filter(
      (file) =>
        file.name.toLowerCase().includes(query) ||
        file.relativePath.toLowerCase().includes(query),
    );
  }, [mention, mentionableDocuments]);
  const mentionMenuOpen = Boolean(mention) && filteredMentionDocuments.length > 0;
  const isExpanded =
    expanded ||
    Boolean(textValue.trim()) ||
    Boolean(selection) ||
    documentReferences.length > 0 ||
    busy ||
    streamPreview.visible;
  const [promptVisible, setPromptVisible] = useState(isExpanded);

  useLayoutEffect(() => {
    if (!promptVisible || !pendingPromptFocus.current || disabled || status === 'streaming') return;
    pendingPromptFocus.current = false;
    editorRef.current?.focus();
    if (editorRef.current) placeCaretAtEnd(editorRef.current);
  }, [disabled, promptVisible, status]);

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [documentReferences.length, files.length, mention?.query]);

  useEffect(() => {
    if (activeMentionIndex < filteredMentionDocuments.length) return;
    setActiveMentionIndex(0);
  }, [activeMentionIndex, filteredMentionDocuments.length]);

  useEffect(() => {
    if (isExpanded) {
      setPromptVisible(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      const currentSegments = editorRef.current
        ? parseEditorSegments(editorRef.current)
        : liveSegmentsRef.current;
      setSegments(currentSegments);
      setLiveSegments(currentSegments);
      setEditorRevision((revision) => revision + 1);
      setPromptVisible(false);
    }, COLLAPSE_ANIMATION_MS);

    return () => window.clearTimeout(timeout);
  }, [isExpanded]);

  async function submit() {
    const currentSegments = readEditorSegments();
    const currentText = promptTextFromSegments(currentSegments);
    if (!filePath || !currentText.trim() || disabled) return;

    const prompt = promptValueFromSegments(currentSegments);
    const target = targetFromSelection(filePath, selection);
    const references = documentReferencesFromSegments(currentSegments);
    const nextTextSegment = createTextPromptSegment();
    commitPromptSegments([nextTextSegment]);
    setMention(null);
    clearHighlightedSelection();
    await submitPrompt(prompt, filePath, target, references);
  }

  function readEditorSegments() {
    return editorRef.current ? parseEditorSegments(editorRef.current) : liveSegments;
  }

  function commitPromptSegments(nextSegments: PromptSegment[]) {
    setSegments(nextSegments);
    setLiveSegments(nextSegments);
    setEditorRevision((revision) => revision + 1);
  }

  function syncEditorState() {
    const currentSegments = readEditorSegments();
    const currentText = promptTextFromSegments(currentSegments);
    const cursor = editorRef.current ? textOffsetFromSelection(editorRef.current) : null;
    // Keep ordinary typing browser-owned; React only commits structure when chips change.
    setLiveSegments(currentSegments);
    setMention(findActiveMention(currentText, cursor ?? currentText.length));
  }

  function selectMentionDocument(file: MarkdownFile) {
    if (!mention) return;

    const reference = documentReferenceFromFile(file);
    const documentSegment = createDocumentPromptSegment(reference);
    const afterSegment = createTextPromptSegment();
    const nextSegments = replaceTextRangeWithDocument(
      readEditorSegments(),
      mention.start,
      mention.end,
      documentSegment,
      afterSegment,
    );

    pendingCaretSegmentId.current = afterSegment.id;
    commitPromptSegments(nextSegments);
    setMention(null);
    setExpanded(true);
  }

  function removeDocumentSegment(segmentId: string) {
    const nextSegments = normalizePromptSegments(
      readEditorSegments().filter((segment) => segment.id !== segmentId),
    );
    const fallback = firstTextSegmentId(nextSegments);
    if (fallback) pendingCaretSegmentId.current = fallback;
    commitPromptSegments(nextSegments);
  }

  function removePreviousDocumentSegment() {
    if (!editorRef.current) return false;
    const previousDocumentId = documentSegmentIdBeforeSelection(editorRef.current);
    if (previousDocumentId) {
      removeDocumentSegment(previousDocumentId);
      return true;
    }

    const currentSegments = readEditorSegments();
    if (promptTextFromSegments(currentSegments).length > 0) return false;

    const lastDocument = lastDocumentSegmentIn(currentSegments);
    if (!lastDocument) return false;
    removeDocumentSegment(lastDocument.id);
    return true;
  }

  function clearPrompt() {
    const nextTextSegment = createTextPromptSegment();
    commitPromptSegments([nextTextSegment]);
    setMention(null);
    clearHighlightedSelection();
    setExpanded(false);
    editorRef.current?.blur();
  }

  function focusEditor() {
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      if (editorRef.current && promptTextFromSegments(readEditorSegments()).length === 0) {
        placeCaretAtEnd(editorRef.current);
      }
    });
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center px-6">
      <div
        ref={containerRef}
        className={clsx(
          'pointer-events-auto relative overflow-visible transition-[width,max-width] duration-200 ease-out',
          isExpanded ? 'w-full max-w-[44rem]' : 'w-12 max-w-[3rem]',
        )}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (nextTarget && containerRef.current?.contains(nextTarget as Node)) {
            return;
          }
          if (!textValue.trim() && !selection && documentReferences.length === 0 && status === 'idle') {
            setExpanded(false);
          }
        }}
      >
        <ClarificationPopup />
        <ClaudeStreamPreview
          text={streamPreview.text}
          visible={streamPreview.visible}
          complete={streamPreview.complete}
          hasContent={streamPreview.hasContent}
          onDismiss={dismissStreamPreview}
        />
        {!promptVisible ? (
          <button
            type="button"
            aria-label="Open AI prompt"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-white p-2 shadow-[0_10px_30px_rgb(42_42_42_/_12%)] transition hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper"
            onClick={() => {
              setExpanded(true);
              setPromptVisible(true);
              if (!disabled && status !== 'streaming') pendingPromptFocus.current = true;
            }}
          >
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full rounded-full object-contain"
            />
          </button>
        ) : (
          <>
          {mentionMenuOpen ? (
            <div
              role="listbox"
              aria-label="Document suggestions"
              className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-72 overflow-auto rounded-lg border border-hairline bg-white p-1 shadow-[0_16px_40px_rgb(42_42_42_/_16%)]"
            >
              {filteredMentionDocuments.map((file, index) => (
                <button
                  key={file.path}
                  type="button"
                  role="option"
                  aria-selected={index === activeMentionIndex}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition',
                    index === activeMentionIndex
                      ? 'bg-[#e8f3ff] text-[#1f5d88]'
                      : 'text-ink hover:bg-highlight',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectMentionDocument(file);
                  }}
                >
                  <FileMdIcon size={17} weight="bold" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{file.relativePath}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div
            className="relative z-10 flex min-h-12 items-center gap-2 overflow-hidden rounded-[1.5rem] border border-hairline bg-white p-1 pr-12 shadow-[0_10px_30px_rgb(42_42_42_/_12%)] transition"
            onClick={() => {
              setExpanded(true);
              if (!disabled && status !== 'streaming') focusEditor();
            }}
          >
            {selectionLabel ? (
              <span
                aria-label={`Selected text: ${selectionLabel}`}
                className="ml-2 inline-flex h-8 max-w-[11rem] shrink-0 items-center gap-1 rounded-full bg-selection px-3 text-sm font-semibold leading-none text-success"
              >
                <span className="truncate">{selectionLabel}</span>
                <button
                  type="button"
                  aria-label="Clear selected text"
                  className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-success transition hover:bg-success/10 focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-1"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearHighlightedSelection();
                  }}
                >
                  <XIcon size={12} weight="bold" />
                </button>
              </span>
            ) : null}
            <div
              key={editorRevision}
              ref={editorRef}
              role="textbox"
              aria-label="AI prompt"
              contentEditable={!disabled && status !== 'streaming'}
              suppressContentEditableWarning
              autoCapitalize="off"
              spellCheck
              className="min-h-10 min-w-0 flex-1 whitespace-pre-wrap break-words rounded-[1.25rem] px-3 py-[0.45rem] text-base leading-normal text-ink focus:outline-none empty:before:text-chrome-text-soft disabled:opacity-50"
              onInput={syncEditorState}
              onClick={syncEditorState}
              onFocus={syncEditorState}
              onKeyDown={(event) => {
                if (mentionMenuOpen) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveMentionIndex((index) => (index + 1) % filteredMentionDocuments.length);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveMentionIndex(
                      (index) =>
                        (index - 1 + filteredMentionDocuments.length) %
                        filteredMentionDocuments.length,
                    );
                    return;
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const selected = filteredMentionDocuments[activeMentionIndex];
                    if (selected) selectMentionDocument(selected);
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setMention(null);
                    return;
                  }
                }

                if (event.key === 'Backspace' && removePreviousDocumentSegment()) {
                  event.preventDefault();
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                  return;
                }
                if (event.key === 'Escape' && status === 'idle') {
                  event.preventDefault();
                  clearPrompt();
                }
              }}
            >
              {segments.map((segment) =>
                segment.type === 'document' ? (
                  <span
                    key={segment.id}
                    data-segment-id={segment.id}
                    data-document-reference="true"
                    data-document-path={segment.reference.path}
                    data-document-relative-path={segment.reference.relativePath}
                    data-document-name={segment.reference.name}
                    contentEditable={false}
                    aria-label={`Referenced document: ${segment.reference.name}`}
                    className="relative -top-px mx-[0.18em] inline-flex h-6 max-w-[12rem] select-all items-center gap-0.5 rounded-md bg-[#e8f3ff] px-1.5 align-middle text-sm font-semibold leading-none text-[#1f5d88]"
                  >
                    <FileMdIcon size={14} weight="bold" className="shrink-0" />
                    <span className="truncate">{segment.reference.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${segment.reference.name} reference`}
                      className="-mr-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#1f5d88] transition hover:bg-[#cfe8ff] focus:outline-none focus:ring-2 focus:ring-[#7dbdeb] focus:ring-offset-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeDocumentSegment(segment.id);
                      }}
                    >
                      <XIcon size={12} weight="bold" />
                    </button>
                  </span>
                ) : (
                  <span key={segment.id} data-segment-id={segment.id} data-text-segment="true">
                    {segment.text}
                  </span>
                ),
              )}
            </div>
            {isExpanded ? (
              <div className="absolute bottom-1 right-1 z-20 inline-flex h-10 w-10 shrink-0">
                {status === 'streaming' ? (
                  <Button
                    aria-label="Cancel AI request"
                    variant="secondary"
                    className="h-10 w-10 rounded-full bg-paper/50 px-0"
                    onClick={() => void cancel()}
                    icon={<XIcon size={17} weight="bold" />}
                  />
                ) : disabledReason ? (
                  <Tooltip label={disabledReason}>
                    <span className="inline-flex h-10 w-10 shrink-0">
                      <Button
                        aria-label="Submit AI prompt"
                        disabled
                        className="!h-10 !w-10 !min-w-[2.5rem] !max-w-[2.5rem] shrink-0 !rounded-full !bg-black !p-0 !text-white"
                        icon={<PaperPlaneTiltIcon size={18} weight="fill" />}
                      />
                    </span>
                  </Tooltip>
                ) : (
                  <Button
                    aria-label="Submit AI prompt"
                    disabled={!textValue.trim() || disabled}
                    className="!h-10 !w-10 !min-w-[2.5rem] !max-w-[2.5rem] shrink-0 !rounded-full !bg-black !p-0 !text-white hover:!bg-[#1f1f1f]"
                    onClick={() => void submit()}
                    icon={<PaperPlaneTiltIcon size={18} weight="fill" />}
                  />
                )}
              </div>
            ) : null}
          </div>
          </>
        )}
        <ErrorState />
      </div>
    </div>
  );
}

function createTextPromptSegment(text = ''): TextPromptSegment {
  return {
    type: 'text',
    id: `text-${nextPromptSegmentId++}`,
    text,
  };
}

function createDocumentPromptSegment(reference: DocumentReference): DocumentPromptSegment {
  return {
    type: 'document',
    id: `document-${nextPromptSegmentId++}`,
    reference,
  };
}

function findActiveMention(text: string, cursor: number): MentionState | null {
  const beforeCursor = text.slice(0, cursor);
  const match = /(?:^|\s)@([^\s@]*)$/.exec(beforeCursor);
  if (!match) return null;

  const query = match[1];
  return {
    start: beforeCursor.length - query.length - 1,
    end: cursor,
    query,
  };
}

function normalizePromptSegments(segments: PromptSegment[]): PromptSegment[] {
  const normalized: PromptSegment[] = [];

  for (const segment of segments) {
    const previous = normalized[normalized.length - 1];
    if (segment.type === 'text' && previous?.type === 'text') {
      normalized[normalized.length - 1] = {
        ...previous,
        text: `${previous.text}${segment.text}`,
      };
      continue;
    }
    if (segment.type === 'text' && !segment.text && segments.length > 1) {
      normalized.push(segment);
      continue;
    }
    normalized.push(segment);
  }

  if (!normalized.some((segment) => segment.type === 'text')) {
    normalized.push(createTextPromptSegment());
  }

  return normalized;
}

function parseEditorSegments(editor: HTMLElement): PromptSegment[] {
  const segments: PromptSegment[] = [];
  for (const node of Array.from(editor.childNodes)) {
    appendNodeAsSegment(segments, node);
  }
  return normalizePromptSegments(segments);
}

function appendNodeAsSegment(segments: PromptSegment[], node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    appendTextSegment(segments, node.textContent ?? '');
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  if (node.dataset.documentReference === 'true') {
    segments.push({
      type: 'document',
      id: node.dataset.segmentId || `document-${nextPromptSegmentId++}`,
      reference: {
        path: node.dataset.documentPath ?? '',
        relativePath: node.dataset.documentRelativePath ?? '',
        name: node.dataset.documentName ?? '',
      },
    });
    return;
  }

  if (node.dataset.textSegment === 'true') {
    segments.push({
      type: 'text',
      id: node.dataset.segmentId || `text-${nextPromptSegmentId++}`,
      text: node.textContent ?? '',
    });
    return;
  }

  appendTextSegment(segments, node.textContent ?? '');
}

function appendTextSegment(segments: PromptSegment[], text: string) {
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous?.type === 'text') {
    previous.text += text;
    return;
  }
  segments.push(createTextPromptSegment(text));
}

function replaceTextRangeWithDocument(
  segments: PromptSegment[],
  start: number,
  end: number,
  documentSegment: DocumentPromptSegment,
  afterSegment: TextPromptSegment,
): PromptSegment[] {
  const next: PromptSegment[] = [];
  let cursor = 0;
  let inserted = false;

  for (const segment of segments) {
    if (segment.type === 'document') {
      next.push(segment);
      continue;
    }

    const segmentStart = cursor;
    const segmentEnd = cursor + segment.text.length;
    if (end <= segmentStart || start >= segmentEnd) {
      next.push(segment);
      cursor = segmentEnd;
      continue;
    }

    const before = segment.text.slice(0, Math.max(0, start - segmentStart));
    const after = segment.text.slice(Math.max(0, end - segmentStart));
    if (before) next.push({ ...segment, text: before });
    if (!inserted) {
      next.push(documentSegment);
      next.push({ ...afterSegment, text: after });
      inserted = true;
    } else if (after) {
      next.push(createTextPromptSegment(after));
    }
    cursor = segmentEnd;
  }

  if (!inserted) {
    next.push(documentSegment, afterSegment);
  }

  return normalizePromptSegments(next);
}

function documentReferencesFromSegments(segments: PromptSegment[]): DocumentReference[] {
  return segments
    .filter((segment): segment is DocumentPromptSegment => segment.type === 'document')
    .map((segment) => segment.reference);
}

function promptTextFromSegments(segments: PromptSegment[]): string {
  return segments
    .filter((segment): segment is TextPromptSegment => segment.type === 'text')
    .map((segment) => segment.text)
    .join('');
}

function promptValueFromSegments(segments: PromptSegment[]): string {
  return segments
    .map((segment, index) => {
      if (segment.type === 'text') return segment.text;

      const previous = segments[index - 1];
      const next = segments[index + 1];
      const prefix =
        previous?.type === 'text' && previous.text && !/\s$/.test(previous.text) ? ' ' : '';
      const suffix =
        next?.type === 'text' && next.text && !/^[\s,.;:!?)]/.test(next.text) ? ' ' : '';
      return `${prefix}@${segment.reference.name}${suffix}`;
    })
    .join('');
}

function firstTextSegmentId(segments: PromptSegment[]): string | null {
  return segments.find((segment) => segment.type === 'text')?.id ?? null;
}

function lastDocumentSegmentIn(segments: PromptSegment[]): DocumentPromptSegment | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment.type === 'document') return segment;
  }
  return null;
}

function textOffsetFromSelection(editor: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!selection.isCollapsed || !editor.contains(range.startContainer)) return null;
  return textOffsetToPosition(editor, range.startContainer, range.startOffset);
}

function textOffsetToPosition(root: Node, target: Node, targetOffset: number): number {
  let offset = 0;
  let found = false;

  function walk(node: Node) {
    if (found) return;

    if (node === target) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += targetOffset;
      } else {
        const children = Array.from(node.childNodes).slice(0, targetOffset);
        for (const child of children) offset += textLength(child);
      }
      found = true;
      return;
    }

    if (isDocumentChip(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0;
      return;
    }

    for (const child of Array.from(node.childNodes)) walk(child);
  }

  walk(root);
  return offset;
}

function textLength(node: Node): number {
  if (isDocumentChip(node)) return 0;
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  return Array.from(node.childNodes).reduce((length, child) => length + textLength(child), 0);
}

function isDocumentChip(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.dataset.documentReference === 'true';
}

function documentSegmentIdBeforeSelection(editor: HTMLElement): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;

  let node: Node | null = null;
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    if (range.startOffset > 0) return null;
    node = previousSiblingBefore(range.startContainer);
  } else {
    node = range.startContainer.childNodes[Math.max(0, range.startOffset - 1)] ?? null;
  }

  while (node) {
    if (isEmptyTextLikeNode(node)) {
      node = previousSiblingBefore(node);
      continue;
    }
    return isDocumentChip(node) ? node.dataset.segmentId ?? null : null;
  }

  return null;
}

function previousSiblingBefore(node: Node): Node | null {
  if (node.previousSibling) return node.previousSibling;
  const parent = node.parentNode;
  if (!parent || parent instanceof HTMLDivElement) return null;
  return parent.previousSibling;
}

function isEmptyTextLikeNode(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return !(node.textContent ?? '');
  if (node instanceof HTMLElement && node.dataset.textSegment === 'true') {
    return !(node.textContent ?? '');
  }
  return false;
}

function placeCaretInsideTextSegment(segment: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(segment);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  segment.closest<HTMLElement>('[contenteditable="true"]')?.focus();
}

function placeCaretAtEnd(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function documentReferenceFromFile(file: MarkdownFile): DocumentReference {
  return {
    path: file.path,
    relativePath: file.relativePath,
    name: file.name,
  };
}

function claudeDisabledReason(status: ReturnType<typeof usePreflightStore.getState>['availability']['status']) {
  switch (status) {
    case 'checking':
      return 'Checking Claude Code setup';
    case 'missing':
      return 'Install Claude Code to enable AI edits';
    case 'login_required':
      return 'Run claude login, then re-check to enable AI edits';
    case 'check_failed':
      return 'Re-check Claude Code in Settings to enable AI edits';
    case 'ready':
      return null;
  }
}
