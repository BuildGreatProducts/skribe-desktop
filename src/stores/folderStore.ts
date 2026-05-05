import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { errorMessage, tauriClient } from '../lib/tauri';
import type { FsChangeEvent, MarkdownFile } from '../types';
import { useSettingsStore } from './settingsStore';

type FolderState = {
  path: string | null;
  files: MarkdownFile[];
  loading: boolean;
  error: string | null;
  fsUnlisten: UnlistenFn | null;
  openFolder: (path: string) => Promise<void>;
  closeFolder: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  createFile: () => Promise<MarkdownFile | null>;
  renameFile: (filePath: string, newName: string) => Promise<MarkdownFile | null>;
  deleteFile: (filePath: string) => Promise<void>;
};

export const useFolderStore = create<FolderState>((set, get) => ({
  path: null,
  files: [],
  loading: false,
  error: null,
  fsUnlisten: null,
  openFolder: async (path) => {
    set({ loading: true, error: null });
    try {
      await get().fsUnlisten?.();
      const files = await tauriClient.fs.listMarkdownFiles(path);
      await tauriClient.fs.watchFolder(path);
      const unlisten = await listen<FsChangeEvent>('fs:change', async () => {
        await get().refreshFiles();
      });
      await useSettingsStore.getState().addRecentFolder(path);
      set({ path, files, loading: false, fsUnlisten: unlisten });
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
    }
  },
  closeFolder: async () => {
    await get().fsUnlisten?.();
    await tauriClient.fs.unwatchFolder().catch(() => undefined);
    set({ path: null, files: [], fsUnlisten: null });
  },
  refreshFiles: async () => {
    const path = get().path;
    if (!path) return;
    try {
      const files = await tauriClient.fs.listMarkdownFiles(path);
      set({ files, error: null });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
  createFile: async () => {
    const path = get().path;
    if (!path) return null;
    try {
      const file = await tauriClient.fs.createFile(path, 'Untitled.md');
      await get().refreshFiles();
      return file;
    } catch (error) {
      set({ error: errorMessage(error) });
      return null;
    }
  },
  renameFile: async (filePath, newName) => {
    try {
      const file = await tauriClient.fs.renameFile(filePath, newName);
      await get().refreshFiles();
      return file;
    } catch (error) {
      set({ error: errorMessage(error) });
      return null;
    }
  },
  deleteFile: async (filePath) => {
    try {
      await tauriClient.fs.deleteFile(filePath);
      await get().refreshFiles();
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
}));
