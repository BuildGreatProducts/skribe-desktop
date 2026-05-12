import type { MarkdownFile, MarkdownFolder } from '../../types';

export const FILE_ROW_HEIGHT = 64;
export const FOLDER_ROW_HEIGHT = 36;

export type FileTreeRow =
  | {
      type: 'folder';
      key: string;
      folderPath: string;
      folderName: string;
      folder: MarkdownFolder | null;
      fileCount: number;
      collapsed: boolean;
    }
  | {
      type: 'file';
      key: string;
      file: MarkdownFile;
      folderPath: string | null;
    };

export function buildFileTreeRows(
  files: MarkdownFile[],
  collapsedFolderPaths: ReadonlySet<string>,
  folders: MarkdownFolder[] = [],
): FileTreeRow[] {
  const rootFiles: MarkdownFile[] = [];
  const folderFiles = new Map<string, MarkdownFile[]>();
  const folderByPath = new Map(folders.map((folder) => [folder.relativePath, folder]));
  const folderPaths = new Set(folders.map((folder) => folder.relativePath));

  for (const file of files) {
    const folderPath = parentPath(file.relativePath);
    if (!folderPath) {
      rootFiles.push(file);
      continue;
    }

    const filesInFolder = folderFiles.get(folderPath) ?? [];
    filesInFolder.push(file);
    folderFiles.set(folderPath, filesInFolder);
    folderPaths.add(folderPath);
  }

  const rows: FileTreeRow[] = rootFiles.map((file) => ({
    type: 'file',
    key: file.path,
    file,
    folderPath: null,
  }));

  for (const folderPath of [...folderPaths].sort((a, b) => a.localeCompare(b))) {
    const filesInFolder = folderFiles.get(folderPath) ?? [];
    const collapsed = collapsedFolderPaths.has(folderPath);
    rows.push({
      type: 'folder',
      key: `folder:${folderPath}`,
      folderPath,
      folderName: folderName(folderPath),
      folder: folderByPath.get(folderPath) ?? null,
      fileCount: filesInFolder.length,
      collapsed,
    });

    if (!collapsed) {
      rows.push(
        ...filesInFolder.map((file) => ({
          type: 'file' as const,
          key: file.path,
          file,
          folderPath,
        })),
      );
    }
  }

  return rows;
}

export function folderPathsForEntries(
  files: MarkdownFile[],
  folders: MarkdownFolder[] = [],
): Set<string> {
  return new Set(
    [
      ...folders.map((folder) => folder.relativePath),
      ...files
        .map((file) => parentPath(file.relativePath))
        .filter((folderPath): folderPath is string => Boolean(folderPath)),
    ],
  );
}

export function folderPathsForFiles(files: MarkdownFile[]): Set<string> {
  return folderPathsForEntries(files);
}

function parentPath(relativePath: string): string | null {
  const separatorIndex = relativePath.lastIndexOf('/');
  if (separatorIndex === -1) return null;
  return relativePath.slice(0, separatorIndex);
}

function folderName(folderPath: string): string {
  return folderPath.split('/').filter(Boolean).pop() ?? folderPath;
}
