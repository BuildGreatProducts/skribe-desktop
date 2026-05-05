import { CaretDownIcon, CaretRightIcon, FolderIcon, PlusIcon } from '@phosphor-icons/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useFolderStore } from '../../stores/folderStore';
import { useAiStore } from '../../stores/aiStore';
import type { MarkdownFile } from '../../types';
import { Button, ConfirmDeleteModal } from '../ui';
import { FileItem } from './FileItem';
import {
  FILE_ROW_HEIGHT,
  FOLDER_ROW_HEIGHT,
  buildFileTreeRows,
  folderPathsForFiles,
  type FileTreeRow,
} from './fileTreeRows';

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
  const [collapsedFolderPaths, setCollapsedFolderPaths] = useState<Set<string>>(() => new Set());
  const runningPromptFilePath = ['submitting', 'streaming', 'awaiting_clarification'].includes(aiStatus)
    ? promptFilePath
    : null;
  const rows = useMemo(
    () => buildFileTreeRows(files, collapsedFolderPaths),
    [collapsedFolderPaths, files],
  );
  const visibleFiles = useMemo(
    () => rows.filter((row): row is Extract<FileTreeRow, { type: 'file' }> => row.type === 'file'),
    [rows],
  );

  useEffect(() => {
    const currentFolderPaths = folderPathsForFiles(files);
    setCollapsedFolderPaths((current) => {
      let changed = false;
      const next = new Set<string>();
      current.forEach((folderPath) => {
        if (currentFolderPaths.has(folderPath)) {
          next.add(folderPath);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [files]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index]?.type === 'folder' ? FOLDER_ROW_HEIGHT : FILE_ROW_HEIGHT),
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

  function toggleFolder(folderPath: string) {
    setCollapsedFolderPaths((current) => {
      const next = new Set(current);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
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
            const index = visibleFiles.findIndex((row) => row.file.path === activeFilePath);
            const nextIndex =
              event.key === 'ArrowDown'
                ? Math.min(visibleFiles.length - 1, index + 1)
                : Math.max(0, index - 1);
            const next = visibleFiles[nextIndex]?.file;
            if (next) void open(next);
          }}
        >
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              if (!row) return null;

              return (
                <div
                  key={row.key}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    transform: `translateY(${item.start}px)`,
                    zIndex: row.type === 'file' && openMenuPath === row.file.path ? 30 : undefined,
                  }}
                >
                  {row.type === 'folder' ? (
                    <FolderHeading row={row} onToggle={() => toggleFolder(row.folderPath)} />
                  ) : (
                    <FileItem
                      file={row.file}
                      active={row.file.path === activeFilePath}
                      aiRunning={runningPromptFilePath === row.file.path}
                      dirty={row.file.path === activeFilePath && isDirty}
                      menuOpen={openMenuPath === row.file.path}
                      showParentFolder={!row.folderPath}
                      onOpen={(selected) => void open(selected)}
                      onMenuOpenChange={(open) => setOpenMenuPath(open ? row.file.path : null)}
                      onRename={(selected, name) => void renameFile(selected.path, name)}
                      onDelete={setPendingDelete}
                    />
                  )}
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

function FolderHeading({
  row,
  onToggle,
}: {
  row: Extract<FileTreeRow, { type: 'folder' }>;
  onToggle: () => void;
}) {
  const Icon = row.collapsed ? CaretRightIcon : CaretDownIcon;
  return (
    <div className="flex h-9 items-center px-1">
      <button
        type="button"
        role="treeitem"
        aria-expanded={!row.collapsed}
        aria-label={`${row.collapsed ? 'Show' : 'Hide'} documents in ${row.folderName}`}
        title={row.folderPath}
        className={clsx(
          'group flex h-8 w-full items-center gap-2 rounded-sm px-1.5 text-left text-xs font-semibold text-chrome-text-soft transition hover:bg-highlight hover:text-chrome-text',
          !row.collapsed && 'text-chrome-text',
        )}
        onClick={onToggle}
      >
        <Icon size={13} weight="bold" className="shrink-0" />
        <FolderIcon
          size={14}
          weight="bold"
          className="shrink-0 text-chrome-text-soft group-hover:text-chrome-text"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{row.folderName}</span>
        <span className="shrink-0 text-[11px] font-medium text-chrome-text-soft">
          {row.fileCount}
        </span>
      </button>
    </div>
  );
}
