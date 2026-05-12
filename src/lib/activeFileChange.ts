import type { FsChangeEvent } from '../types';

export type ActiveEditorFileState = {
  filePath: string | null;
  content: string;
  originalContent: string;
  pendingSaveContent: string | null;
  isDirty: boolean;
};

type ActiveFileChangeOptions = {
  payload: FsChangeEvent;
  readFile: (filePath: string) => Promise<string>;
  getEditorState: () => ActiveEditorFileState;
  applyExternalContent: (content: string) => void;
  closeFile: () => void;
  setReloadPrompt: (filePath: string | null) => void;
};

export async function handleActiveFileChange({
  payload,
  readFile,
  getEditorState,
  applyExternalContent,
  closeFile,
  setReloadPrompt,
}: ActiveFileChangeOptions) {
  const activeFilePath = getEditorState().filePath;
  if (!activeFilePath || payload.path !== activeFilePath) return;

  if (payload.event === 'deleted') {
    closeFile();
    setReloadPrompt(null);
    return;
  }

  const diskContent = await readFile(activeFilePath);
  const latestState = getEditorState();
  if (latestState.filePath !== activeFilePath) return;

  if (!latestState.isDirty || diskContent === latestState.content) {
    applyExternalContent(diskContent);
    setReloadPrompt(null);
    return;
  }

  // The watcher can report Skribe's own save after newer edits are already dirty.
  if (
    diskContent === latestState.originalContent ||
    diskContent === latestState.pendingSaveContent
  ) {
    return;
  }

  setReloadPrompt(activeFilePath);
}
