import { PlusIcon } from '@phosphor-icons/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useFolderStore } from '../../stores/folderStore';
import { useAiStore } from '../../stores/aiStore';
import type { MarkdownFile } from '../../types';
import { Button, ConfirmDeleteModal } from '../ui';
import { FileItem } from './FileItem';

type FileTreeProps = {
  onCreateFile: () => void;
};

export function FileTree({ onCreateFile }: FileTreeProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const files = useFolderStore((state) => state.files);
  const loading = useFolderStore((state) => state.loading);
  const error = useFolderStore((state) => state.error);
  const aiStatus = useAiStore((state) => state.status);
  const promptFilePath = useAiStore((state) => state.promptFilePath);
  const renameFile = useFolderStore((state) => state.renameFile);
  const deleteFile = useFolderStore((state) => state.deleteFile);
  const activeFilePath = useEditorStore((state) => state.filePath);
  const isDirty = useEditorStore((state) => state.isDirty);
  const saveNow = useEditorStore((state) => state.saveNow);
  const openFile = useEditorStore((state) => state.openFile);
  const closeFile = useEditorStore((state) => state.closeFile);
  const [pendingDelete, setPendingDelete] = useState<MarkdownFile | null>(null);
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const runningPromptFilePath = ['submitting', 'streaming', 'awaiting_clarification'].includes(aiStatus)
    ? promptFilePath
    : null;

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  async function open(file: MarkdownFile) {
    if (isDirty) await saveNow();
    await openFile(file.path);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteFile(pendingDelete.path);
    if (pendingDelete.path === activeFilePath) closeFile();
    setPendingDelete(null);
  }

  return (
    <div className="flex h-full flex-col">
      {error ? <div className="px-3 py-2 text-xs text-error">{error}</div> : null}
      {loading ? <div className="px-3 py-4 text-sm text-chrome-text-soft">Loading...</div> : null}
      {!loading && files.length === 0 ? (
        <div className="px-3 py-6 text-sm text-chrome-text-soft">
          <p className="mb-4">No markdown files in this folder yet.</p>
          <Button variant="secondary" icon={<PlusIcon size={15} weight="bold" />} onClick={onCreateFile}>
            Create new file
          </Button>
        </div>
      ) : (
        <div
          ref={parentRef}
          role="tree"
          aria-label="Markdown files"
          className="skribe-scrollbar min-h-0 flex-1 overflow-auto px-2 py-2"
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            const index = files.findIndex((file) => file.path === activeFilePath);
            const nextIndex =
              event.key === 'ArrowDown'
                ? Math.min(files.length - 1, index + 1)
                : Math.max(0, index - 1);
            const next = files[nextIndex];
            if (next) void open(next);
          }}
        >
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const file = files[item.index];
              return (
                <div
                  key={file.path}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    transform: `translateY(${item.start}px)`,
                    zIndex: openMenuPath === file.path ? 30 : undefined,
                  }}
                >
                  <FileItem
                    file={file}
                    active={file.path === activeFilePath}
                    aiRunning={runningPromptFilePath === file.path}
                    dirty={file.path === activeFilePath && isDirty}
                    menuOpen={openMenuPath === file.path}
                    onOpen={(selected) => void open(selected)}
                    onMenuOpenChange={(open) => setOpenMenuPath(open ? file.path : null)}
                    onRename={(selected, name) => void renameFile(selected.path, name)}
                    onDelete={setPendingDelete}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        fileName={pendingDelete?.name ?? ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
