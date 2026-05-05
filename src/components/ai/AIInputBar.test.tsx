import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '../../stores/aiStore';
import { useEditorStore } from '../../stores/editorStore';
import { useFolderStore } from '../../stores/folderStore';
import { usePreflightStore } from '../../stores/preflightStore';
import { AIInputBar } from './AIInputBar';

const filePath = '/tmp/project/README.md';
const files = [
  {
    path: filePath,
    relativePath: 'README.md',
    name: 'README.md',
    size: 12,
    modifiedAt: 1,
  },
  {
    path: '/tmp/project/docs/Brief.md',
    relativePath: 'docs/Brief.md',
    name: 'Brief.md',
    size: 24,
    modifiedAt: 2,
  },
  {
    path: '/tmp/project/Notes.md',
    relativePath: 'Notes.md',
    name: 'Notes.md',
    size: 36,
    modifiedAt: 3,
  },
];
const highlightedSelection = {
  filePath,
  from: 1,
  to: 14,
  text: 'selected text',
};

function promptEditor() {
  return screen.getByRole('textbox', { name: 'AI prompt' });
}

function setPromptText(text: string, cursor = text.length) {
  const editor = promptEditor();
  const textSegment = editor.querySelector<HTMLElement>('[data-text-segment="true"]');
  if (textSegment) {
    textSegment.textContent = text;
    const textNode = textSegment.firstChild;
    if (textNode) {
      const range = document.createRange();
      range.setStart(textNode, cursor);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  } else {
    editor.textContent = text;
  }
  fireEvent.input(editor);
  return editor;
}

function appendPromptText(text: string) {
  const editor = promptEditor();
  const textSegments = Array.from(
    editor.querySelectorAll<HTMLElement>('[data-text-segment="true"]'),
  );
  const textSegment = textSegments[textSegments.length - 1];
  if (textSegment) {
    textSegment.textContent = `${textSegment.textContent ?? ''}${text}`;
  } else {
    editor.appendChild(document.createTextNode(text));
  }
  fireEvent.input(editor);
  return editor;
}

function appendRootPromptText(text: string) {
  const editor = promptEditor();
  editor.appendChild(document.createTextNode(text));

  const range = document.createRange();
  range.setStart(editor, editor.childNodes.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  fireEvent.input(editor);
  return editor;
}

describe('AIInputBar selection collapse behavior', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useFolderStore.setState({ path: '/tmp/project', files });
    useEditorStore.setState({ filePath, highlightedSelection });
    usePreflightStore.setState({
      availability: {
        status: 'ready',
        installed: true,
        version: '1.0.0',
        loggedIn: null,
        lastCheckedAt: 1,
        error: null,
      },
    });
    useAiStore.setState({
      status: 'idle',
      prompt: '',
      partialResponse: '',
      streamPreview: {
        text: '',
        visible: false,
        complete: false,
        hasContent: false,
      },
      pendingClarification: null,
      error: null,
      startSession: vi.fn(async () => undefined),
      submitPrompt: vi.fn(async () => undefined),
      cancel: vi.fn(async () => undefined),
      dismissStreamPreview: vi.fn(),
    });
  });

  it('clears the selected text and collapses when clicking outside a selection-opened prompt', () => {
    render(<AIInputBar />);

    expect(screen.getByLabelText('Selected text: selected t...')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(useEditorStore.getState().highlightedSelection).toBeNull();
    expect(promptEditor()).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('button', { name: 'Open AI prompt' })).toBeInTheDocument();
  });

  it('collapses after the chip is cleared and the user clicks outside', () => {
    render(<AIInputBar />);

    fireEvent.click(promptEditor());
    fireEvent.click(screen.getByRole('button', { name: 'Clear selected text' }));

    expect(promptEditor()).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(promptEditor()).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('button', { name: 'Open AI prompt' })).toBeInTheDocument();
  });

  it('focuses the prompt when opened from the icon button', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));

    expect(promptEditor()).toHaveFocus();
  });

  it('does not duplicate text while the user types into the prompt', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    const submitPrompt = vi.fn(async () => undefined);
    useAiStore.setState({ submitPrompt });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    appendRootPromptText('H');
    appendRootPromptText('e');
    appendRootPromptText('l');
    appendRootPromptText('l');
    appendRootPromptText('o');

    expect(promptEditor()).toHaveTextContent('Hello');

    fireEvent.click(screen.getByRole('button', { name: 'Submit AI prompt' }));

    expect(submitPrompt).toHaveBeenCalledWith('Hello', filePath, { type: 'document' }, []);
  });

  it('opens document suggestions with @ and excludes the active document', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptText('@');

    expect(screen.getByRole('listbox', { name: 'Document suggestions' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'docs/Brief.md' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Notes.md' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'README.md' })).not.toBeInTheDocument();
  });

  it('does not duplicate browser-owned text when adding a document chip', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    for (const character of 'Use @brief') appendRootPromptText(character);

    fireEvent.keyDown(promptEditor(), { key: 'Enter' });

    expect(screen.getByLabelText('Referenced document: Brief.md')).toBeInTheDocument();
    expect(promptEditor().textContent).toBe('Use Brief.md');
    expect(promptEditor()).not.toHaveTextContent('@brief');
    expect(promptEditor()).not.toHaveTextContent('Use @brief');
  });

  it('does not restore deleted text after the prompt closes and reopens', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const editor = setPromptText('Use @brief');
    fireEvent.keyDown(editor, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Brief.md reference' }));

    setPromptText('');
    fireEvent.pointerDown(document.body);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));

    expect(promptEditor().textContent).toBe('');
  });

  it('filters document suggestions by name or relative path', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptText('@brief');

    expect(screen.getByRole('option', { name: 'docs/Brief.md' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Notes.md' })).not.toBeInTheDocument();
  });

  it('selects a document with arrows and Enter, then submits references', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    const submitPrompt = vi.fn(async () => undefined);
    useAiStore.setState({ submitPrompt });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const editor = setPromptText('@');
    fireEvent.keyDown(editor, { key: 'ArrowDown' });
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(screen.getByLabelText('Referenced document: Notes.md')).toBeInTheDocument();
    expect(promptEditor()).toHaveTextContent('Notes.md');

    appendPromptText('rewrite the intro');
    fireEvent.click(screen.getByRole('button', { name: 'Submit AI prompt' }));

    expect(submitPrompt).toHaveBeenCalledWith(
      '@Notes.md rewrite the intro',
      filePath,
      { type: 'document' },
      [
        {
          name: 'Notes.md',
          relativePath: 'Notes.md',
          path: '/tmp/project/Notes.md',
        },
      ],
    );
  });

  it('keeps document chips inline in the middle of a sentence', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    const submitPrompt = vi.fn(async () => undefined);
    useAiStore.setState({ submitPrompt });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const editor = setPromptText('Use @brief');
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(promptEditor()).toHaveTextContent('Use ');
    expect(screen.getByLabelText('Referenced document: Brief.md')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'AI prompt' })).toHaveLength(1);

    appendPromptText(' for tone');
    fireEvent.click(screen.getByRole('button', { name: 'Submit AI prompt' }));

    expect(submitPrompt).toHaveBeenCalledWith(
      'Use @Brief.md for tone',
      filePath,
      { type: 'document' },
      [
        {
          name: 'Brief.md',
          relativePath: 'docs/Brief.md',
          path: '/tmp/project/docs/Brief.md',
        },
      ],
    );
  });

  it('replaces the typed @ query without leaving stale characters behind', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    const submitPrompt = vi.fn(async () => undefined);
    useAiStore.setState({ submitPrompt });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const editor = setPromptText('Test @briefHere', 'Test @brief'.length);
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(promptEditor()).toHaveTextContent('Test ');
    expect(promptEditor()).toHaveTextContent('Here');
    expect(screen.getByLabelText('Referenced document: Brief.md')).toBeInTheDocument();
    expect(promptEditor()).not.toHaveTextContent('@brief');

    fireEvent.click(screen.getByRole('button', { name: 'Submit AI prompt' }));

    expect(submitPrompt).toHaveBeenCalledWith(
      'Test @Brief.md Here',
      filePath,
      { type: 'document' },
      [
        {
          name: 'Brief.md',
          relativePath: 'docs/Brief.md',
          path: '/tmp/project/docs/Brief.md',
        },
      ],
    );
  });

  it('renders removable document chips', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptText('@brief');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'docs/Brief.md' }));

    expect(screen.getByLabelText('Referenced document: Brief.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Brief.md reference' }));

    expect(screen.queryByLabelText('Referenced document: Brief.md')).not.toBeInTheDocument();
  });

  it('removes the last document chip with Backspace when the prompt is empty', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const editor = setPromptText('@brief');
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(screen.getByLabelText('Referenced document: Brief.md')).toBeInTheDocument();

    fireEvent.keyDown(promptEditor(), { key: 'Backspace' });

    expect(screen.queryByLabelText('Referenced document: Brief.md')).not.toBeInTheDocument();
  });
});
