import {
  CaretDownIcon,
  CaretRightIcon,
  DotsThree,
  EyeSlashIcon,
  FolderIcon,
} from '@phosphor-icons/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useFolderStore } from '../../stores/folderStore';
import { useAiStore } from '../../stores/aiStore';
import type { MarkdownFile, MarkdownFolder } from '../../types';
import { ConfirmDeleteModal, Input } from '../ui';
import { FileItem } from './FileItem';
import {
  FILE_ROW_HEIGHT,
  FOLDER_ROW_HEIGHT,
  buildFileTreeRows,
  folderPathsForEntries,
  type FileTreeRow,
} from './fileTreeRows';

export function FileTree() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const files = useFolderStore((state) => state.files);
  const folders = useFolderStore((state) => state.folders);
  const loading = useFolderStore((state) => state.loading);
  const error = useFolderStore((state) => state.error);
  const aiStatus = useAiStore((state) => state.status);
  const promptFilePath = useAiStore((state) => state.promptFilePath);
  const renameFile = useFolderStore((state) => state.renameFile);
  const renameFolder = useFolderStore((state) => state.renameFolder);
  const deleteFile = useFolderStore((state) => state.deleteFile);
  const deleteFolder = useFolderStore((state) => state.deleteFolder);
  const activeFilePath = useEditorStore((state) => state.filePath);
  const isDirty = useEditorStore((state) => state.isDirty);
  const saveNow = useEditorStore((state) => state.saveNow);
  const openFile = useEditorStore((state) => state.openFile);
  const closeFile = useEditorStore((state) => state.closeFile);
  const [pendingDelete, setPendingDelete] = useState<MarkdownFile | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<MarkdownFolder | null>(null);
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const [showEmptyFolders, setShowEmptyFolders] = useState(false);
  const [collapsedFolderPaths, setCollapsedFolderPaths] = useState<Set<string>>(() => new Set());
  const runningPromptFilePath = ['submitting', 'streaming', 'awaiting_clarification'].includes(aiStatus)
    ? promptFilePath
    : null;
  const allRows = useMemo(
    () => buildFileTreeRows(files, collapsedFolderPaths, folders),
    [collapsedFolderPaths, files, folders],
  );
  const emptyFolderRows = useMemo(
    () =>
      allRows.filter(
        (row): row is Extract<FileTreeRow, { type: 'folder' }> =>
          row.type === 'folder' && row.fileCount === 0,
      ),
    [allRows],
  );
  const rows = useMemo(
    () => allRows.filter((row) => row.type !== 'folder' || row.fileCount > 0),
    [allRows],
  );
  const visibleFiles = useMemo(
    () => rows.filter((row): row is Extract<FileTreeRow, { type: 'file' }> => row.type === 'file'),
    [rows],
  );

  useEffect(() => {
    const currentFolderPaths = folderPathsForEntries(files, folders);
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
  }, [files, folders]);

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

  async function handleFolderDelete() {
    if (!pendingFolderDelete) return;
    await deleteFolder(pendingFolderDelete.path);
    if (activeFilePath && isPathInsideFolder(activeFilePath, pendingFolderDelete.path)) closeFile();
    setPendingFolderDelete(null);
  }

  async function handleFolderRename(folder: MarkdownFolder, newName: string) {
    const activeWasInside = activeFilePath ? isPathInsideFolder(activeFilePath, folder.path) : false;
    if (activeWasInside && isDirty) await saveNow();
    const renamed = await renameFolder(folder.path, newName);
    if (!renamed || !activeWasInside || !activeFilePath) return;

    const renamedActivePath = `${renamed.path}${activeFilePath.slice(folder.path.length)}`;
    await openFile(renamedActivePath);
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

  function toggleEmptyFolders() {
    if (showEmptyFolders) setOpenMenuPath(null);
    setShowEmptyFolders((visible) => !visible);
  }

  return (
    <div className="flex h-full flex-col">
      {error ? <div className="px-3 py-2 text-xs text-error">{error}</div> : null}
      {loading ? <div className="px-3 py-4 text-sm text-chrome-text-soft">Loading...</div> : null}
      {!loading && files.length === 0 && folders.length === 0 ? (
        <div className="px-3 py-6 text-sm text-chrome-text-soft">
          <p>No markdown files in this folder yet.</p>
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
                    zIndex:
                      (row.type === 'file' && openMenuPath === row.file.path) ||
                      (row.type === 'folder' && openMenuPath === row.key)
                        ? 30
                        : undefined,
                  }}
                >
                  {row.type === 'folder' ? (
                    <FolderHeading
                      row={row}
                      menuOpen={openMenuPath === row.key}
                      onToggle={() => toggleFolder(row.folderPath)}
                      onMenuOpenChange={(open) => setOpenMenuPath(open ? row.key : null)}
                      onRename={(folder, name) => void handleFolderRename(folder, name)}
                      onDelete={setPendingFolderDelete}
                    />
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
          {emptyFolderRows.length > 0 ? (
            <div className="mt-2 border-t border-hairline pt-2">
              <button
                type="button"
                aria-expanded={showEmptyFolders}
                className="mx-1 flex h-8 w-[calc(100%-0.5rem)] items-center justify-between rounded-sm px-2 text-left text-xs font-medium text-chrome-text-soft transition hover:bg-highlight hover:text-chrome-text"
                onClick={toggleEmptyFolders}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <EyeSlashIcon size={14} weight="bold" className="shrink-0" />
                  <span className="truncate">
                    {showEmptyFolders ? 'Hide folders' : 'Show all folders'}
                  </span>
                </span>
                <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper px-1 text-[10px] leading-none">
                  {emptyFolderRows.length}
                </span>
              </button>
              {showEmptyFolders ? (
                <div className="mt-1">
                  {emptyFolderRows.map((row) => (
                    <div
                      key={row.key}
                      className={clsx(
                        'relative',
                        openMenuPath === row.key && 'z-30',
                      )}
                    >
                      <FolderHeading
                        row={row}
                        menuOpen={openMenuPath === row.key}
                        onToggle={() => toggleFolder(row.folderPath)}
                        onMenuOpenChange={(open) => setOpenMenuPath(open ? row.key : null)}
                        onRename={(folder, name) => void handleFolderRename(folder, name)}
                        onDelete={setPendingFolderDelete}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        itemName={pendingDelete?.name ?? ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />
      <ConfirmDeleteModal
        open={Boolean(pendingFolderDelete)}
        itemKind="folder"
        itemName={pendingFolderDelete?.name ?? ''}
        onCancel={() => setPendingFolderDelete(null)}
        onConfirm={() => void handleFolderDelete()}
      />
    </div>
  );
}

function FolderHeading({
  row,
  menuOpen,
  onToggle,
  onMenuOpenChange,
  onRename,
  onDelete,
}: {
  row: Extract<FileTreeRow, { type: 'folder' }>;
  menuOpen: boolean;
  onToggle: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onRename: (folder: MarkdownFolder, name: string) => void;
  onDelete: (folder: MarkdownFolder) => void;
}) {
  const Icon = row.collapsed ? CaretRightIcon : CaretDownIcon;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(row.folderName);
  const itemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!renaming) setName(row.folderName);
  }, [row.folderName, renaming]);

  useEffect(() => {
    if (!menuOpen) return;

    const handler = (event: MouseEvent) => {
      if (!itemRef.current?.contains(event.target as Node)) onMenuOpenChange(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, onMenuOpenChange]);

  function submitRename() {
    const nextName = name.trim();
    setRenaming(false);
    if (!row.folder || !nextName || nextName === row.folderName) {
      setName(row.folderName);
      return;
    }
    onRename(row.folder, nextName);
  }

  if (renaming) {
    return (
      <div className="flex h-9 items-center px-2">
        <Input
          autoFocus
          value={name}
          className="h-7 text-sm"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            setRenaming(false);
            setName(row.folderName);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitRename();
            if (event.key === 'Escape') {
              setRenaming(false);
              setName(row.folderName);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div ref={itemRef} className="group relative flex h-9 items-center px-1">
      <button
        type="button"
        role="treeitem"
        aria-expanded={!row.collapsed}
        aria-label={`${row.collapsed ? 'Show' : 'Hide'} documents in ${row.folderName}`}
        title={row.folderPath}
        className={clsx(
          'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 pr-8 text-left text-xs font-semibold text-chrome-text-soft transition hover:bg-highlight hover:text-chrome-text',
          !row.collapsed && 'text-chrome-text',
        )}
        onClick={onToggle}
        onContextMenu={(event) => {
          event.preventDefault();
          if (row.folder) onMenuOpenChange(true);
        }}
      >
        <Icon size={13} weight="bold" className="shrink-0" />
        <FolderIcon
          size={14}
          weight="bold"
          className="shrink-0 text-chrome-text-soft"
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{row.folderName}</span>
        <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper px-1 text-[10px] font-medium leading-none text-chrome-text-soft">
          {row.fileCount}
        </span>
      </button>
      {row.folder ? (
        <button
          type="button"
          aria-label="Folder actions"
          className="absolute right-2 top-1.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-sm text-chrome-text-soft hover:bg-chrome-bg group-hover:flex"
          onClick={(event) => {
            event.stopPropagation();
            onMenuOpenChange(!menuOpen);
          }}
        >
          <DotsThree size={18} weight="bold" />
        </button>
      ) : null}
      {menuOpen && row.folder ? (
        <div className="absolute right-2 top-8 z-20 w-32 rounded-md border border-hairline bg-paper py-1 text-sm text-ink shadow-modal">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-chrome-bg"
            onClick={(event) => {
              event.stopPropagation();
              onMenuOpenChange(false);
              setName(row.folderName);
              setRenaming(true);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-error hover:bg-chrome-bg"
            onClick={(event) => {
              event.stopPropagation();
              onMenuOpenChange(false);
              if (row.folder) onDelete(row.folder);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function isPathInsideFolder(path: string, folderPath: string): boolean {
  return path === folderPath || path.startsWith(`${folderPath}/`);
}
