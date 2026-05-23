import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './editorStore';

vi.mock('../lib/tauri', () => ({
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  tauriClient: {
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  },
}));

const filePath = '/tmp/project/README.md';

const selection = {
  filePath,
  from: 1,
  to: 6,
  text: 'hello',
};

const insertion = {
  filePath,
  pos: 12,
  blockBefore: 'before',
  blockAfter: 'after',
};

describe('editorStore insertion point', () => {
  beforeEach(() => {
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
      insertionPoint: null,
    });
  });

  it('stores an insertion point and clears any existing highlighted selection', () => {
    useEditorStore.setState({ highlightedSelection: selection });
    useEditorStore.getState().setInsertionPoint(insertion);

    expect(useEditorStore.getState().insertionPoint).toEqual(insertion);
    expect(useEditorStore.getState().highlightedSelection).toBeNull();
  });

  it('clears the insertion point when a new highlighted selection is set', () => {
    useEditorStore.getState().setInsertionPoint(insertion);
    useEditorStore.getState().setHighlightedSelection(selection);

    expect(useEditorStore.getState().highlightedSelection).toEqual(selection);
    expect(useEditorStore.getState().insertionPoint).toBeNull();
  });

  it('clears the insertion point explicitly without touching other state', () => {
    useEditorStore.setState({ insertionPoint: insertion });
    useEditorStore.getState().clearInsertionPoint();

    expect(useEditorStore.getState().insertionPoint).toBeNull();
    expect(useEditorStore.getState().filePath).toBe(filePath);
  });
});
