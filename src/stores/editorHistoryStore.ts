import { create } from 'zustand';

type EditorHistoryApi = {
  undo: () => void;
  redo: () => void;
  refresh: () => void;
};

type EditorHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  register: (api: EditorHistoryApi) => void;
  setDisabled: (disabled: boolean) => void;
  refresh: () => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
};

let api: EditorHistoryApi | null = null;

export const useEditorHistoryStore = create<EditorHistoryState>((set, get) => ({
  canUndo: false,
  canRedo: false,
  disabled: true,
  register: (nextApi) => {
    api = nextApi;
    nextApi.refresh();
  },
  setDisabled: (disabled) => {
    set({ disabled });
    get().refresh();
  },
  refresh: () => {
    api?.refresh();
  },
  clear: () => {
    api = null;
    set({ canUndo: false, canRedo: false });
  },
  undo: () => {
    api?.undo();
  },
  redo: () => {
    api?.redo();
  },
}));

export function setEditorHistoryAvailability(canUndo: boolean, canRedo: boolean) {
  useEditorHistoryStore.setState({ canUndo, canRedo });
}
