import { useCallback, useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AIInputBar } from './components/ai/AIInputBar';
import { AppShell } from './components/chrome/AppShell';
import { EmptyState } from './components/chrome/EmptyState';
import { PreflightBanner } from './components/chrome/PreflightBanner';
import { ProjectWritingInstructions } from './components/chrome/ProjectWritingInstructions';
import { Settings } from './components/chrome/Settings';
import { Editor } from './components/editor/Editor';
import { FileTree } from './components/filetree/FileTree';
import { Button, Input, Modal, Select } from './components/ui';
import { tauriClient } from './lib/tauri';
import { useAiStore } from './stores/aiStore';
import { useEditorStore } from './stores/editorStore';
import { useFolderStore } from './stores/folderStore';
import { usePreflightStore } from './stores/preflightStore';
import { useSettingsStore } from './stores/settingsStore';
import type { FsChangeEvent } from './types';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectInstructionsOpen, setProjectInstructionsOpen] = useState(false);
  const [reloadPrompt, setReloadPrompt] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fileNamePromptOpen, setFileNamePromptOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileFolderPath, setNewFileFolderPath] = useState('');
  const [folderNamePromptOpen, setFolderNamePromptOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const folderPath = useFolderStore((state) => state.path);
  const files = useFolderStore((state) => state.files);
  const folders = useFolderStore((state) => state.folders);
  const fileTreeWidth = useSettingsStore((state) => state.settings.ui.fileTreeWidth);
  const loadSettings = useSettingsStore((state) => state.load);
  const openFolder = useFolderStore((state) => state.openFolder);
  const closeFolder = useFolderStore((state) => state.closeFolder);
  const createFile = useFolderStore((state) => state.createFile);
  const createFolder = useFolderStore((state) => state.createFolder);
  const activeFilePath = useEditorStore((state) => state.filePath);
  const isDirty = useEditorStore((state) => state.isDirty);
  const openFile = useEditorStore((state) => state.openFile);
  const closeFile = useEditorStore((state) => state.closeFile);
  const saveNow = useEditorStore((state) => state.saveNow);
  const applyExternalContent = useEditorStore((state) => state.applyExternalContent);
  const stopSession = useAiStore((state) => state.stopSession);
  const runPreflight = usePreflightStore((state) => state.run);

  const openAndSelect = useCallback(
    async (path: string) => {
      if (isDirty) await saveNow();
      await openFolder(path);
      const first = useFolderStore.getState().files[0];
      if (first) await openFile(first.path);
    },
    [isDirty, openFile, openFolder, saveNow],
  );

  const pickAndOpenFolder = useCallback(async () => {
    const path = await tauriClient.fs.pickFolder();
    if (path) await openAndSelect(path);
  }, [openAndSelect]);

  const openFileNamePrompt = useCallback(() => {
    if (!folderPath) return;
    setNewFileName('');
    setNewFileFolderPath('');
    setFileNamePromptOpen(true);
  }, [folderPath]);

  const createAndOpenFile = useCallback(async () => {
    if (!folderPath) return;
    const fileName = newFileName.trim();
    if (!isValidFileName(fileName)) return;
    if (isDirty) await saveNow();
    const file = await createFile(fileName, newFileFolderPath || null);
    if (file) {
      setFileNamePromptOpen(false);
      setNewFileName('');
      setNewFileFolderPath('');
      await openFile(file.path);
    }
  }, [createFile, folderPath, isDirty, newFileFolderPath, newFileName, openFile, saveNow]);

  const openFolderNamePrompt = useCallback(() => {
    if (!folderPath) return;
    setNewFolderName('');
    setFolderNamePromptOpen(true);
  }, [folderPath]);

  const createFolderInNavigation = useCallback(async () => {
    if (!folderPath) return;
    const folderName = newFolderName.trim();
    if (!isValidFolderName(folderName)) return;
    const folder = await createFolder(folderName);
    if (folder) {
      setFolderNamePromptOpen(false);
      setNewFolderName('');
    }
  }, [createFolder, folderPath, newFolderName]);

  const goHome = useCallback(async () => {
    if (isDirty) await saveNow();
    await stopSession();
    closeFile();
    await closeFolder();
    setReloadPrompt(null);
    setSidebarCollapsed(false);
  }, [closeFile, closeFolder, isDirty, saveNow, stopSession]);

  useEffect(() => {
    void loadSettings();
    void runPreflight();
  }, [loadSettings, runPreflight]);

  useEffect(() => {
    if (!folderPath || activeFilePath || files.length === 0) return;
    void openFile(files[0].path);
  }, [activeFilePath, files, folderPath, openFile]);

  useEffect(() => {
    if (!folderPath) setSidebarCollapsed(false);
    if (!folderPath) setProjectInstructionsOpen(false);
    if (!folderPath) setFileNamePromptOpen(false);
    if (!folderPath) setFolderNamePromptOpen(false);
  }, [folderPath]);

  useEffect(() => {
    if (!newFileFolderPath) return;
    if (!folders.some((folder) => folder.path === newFileFolderPath)) {
      setNewFileFolderPath('');
    }
  }, [folders, newFileFolderPath]);

  useEffect(() => {
    if (!isTauri()) return;

    const unlistenPromise = listen<FsChangeEvent>('fs:change', async ({ payload }) => {
      if (!activeFilePath || payload.path !== activeFilePath) return;
      if (payload.event === 'deleted') {
        closeFile();
        return;
      }
      if (!isDirty) {
        const content = await tauriClient.fs.readFile(activeFilePath);
        applyExternalContent(content);
      } else {
        setReloadPrompt(activeFilePath);
      }
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [activeFilePath, applyExternalContent, closeFile, isDirty]);

  useEffect(() => {
    const handler = async (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'o') {
        event.preventDefault();
        await pickAndOpenFolder();
      }
      if (key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if (key === 'n' && folderPath) {
        event.preventDefault();
        openFileNamePrompt();
      }
      if (key === 's') {
        event.preventDefault();
        await saveNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [folderPath, openFileNamePrompt, pickAndOpenFolder, saveNow]);

  async function reloadFromDisk() {
    if (!reloadPrompt) return;
    const content = await tauriClient.fs.readFile(reloadPrompt);
    applyExternalContent(content);
    setReloadPrompt(null);
  }

  return (
    <>
      <AppShell
        fileTreeWidth={folderPath ? fileTreeWidth : 0}
        sidebar={
          folderPath ? (
            <FileTree />
          ) : null
        }
        sidebarCollapsed={Boolean(folderPath) && sidebarCollapsed}
        onCreateFile={openFileNamePrompt}
        onCreateFolder={openFolderNamePrompt}
        onGoHome={() => void goHome()}
        onToggleSidebar={() => setSidebarCollapsed((collapsed) => !collapsed)}
        banner={<PreflightBanner />}
        onOpenProjectInstructions={() => setProjectInstructionsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        projectInstructionsDisabled={!folderPath}
      >
        {folderPath ? (
          <div className="relative h-full">
            <Editor />
            <AIInputBar />
          </div>
        ) : (
          <EmptyState onOpenFolder={() => void pickAndOpenFolder()} onOpenRecent={(path) => void openAndSelect(path)} />
        )}
      </AppShell>
      <ProjectWritingInstructions
        open={projectInstructionsOpen}
        folderPath={folderPath}
        onClose={() => setProjectInstructionsOpen(false)}
      />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Modal
        open={fileNamePromptOpen}
        title="New file"
        onClose={() => setFileNamePromptOpen(false)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createAndOpenFile();
          }}
        >
          <div className="space-y-3">
            <Input
              autoFocus
              aria-label="File name"
              placeholder="File name"
              value={newFileName}
              onChange={(event) => setNewFileName(event.target.value)}
            />
            <Select
              aria-label="Folder"
              className="w-full"
              value={newFileFolderPath}
              onChange={(event) => setNewFileFolderPath(event.target.value)}
            >
              <option value="">Project root</option>
              {folders.map((folder) => (
                <option key={folder.path} value={folder.path}>
                  {folder.relativePath}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFileNamePromptOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValidFileName(newFileName.trim())}>
              Create file
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={folderNamePromptOpen}
        title="New folder"
        onClose={() => setFolderNamePromptOpen(false)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createFolderInNavigation();
          }}
        >
          <Input
            autoFocus
            aria-label="Folder name"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFolderNamePromptOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValidFolderName(newFolderName.trim())}>
              Create folder
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(reloadPrompt)} title="Reload from disk?" onClose={() => setReloadPrompt(null)}>
        <p className="mb-6 text-sm text-ink-soft">
          This file changed outside Skribe while you have unsaved edits.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReloadPrompt(null)}>
            Keep my changes
          </Button>
          <Button onClick={() => void reloadFromDisk()}>Reload</Button>
        </div>
      </Modal>
    </>
  );
}

function isValidFileName(fileName: string): boolean {
  return (
    fileName.length > 0 &&
    !fileName.includes('/') &&
    !fileName.includes('\\') &&
    !fileName.includes(':') &&
    fileName !== '.' &&
    fileName !== '..'
  );
}

function isValidFolderName(folderName: string): boolean {
  return (
    folderName.length > 0 &&
    !folderName.includes('/') &&
    !folderName.includes('\\') &&
    !folderName.includes(':') &&
    folderName !== '.' &&
    folderName !== '..' &&
    !folderName.startsWith('.') &&
    !IGNORED_FOLDER_NAMES.has(folderName)
  );
}

const IGNORED_FOLDER_NAMES = new Set(['.git', 'node_modules', 'dist', 'build', 'target']);
