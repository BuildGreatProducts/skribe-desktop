import { DotsThree } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { stripMarkdown } from '../../lib/readability';
import { tauriClient } from '../../lib/tauri';
import type { MarkdownFile } from '../../types';
import { Input } from '../ui';

const previewCache = new Map<string, string>();
const PREVIEW_TEXT_LIMIT = 160;
const MARKDOWN_EXTENSION_PATTERN = /\.(?:md|markdown)$/i;

type FileItemProps = {
  file: MarkdownFile;
  active: boolean;
  aiRunning: boolean;
  dirty: boolean;
  menuOpen: boolean;
  showParentFolder?: boolean;
  onOpen: (file: MarkdownFile) => void;
  onMenuOpenChange: (open: boolean) => void;
  onRename: (file: MarkdownFile, name: string) => void;
  onDelete: (file: MarkdownFile) => void;
};

export function FileItem({
  file,
  active,
  aiRunning,
  dirty,
  menuOpen,
  showParentFolder = true,
  onOpen,
  onMenuOpenChange,
  onRename,
  onDelete,
}: FileItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(markdownNameStem(file.name));
  const [previewText, setPreviewText] = useState<string | null>(null);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const previewCacheKey = `${file.path}:${file.modifiedAt}`;

  useEffect(() => {
    if (!renaming) setName(markdownNameStem(file.name));
  }, [file.name, renaming]);

  useEffect(() => {
    if (!menuOpen) return;

    const handler = (event: MouseEvent) => {
      if (!itemRef.current?.contains(event.target as Node)) onMenuOpenChange(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, onMenuOpenChange]);

  useEffect(() => {
    const cachedPreview = previewCache.get(previewCacheKey);
    if (cachedPreview !== undefined) {
      setPreviewText(cachedPreview);
      return;
    }

    let cancelled = false;
    setPreviewText(null);

    void tauriClient.fs
      .readFile(file.path)
      .then((content) => {
        const nextPreview = documentPreviewText(content);
        previewCache.set(previewCacheKey, nextPreview);
        if (!cancelled) setPreviewText(nextPreview);
      })
      .catch(() => {
        previewCache.set(previewCacheKey, '');
        if (!cancelled) setPreviewText('');
      });

    return () => {
      cancelled = true;
    };
  }, [file.path, previewCacheKey]);

  if (renaming) {
    return (
      <div className="flex h-16 items-center px-2 py-2">
        <Input
          autoFocus
          value={name}
          className="h-7 text-sm"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            setRenaming(false);
            setName(markdownNameStem(file.name));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onRename(file, markdownRenameTarget(name, file.name));
              setRenaming(false);
            }
            if (event.key === 'Escape') {
              setRenaming(false);
              setName(markdownNameStem(file.name));
            }
          }}
        />
      </div>
    );
  }

  const parentFolder = parentFolderName(file.relativePath);
  const showFolderLabel = showParentFolder && Boolean(parentFolder);

  return (
    <div
      ref={itemRef}
      className={clsx(
        'group relative flex h-16 items-center gap-3 rounded-sm px-2 py-2 text-sm text-chrome-text transition',
        active ? 'bg-paper/70 text-accent hover:bg-paper/80' : 'hover:bg-highlight',
      )}
      role="treeitem"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={() => onOpen(file)}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenuOpenChange(true);
      }}
    >
      <DocumentPreview active={active} running={aiRunning} text={previewText} />
      <div className="flex min-w-0 flex-1 flex-col justify-center pr-7">
        {showFolderLabel ? (
          <span
            className={clsx(
              'mb-0.5 block truncate text-[11px] font-medium leading-tight',
              active ? 'text-accent/75' : 'text-chrome-text-soft',
            )}
            title={parentPath(file.relativePath) ?? parentFolder ?? undefined}
          >
            {parentFolder}
          </span>
        ) : null}
        <span
          className={clsx(
            'block truncate font-semibold leading-tight',
            active ? 'text-accent' : 'text-chrome-text',
          )}
        >
          {markdownNameStem(file.name)}
        </span>
        {!showFolderLabel ? (
          <span className="mt-1 block truncate text-xs leading-tight text-chrome-text-soft">
            {fileSecondaryLabel(previewText)}
          </span>
        ) : null}
      </div>
      {dirty ? (
        <span
          className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-accent-warm"
          aria-label="Unsaved"
        />
      ) : null}
      <button
        type="button"
        aria-label="File actions"
        className="absolute right-2 top-2 hidden h-6 w-6 shrink-0 items-center justify-center rounded-sm text-chrome-text-soft hover:bg-chrome-bg group-hover:flex"
        onClick={(event) => {
          event.stopPropagation();
          onMenuOpenChange(!menuOpen);
        }}
      >
        <DotsThree size={18} weight="bold" />
      </button>
      {menuOpen ? (
        <div
          className="absolute right-2 top-9 z-20 w-32 rounded-md border border-hairline bg-paper py-1 text-sm text-ink shadow-modal"
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-chrome-bg"
            onClick={(event) => {
              event.stopPropagation();
              onMenuOpenChange(false);
              setName(markdownNameStem(file.name));
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
              onDelete(file);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DocumentPreview({
  active,
  running,
  text,
}: {
  active: boolean;
  running: boolean;
  text: string | null;
}) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'flex h-12 w-10 shrink-0 overflow-hidden rounded-[2px] border bg-paper shadow-[0_1px_2px_rgb(42_42_42_/_8%)]',
        running ? 'items-center justify-center px-0 py-0' : 'px-1.5 py-1',
        active ? 'border-accent/30' : 'border-hairline',
      )}
    >
      {running ? (
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
      ) : text === null ? (
        <span className="flex w-full flex-col gap-1 pt-0.5">
          <span className="h-px w-full bg-hairline" />
          <span className="h-px w-4/5 bg-hairline" />
          <span className="h-px w-full bg-hairline" />
          <span className="h-px w-2/3 bg-hairline" />
        </span>
      ) : text ? (
        <span className="font-editor text-[7px] leading-[0.58rem] text-ink-soft">{text}</span>
      ) : (
        <span className="mt-auto text-[6px] italic leading-tight text-chrome-text-soft">Empty</span>
      )}
    </div>
  );
}

function documentPreviewText(markdown: string): string {
  const text = stripMarkdown(markdown.replace(/^---[\s\S]*?---\s*/, ' '));
  if (text.length <= PREVIEW_TEXT_LIMIT) return text;
  return `${text.slice(0, PREVIEW_TEXT_LIMIT - 3).trim()}...`;
}

function fileSecondaryLabel(previewText: string | null): string {
  if (previewText === null) return 'Loading preview';
  return previewText || 'Empty document';
}

function parentPath(relativePath: string): string | null {
  const separatorIndex = relativePath.lastIndexOf('/');
  if (separatorIndex === -1) return null;
  return relativePath.slice(0, separatorIndex);
}

function parentFolderName(relativePath: string): string | null {
  const parent = parentPath(relativePath);
  if (!parent) return null;
  return parent.split('/').filter(Boolean).pop() ?? parent;
}

function markdownNameStem(fileName: string): string {
  return fileName.replace(MARKDOWN_EXTENSION_PATTERN, '');
}

function markdownRenameTarget(name: string, currentFileName: string): string {
  const stem = markdownNameStem(name.trim());
  if (!stem) return stem;
  return `${stem}${markdownExtension(currentFileName)}`;
}

function markdownExtension(fileName: string): string {
  return fileName.match(MARKDOWN_EXTENSION_PATTERN)?.[0] ?? '.md';
}
