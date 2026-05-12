import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './editorStore';

const tauriMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../lib/tauri', () => ({
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  tauriClient: {
    fs: {
      readFile: tauriMocks.readFile,
      writeFile: tauriMocks.writeFile,
    },
  },
}));

const filePath = '/tmp/project/README.md';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('editorStore saving', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tauriMocks.readFile.mockReset();
    tauriMocks.writeFile.mockReset();
    useEditorStore.setState({
      filePath,
      content: 'Draft',
      originalContent: 'Draft',
      pendingSaveContent: null,
      isDirty: false,
      lastSavedAt: null,
      saveStatus: 'saved',
      loading: false,
      error: null,
      saveTimer: null,
      highlightedSelection: null,
    });
  });

  afterEach(() => {
    window.clearTimeout(useEditorStore.getState().saveTimer ?? undefined);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not mark the editor clean when typing continues during a save', async () => {
    const firstSave = deferred<void>();
    tauriMocks.writeFile.mockReturnValueOnce(firstSave.promise);
    useEditorStore.setState({
      content: 'Draft A',
      originalContent: 'Draft',
      isDirty: true,
      saveStatus: 'editing',
    });

    const savePromise = useEditorStore.getState().save();

    expect(useEditorStore.getState().pendingSaveContent).toBe('Draft A');

    useEditorStore.getState().setContent('Draft AB');
    firstSave.resolve();
    await savePromise;

    expect(tauriMocks.writeFile).toHaveBeenCalledWith(filePath, 'Draft A');
    expect(useEditorStore.getState()).toMatchObject({
      content: 'Draft AB',
      originalContent: 'Draft A',
      pendingSaveContent: null,
      isDirty: true,
      saveStatus: 'editing',
    });
  });

  it('marks the editor clean when the saved content is still current', async () => {
    tauriMocks.writeFile.mockResolvedValueOnce(undefined);
    useEditorStore.setState({
      content: 'Draft A',
      originalContent: 'Draft',
      isDirty: true,
      saveStatus: 'editing',
    });

    await useEditorStore.getState().save();

    expect(useEditorStore.getState()).toMatchObject({
      content: 'Draft A',
      originalContent: 'Draft A',
      pendingSaveContent: null,
      isDirty: false,
      saveStatus: 'saved',
    });
  });
});
