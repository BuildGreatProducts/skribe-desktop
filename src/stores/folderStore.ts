import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { errorMessage, tauriClient } from '../lib/tauri';
import type { FsChangeEvent, MarkdownFile, MarkdownFolder } from '../types';
import { useSettingsStore } from './settingsStore';

type FolderState = {
  path: string | null;
  files: MarkdownFile[];
  folders: MarkdownFolder[];
  loading: boolean;
  error: string | null;
  fsUnlisten: UnlistenFn | null;
  openFolder: (path: string) => Promise<void>;
  closeFolder: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  createFile: (fileName: string, parentFolderPath?: string | null) => Promise<MarkdownFile | null>;
  createFolder: (folderName: string) => Promise<MarkdownFolder | null>;
  renameFile: (filePath: string, newName: string) => Promise<MarkdownFile | null>;
  renameFolder: (folderPath: string, newName: string) => Promise<MarkdownFolder | null>;
  deleteFile: (filePath: string) => Promise<void>;
  deleteFolder: (folderPath: string) => Promise<void>;
};

export const useFolderStore = create<FolderState>((set, get) => ({
  path: null,
  files: [],
  folders: [],
  loading: false,
  error: null,
  fsUnlisten: null,
  openFolder: async (path) => {
    set({ loading: true, error: null });
    try {
      await get().fsUnlisten?.();
      const [files, folders] = await Promise.all([
        tauriClient.fs.listMarkdownFiles(path),
        tauriClient.fs.listFolders(path),
      ]);
      await tauriClient.fs.watchFolder(path);
      const unlisten = await listen<FsChangeEvent>('fs:change', async () => {
        await get().refreshFiles();
      });
      await useSettingsStore.getState().addRecentFolder(path);
      set({ path, files, folders, loading: false, fsUnlisten: unlisten });
    } catch (error) {
      set({ loading: false, error: errorMessage(error) });
    }
  },
  closeFolder: async () => {
    await get().fsUnlisten?.();
    await tauriClient.fs.unwatchFolder().catch(() => undefined);
    set({ path: null, files: [], folders: [], fsUnlisten: null });
  },
  refreshFiles: async () => {
    const path = get().path;
    if (!path) return;
    try {
      const [files, folders] = await Promise.all([
        tauriClient.fs.listMarkdownFiles(path),
        tauriClient.fs.listFolders(path),
      ]);
      set({ files, folders, error: null });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
  createFile: async (fileName, parentFolderPath = null) => {
    const path = get().path;
    if (!path) return null;
    try {
      const file = await tauriClient.fs.createFile(path, fileName, parentFolderPath);
      await get().refreshFiles();
      return file;
    } catch (error) {
      set({ error: errorMessage(error) });
      return null;
    }
  },
  createFolder: async (folderName) => {
    const path = get().path;
    if (!path) return null;
    try {
      const folder = await tauriClient.fs.createFolder(path, folderName);
      await get().refreshFiles();
      return folder;
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
  renameFolder: async (folderPath, newName) => {
    try {
      const folder = await tauriClient.fs.renameFolder(folderPath, newName);
      await get().refreshFiles();
      return folder;
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
  deleteFolder: async (folderPath) => {
    try {
      await tauriClient.fs.deleteFolder(folderPath);
      await get().refreshFiles();
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
}));
