import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '../../stores/aiStore';
import { useEditorStore } from '../../stores/editorStore';
import { useFolderStore } from '../../stores/folderStore';
import { usePreflightStore } from '../../stores/preflightStore';
import { AIInputBar } from './AIInputBar';

const tauriMocks = vi.hoisted(() => ({
  describeAttachments: vi.fn(),
  isTauri: vi.fn(),
  onDragDropEvent: vi.fn(),
  open: vi.fn(),
}));

vi.mock('../../lib/tauri', () => ({
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  tauriClient: {
    acp: {
      cancel: vi.fn(async () => undefined),
      respondClarification: vi.fn(async () => undefined),
      sendPrompt: vi.fn(async () => undefined),
      start: vi.fn(async () => ({ sessionId: 'session-1' })),
      stop: vi.fn(async () => undefined),
    },
    fs: {
      createFile: vi.fn(),
      deleteFile: vi.fn(),
      describeAttachments: tauriMocks.describeAttachments,
      listMarkdownFiles: vi.fn(),
      pickFolder: vi.fn(),
      readFile: vi.fn(),
      renameFile: vi.fn(),
      unwatchFolder: vi.fn(),
      watchFolder: vi.fn(),
      writeFile: vi.fn(),
    },
    settings: {
      addRecentFolder: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
    },
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: tauriMocks.isTauri,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: tauriMocks.onDragDropEvent,
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: tauriMocks.open,
}));

const filePath = '/tmp/project/README.md';
const imageAttachment = {
  path: '/tmp/project/image.png',
  name: 'image.png',
  size: 1536,
  kind: 'image' as const,
  mimeType: 'image/png',
  previewDataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
};
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

function promptShell() {
  const shell = promptSurface().parentElement;
  if (!shell) throw new Error('Prompt shell not found');
  return shell;
}

function promptSurface() {
  const attachButton = screen.getByRole('button', { name: 'Attach files' });
  const surface = attachButton.closest('div');
  if (!surface) throw new Error('Prompt surface not found');
  return surface;
}

function promptAction() {
  const action = screen.getByRole('button', {
    name: 'Submit AI prompt',
  }).parentElement;
  if (!action) throw new Error('Prompt action not found');
  return action;
}

function promptPlusIcon() {
  const plus = screen.getByRole('button', { name: 'Attach files' });
  const iconWrapper = plus.parentElement?.parentElement;
  if (!iconWrapper) throw new Error('Prompt plus icon wrapper not found');
  return iconWrapper;
}

function setPromptSurfaceRect(surface: HTMLElement) {
  Object.defineProperty(surface, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: 80,
      height: 70,
      left: 10,
      right: 410,
      top: 10,
      width: 400,
      x: 10,
      y: 10,
      toJSON: () => undefined,
    }),
  });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function finishPromptCollapse() {
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

function setPromptText(text: string, cursor = text.length) {
  const editor = promptEditor();
  const textSegment = editor.querySelector<HTMLElement>(
    '[data-text-segment="true"]',
  );
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
    vi.restoreAllMocks();
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
      promptFilePath: null,
      promptDocumentReferences: [],
      promptAttachments: [],
      startSession: vi.fn(async () => undefined),
      submitPrompt: vi.fn(async () => undefined),
      cancel: vi.fn(async () => undefined),
      dismissStreamPreview: vi.fn(),
    });
    tauriMocks.isTauri.mockReturnValue(false);
    tauriMocks.open.mockResolvedValue(null);
    tauriMocks.describeAttachments.mockResolvedValue([]);
    tauriMocks.onDragDropEvent.mockResolvedValue(() => undefined);
  });

  it('starts closed when a document is already open', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    expect(
      screen.getByRole('button', { name: 'Open AI prompt' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'AI prompt' }),
    ).not.toBeInTheDocument();
  });

  it('stays closed while the background Claude session starts', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    useAiStore.setState({ status: 'submitting', promptFilePath: null });
    render(<AIInputBar />);

    expect(
      screen.getByRole('button', { name: 'Open AI prompt' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'AI prompt' }),
    ).not.toBeInTheDocument();
  });

  it('closes the prompt immediately when a document opens', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));

    expect(promptEditor()).toBeInTheDocument();

    act(() => {
      useEditorStore.setState({
        filePath: '/tmp/project/docs/Brief.md',
        highlightedSelection: null,
      });
    });

    expect(
      screen.getByRole('button', { name: 'Open AI prompt' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'AI prompt' }),
    ).not.toBeInTheDocument();
  });

  it('clears the selected text and collapses when clicking outside a selection-opened prompt', () => {
    render(<AIInputBar />);

    expect(
      screen.getByLabelText('Selected text: selected t...'),
    ).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(useEditorStore.getState().highlightedSelection).toBeNull();
    expect(promptEditor()).toBeInTheDocument();

    finishPromptCollapse();

    expect(
      screen.getByRole('button', { name: 'Open AI prompt' }),
    ).toBeInTheDocument();
  });

  it('collapses after the chip is cleared and the user clicks outside', () => {
    render(<AIInputBar />);

    fireEvent.click(promptEditor());
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear selected text' }),
    );

    expect(promptEditor()).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(promptEditor()).toBeInTheDocument();

    finishPromptCollapse();

    expect(
      screen.getByRole('button', { name: 'Open AI prompt' }),
    ).toBeInTheDocument();
  });

  it('focuses the prompt when opened from the icon button', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));

    expect(promptEditor()).toHaveFocus();
  });

  it('hides plus and submit icons until the shell finishes animating', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const shell = promptShell();
    const surface = promptSurface();
    const plusIcon = promptPlusIcon();
    const submitIcon = promptAction();
    expect(shell).toHaveClass('max-w-[44rem]');
    expect(surface).toHaveClass('h-12');
    expect(surface).toHaveClass('flex-nowrap');
    expect(surface).toHaveClass('ring-1');
    expect(surface).not.toHaveClass('border');
    expect(
      screen.getByRole('button', { name: 'Attach files' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit AI prompt' }),
    ).toBeInTheDocument();
    expect(plusIcon).toHaveClass('opacity-0');
    expect(submitIcon).toHaveClass('opacity-0');

    finishPromptCollapse();

    expect(plusIcon).toHaveClass('opacity-100');
    expect(submitIcon).toHaveClass('opacity-100');
    expect(surface).toHaveClass('flex-wrap');

    fireEvent.pointerDown(document.body);

    expect(promptEditor()).toBeInTheDocument();
    expect(plusIcon).toHaveClass('opacity-0');
    expect(submitIcon).toHaveClass('opacity-0');
    expect(shell).toHaveClass('max-w-[44rem]');
    expect(surface).toHaveClass('h-12');
    expect(surface).toHaveClass('flex-nowrap');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(shell).toHaveClass('max-w-[3rem]');

    finishPromptCollapse();

    expect(
      screen.getByRole('button', { name: 'Open AI prompt' }),
    ).toBeInTheDocument();
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

    expect(submitPrompt).toHaveBeenCalledWith(
      'Hello',
      filePath,
      { type: 'document' },
      [],
      [],
    );
  });

  it('normalizes the browser empty block after deleting all prompt text', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const editor = setPromptText('Draft this');
    editor.focus();
    editor.innerHTML = '<div><br></div>';

    fireEvent.input(editor);

    const normalizedEditor = promptEditor();
    expect(normalizedEditor).toHaveFocus();
    expect(normalizedEditor.querySelector('div')).toBeNull();
    expect(
      normalizedEditor.querySelectorAll('[data-text-segment="true"]'),
    ).toHaveLength(1);
    expect(normalizedEditor).toHaveTextContent('');
  });

  it('adds picker attachments as compact chips and ignores duplicate paths', async () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    tauriMocks.open.mockResolvedValue([
      '/tmp/project/image.png',
      '/tmp/project/image.png',
    ]);
    tauriMocks.describeAttachments.mockResolvedValue([
      imageAttachment,
      imageAttachment,
    ]);
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }));
    await flushPromises();

    expect(screen.getAllByLabelText('Attached file: image.png')).toHaveLength(
      1,
    );
    expect(tauriMocks.describeAttachments).toHaveBeenCalledWith([
      '/tmp/project/image.png',
    ]);
  });

  it('keeps the empty prompt open while the attachment picker takes focus', async () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    tauriMocks.open.mockResolvedValue(null);
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const attachButton = screen.getByRole('button', { name: 'Attach files' });
    fireEvent.mouseDown(attachButton);
    fireEvent.blur(promptEditor(), { relatedTarget: null });

    finishPromptCollapse();

    expect(promptEditor()).toBeInTheDocument();

    fireEvent.click(attachButton);
    await flushPromises();

    expect(tauriMocks.open).toHaveBeenCalledWith({
      multiple: true,
      directory: false,
      title: 'Attach files',
    });
    expect(promptEditor()).toBeInTheDocument();
  });

  it('removes attachment chips before submitting', async () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    const submitPrompt = vi.fn(async () => undefined);
    useAiStore.setState({ submitPrompt });
    tauriMocks.open.mockResolvedValue(['/tmp/project/image.png']);
    tauriMocks.describeAttachments.mockResolvedValue([imageAttachment]);
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }));
    await flushPromises();
    expect(
      screen.getByLabelText('Attached file: image.png'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove image.png attachment' }),
    );
    expect(
      screen.queryByLabelText('Attached file: image.png'),
    ).not.toBeInTheDocument();

    setPromptText('Use this for context');
    fireEvent.click(screen.getByRole('button', { name: 'Submit AI prompt' }));

    expect(submitPrompt).toHaveBeenCalledWith(
      'Use this for context',
      filePath,
      { type: 'document' },
      [],
      [],
    );
  });

  it('submits attachments with document references', async () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    const submitPrompt = vi.fn(async () => undefined);
    useAiStore.setState({ submitPrompt });
    tauriMocks.open.mockResolvedValue(['/tmp/project/image.png']);
    tauriMocks.describeAttachments.mockResolvedValue([imageAttachment]);
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }));
    await flushPromises();
    expect(
      screen.getByLabelText('Attached file: image.png'),
    ).toBeInTheDocument();

    const editor = setPromptText('Use @brief');
    fireEvent.keyDown(editor, { key: 'Enter' });
    appendPromptText(' for the caption');
    fireEvent.click(screen.getByRole('button', { name: 'Submit AI prompt' }));

    expect(submitPrompt).toHaveBeenCalledWith(
      'Use @Brief.md for the caption',
      filePath,
      { type: 'document' },
      [
        {
          name: 'Brief.md',
          relativePath: 'docs/Brief.md',
          path: '/tmp/project/docs/Brief.md',
        },
      ],
      [imageAttachment],
    );
  });

  it('attaches dropped files inside the composer', async () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    let dragDropHandler: ((event: { payload: unknown }) => void) | null = null;
    tauriMocks.isTauri.mockReturnValue(true);
    tauriMocks.onDragDropEvent.mockImplementation(async (handler) => {
      dragDropHandler = handler;
      return () => undefined;
    });
    tauriMocks.describeAttachments.mockResolvedValue([imageAttachment]);
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptSurfaceRect(promptSurface());
    await flushPromises();
    expect(dragDropHandler).not.toBeNull();

    act(() => {
      dragDropHandler?.({
        payload: {
          type: 'drop',
          paths: ['/tmp/project/image.png'],
          position: { x: 20, y: 20 },
        },
      });
    });
    await flushPromises();

    expect(
      screen.getByLabelText('Attached file: image.png'),
    ).toBeInTheDocument();
  });

  it('attaches files dropped directly onto the prompt when paths are available', async () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    tauriMocks.describeAttachments.mockResolvedValue([imageAttachment]);
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    fireEvent.drop(promptSurface(), {
      dataTransfer: {
        files: [{ path: '/tmp/project/image.png' }],
        types: ['Files'],
      },
    });
    await flushPromises();

    expect(tauriMocks.describeAttachments).toHaveBeenCalledWith([
      '/tmp/project/image.png',
    ]);
    expect(
      screen.getByLabelText('Attached file: image.png'),
    ).toBeInTheDocument();
  });

  it('ignores dropped files outside the composer', async () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    let dragDropHandler: ((event: { payload: unknown }) => void) | null = null;
    tauriMocks.isTauri.mockReturnValue(true);
    tauriMocks.onDragDropEvent.mockImplementation(async (handler) => {
      dragDropHandler = handler;
      return () => undefined;
    });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptSurfaceRect(promptSurface());
    await flushPromises();
    expect(dragDropHandler).not.toBeNull();

    act(() => {
      dragDropHandler?.({
        payload: {
          type: 'drop',
          paths: ['/tmp/project/image.png'],
          position: { x: 1000, y: 1000 },
        },
      });
    });

    expect(tauriMocks.describeAttachments).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText('Attached file: image.png'),
    ).not.toBeInTheDocument();
  });

  it('retries with stored document references and attachments', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    const submitPrompt = vi.fn(async () => undefined);
    const documentReferences = [
      {
        name: 'Brief.md',
        relativePath: 'docs/Brief.md',
        path: '/tmp/project/docs/Brief.md',
      },
    ];
    useAiStore.setState({
      error: {
        code: 'CLAUDE_UNKNOWN_ERROR',
        message: 'Claude Code reported an error.',
      },
      prompt: 'Try again',
      promptFilePath: filePath,
      promptTarget: { type: 'document' },
      promptDocumentReferences: documentReferences,
      promptAttachments: [imageAttachment],
      submitPrompt,
    });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(submitPrompt).toHaveBeenCalledWith(
      'Try again',
      filePath,
      { type: 'document' },
      documentReferences,
      [imageAttachment],
    );
  });

  it('opens document suggestions with @ and excludes the active document', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptText('@');

    expect(
      screen.getByRole('listbox', { name: 'Document suggestions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'docs/Brief.md' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Notes.md' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'README.md' }),
    ).not.toBeInTheDocument();
  });

  it('does not duplicate browser-owned text when adding a document chip', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    for (const character of 'Use @brief') appendRootPromptText(character);

    fireEvent.keyDown(promptEditor(), { key: 'Enter' });

    expect(
      screen.getByLabelText('Referenced document: Brief.md'),
    ).toBeInTheDocument();
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Brief.md reference' }),
    );

    setPromptText('');
    fireEvent.pointerDown(document.body);

    finishPromptCollapse();

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));

    expect(promptEditor().textContent).toBe('');
  });

  it('filters document suggestions by name or relative path', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptText('@brief');

    expect(
      screen.getByRole('option', { name: 'docs/Brief.md' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Notes.md' }),
    ).not.toBeInTheDocument();
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

    expect(
      screen.getByLabelText('Referenced document: Notes.md'),
    ).toBeInTheDocument();
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
      [],
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
    expect(
      screen.getByLabelText('Referenced document: Brief.md'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'AI prompt' })).toHaveLength(
      1,
    );

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
      [],
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
    expect(
      screen.getByLabelText('Referenced document: Brief.md'),
    ).toBeInTheDocument();
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
      [],
    );
  });

  it('renders removable document chips', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    setPromptText('@brief');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'docs/Brief.md' }));

    expect(
      screen.getByLabelText('Referenced document: Brief.md'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Brief.md reference' }),
    );

    expect(
      screen.queryByLabelText('Referenced document: Brief.md'),
    ).not.toBeInTheDocument();
  });

  it('removes the last document chip with Backspace when the prompt is empty', () => {
    useEditorStore.setState({ filePath, highlightedSelection: null });
    render(<AIInputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI prompt' }));
    const editor = setPromptText('@brief');
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(
      screen.getByLabelText('Referenced document: Brief.md'),
    ).toBeInTheDocument();

    fireEvent.keyDown(promptEditor(), { key: 'Backspace' });

    expect(
      screen.queryByLabelText('Referenced document: Brief.md'),
    ).not.toBeInTheDocument();
  });
});
