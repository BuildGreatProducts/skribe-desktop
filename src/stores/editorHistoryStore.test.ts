import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorHistoryStore } from './editorHistoryStore';

describe('editorHistoryStore', () => {
  afterEach(() => {
    useEditorHistoryStore.getState().clear();
  });

  it('clears availability without forcing disabled', () => {
    useEditorHistoryStore.setState({ disabled: false, canUndo: true, canRedo: true });
    useEditorHistoryStore.getState().clear();

    expect(useEditorHistoryStore.getState().canUndo).toBe(false);
    expect(useEditorHistoryStore.getState().canRedo).toBe(false);
    expect(useEditorHistoryStore.getState().disabled).toBe(false);
  });

  it('delegates undo and redo to the registered editor api', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const refresh = vi.fn();

    useEditorHistoryStore.getState().register({ undo, redo, refresh });
    useEditorHistoryStore.getState().undo();
    useEditorHistoryStore.getState().redo();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stays enabled after clear and re-register when setDisabled is called', () => {
    useEditorHistoryStore.setState({ disabled: false, canUndo: true, canRedo: false });
    useEditorHistoryStore.getState().clear();
    useEditorHistoryStore.getState().register({
      undo: vi.fn(),
      redo: vi.fn(),
      refresh: vi.fn(),
    });
    useEditorHistoryStore.getState().setDisabled(false);

    expect(useEditorHistoryStore.getState().disabled).toBe(false);
  });

  it('refreshes availability when disabled state changes', () => {
    const refresh = vi.fn();

    useEditorHistoryStore.getState().register({
      undo: vi.fn(),
      redo: vi.fn(),
      refresh,
    });
    refresh.mockClear();

    useEditorHistoryStore.getState().setDisabled(false);

    expect(useEditorHistoryStore.getState().disabled).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
