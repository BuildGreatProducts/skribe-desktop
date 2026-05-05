import { create } from 'zustand';
import { errorMessage, tauriClient } from '../lib/tauri';
import type { HighlightedTextSelection, SaveStatus } from '../types';

type EditorState = {
  filePath: string | null;
  content: string;
  originalContent: string;
  isDirty: boolean;
  lastSavedAt: number | null;
  saveStatus: SaveStatus;
  loading: boolean;
  error: string | null;
  saveTimer: number | null;
  highlightedSelection: HighlightedTextSelection | null;
  openFile: (filePath: string) => Promise<void>;
  closeFile: () => void;
  setContent: (content: string, options?: { skipAutosave?: boolean }) => void;
  save: () => Promise<void>;
  saveNow: () => Promise<void>;
  applyExternalContent: (content: string) => void;
  setHighlightedSelection: (selection: HighlightedTextSelection) => void;
  clearHighlightedSelection: () => void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  filePath: null,
  content: '',
  originalContent: '',
  isDirty: false,
  lastSavedAt: null,
  saveStatus: 'idle',
  loading: false,
  error: null,
  saveTimer: null,
  highlightedSelection: null,
  openFile: async (filePath) => {
    set({ loading: true, error: null });
    try {
      const content = await tauriClient.fs.readFile(filePath);
      window.clearTimeout(get().saveTimer ?? undefined);
      set({
        filePath,
        content,
        originalContent: content,
        isDirty: false,
        loading: false,
        saveStatus: 'saved',
        saveTimer: null,
        highlightedSelection: null,
      });
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
    }
  },
  closeFile: () => {
    window.clearTimeout(get().saveTimer ?? undefined);
    set({
      filePath: null,
      content: '',
      originalContent: '',
      isDirty: false,
      saveStatus: 'idle',
      saveTimer: null,
      highlightedSelection: null,
    });
  },
  setContent: (content, options) => {
    window.clearTimeout(get().saveTimer ?? undefined);
    const saveTimer = options?.skipAutosave
      ? null
      : window.setTimeout(() => {
          void get().save();
        }, 500);
    set({
      content,
      isDirty: true,
      saveStatus: 'editing',
      saveTimer,
    });
  },
  save: async () => {
    const { filePath, content } = get();
    if (!filePath) return;
    set({ saveStatus: 'saving' });
    try {
      await tauriClient.fs.writeFile(filePath, content);
      set({
        isDirty: false,
        lastSavedAt: Date.now(),
        saveStatus: 'saved',
        originalContent: content,
      });
    } catch (error) {
      set({ saveStatus: 'error', error: errorMessage(error) });
    }
  },
  saveNow: async () => {
    window.clearTimeout(get().saveTimer ?? undefined);
    set({ saveTimer: null });
    await get().save();
  },
  applyExternalContent: (content) => {
    set({
      content,
      originalContent: content,
      isDirty: false,
      saveStatus: 'saved',
    });
  },
  setHighlightedSelection: (selection) => {
    set({ highlightedSelection: selection });
  },
  clearHighlightedSelection: () => {
    set({ highlightedSelection: null });
  },
}));
