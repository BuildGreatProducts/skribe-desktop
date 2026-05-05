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
import { Button, Modal } from './components/ui';
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
  const folderPath = useFolderStore((state) => state.path);
  const files = useFolderStore((state) => state.files);
  const fileTreeWidth = useSettingsStore((state) => state.settings.ui.fileTreeWidth);
  const loadSettings = useSettingsStore((state) => state.load);
  const openFolder = useFolderStore((state) => state.openFolder);
  const closeFolder = useFolderStore((state) => state.closeFolder);
  const createFile = useFolderStore((state) => state.createFile);
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

  const createAndOpenFile = useCallback(async () => {
    if (!folderPath) return;
    if (isDirty) await saveNow();
    const file = await createFile();
    if (file) await openFile(file.path);
  }, [createFile, folderPath, isDirty, openFile, saveNow]);

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
  }, [folderPath]);

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
        await createAndOpenFile();
      }
      if (key === 's') {
        event.preventDefault();
        await saveNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createAndOpenFile, folderPath, pickAndOpenFolder, saveNow]);

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
            <FileTree
              onCreateFile={() => void createAndOpenFile()}
            />
          ) : null
        }
        sidebarCollapsed={Boolean(folderPath) && sidebarCollapsed}
        onCreateFile={() => void createAndOpenFile()}
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
