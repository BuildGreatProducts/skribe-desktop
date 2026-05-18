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
      depth: number;
    }
  | {
      type: 'file';
      key: string;
      file: MarkdownFile;
      folderPath: string | null;
      depth: number;
    };

type FolderNode = {
  path: string;
  name: string;
  folder: MarkdownFolder | null;
  folders: Map<string, FolderNode>;
  files: MarkdownFile[];
  fileCount: number;
};

type RootNode = {
  folders: Map<string, FolderNode>;
  files: MarkdownFile[];
};

type TreeNode = RootNode | FolderNode;

export function buildFileTreeRows(
  files: MarkdownFile[],
  collapsedFolderPaths: ReadonlySet<string>,
  folders: MarkdownFolder[] = [],
): FileTreeRow[] {
  const root = buildFolderTree(files, folders);
  updateFolderFileCounts(root);

  const rows: FileTreeRow[] = [];
  for (const folder of sortedFolders(root.folders)) {
    appendFolderRows(rows, folder, 0, collapsedFolderPaths);
  }

  for (const file of sortedFiles(root.files)) {
    rows.push({
      type: 'file',
      key: file.path,
      file,
      folderPath: null,
      depth: 0,
    });
  }

  return rows;
}

export function folderPathsForEntries(
  files: MarkdownFile[],
  folders: MarkdownFolder[] = [],
): Set<string> {
  const paths = new Set<string>();
  for (const folder of folders) {
    for (const folderPath of ancestorFolderPaths(folder.relativePath)) {
      paths.add(folderPath);
    }
  }
  for (const file of files) {
    const folderPath = parentPath(file.relativePath);
    if (!folderPath) continue;
    for (const ancestorPath of ancestorFolderPaths(folderPath)) {
      paths.add(ancestorPath);
    }
  }
  return paths;
}

export function folderPathsForFiles(files: MarkdownFile[]): Set<string> {
  return folderPathsForEntries(files);
}

export function defaultCollapsedFolderPaths(
  files: MarkdownFile[],
  folders: MarkdownFolder[] = [],
): Set<string> {
  const foldersWithMarkdownFiles = folderPathsForFiles(files);
  const collapsed = new Set<string>();

  for (const folderPath of folderPathsForEntries(files, folders)) {
    if (!foldersWithMarkdownFiles.has(folderPath)) collapsed.add(folderPath);
  }

  return collapsed;
}

function buildFolderTree(files: MarkdownFile[], folders: MarkdownFolder[]): RootNode {
  const root: RootNode = {
    folders: new Map(),
    files: [],
  };

  for (const folder of folders) {
    const folderPath = folder.relativePath;
    if (folderPath === '') continue;
    ensureFolderNode(root, folderPath).folder = folder;
  }

  for (const file of files) {
    const folderPath = parentPath(file.relativePath);
    if (!folderPath) {
      root.files.push(file);
      continue;
    }
    ensureFolderNode(root, folderPath).files.push(file);
  }

  return root;
}

function ensureFolderNode(root: RootNode, folderPath: string): FolderNode {
  let folders = root.folders;
  let node: FolderNode | null = null;

  for (const path of ancestorFolderPaths(folderPath)) {
    node = folders.get(path) ?? {
      path,
      name: folderName(path),
      folder: null,
      folders: new Map(),
      files: [],
      fileCount: 0,
    };
    folders.set(path, node);
    folders = node.folders;
  }

  if (!node) {
    throw new Error('Folder path cannot be empty');
  }
  return node;
}

function updateFolderFileCounts(node: TreeNode): number {
  let count = node.files.length;
  for (const folder of node.folders.values()) {
    count += updateFolderFileCounts(folder);
  }

  if (isFolderNode(node)) node.fileCount = count;
  return count;
}

function isFolderNode(node: TreeNode): node is FolderNode {
  return 'path' in node;
}

function appendFolderRows(
  rows: FileTreeRow[],
  folder: FolderNode,
  depth: number,
  collapsedFolderPaths: ReadonlySet<string>,
) {
  const collapsed = collapsedFolderPaths.has(folder.path);
  rows.push({
    type: 'folder',
    key: `folder:${folder.path}`,
    folderPath: folder.path,
    folderName: folder.name,
    folder: folder.folder,
    fileCount: folder.fileCount,
    collapsed,
    depth,
  });

  if (collapsed) return;

  for (const childFolder of sortedFolders(folder.folders)) {
    appendFolderRows(rows, childFolder, depth + 1, collapsedFolderPaths);
  }

  for (const file of sortedFiles(folder.files)) {
    rows.push({
      type: 'file',
      key: file.path,
      file,
      folderPath: folder.path,
      depth: depth + 1,
    });
  }
}

function sortedFolders(folders: Map<string, FolderNode>): FolderNode[] {
  return [...folders.values()].sort((a, b) => compareNames(a.name, b.name, a.path, b.path));
}

function sortedFiles(files: MarkdownFile[]): MarkdownFile[] {
  return [...files].sort((a, b) => compareNames(a.name, b.name, a.relativePath, b.relativePath));
}

function compareNames(aName: string, bName: string, aFallback: string, bFallback: string): number {
  const nameComparison = aName.localeCompare(bName, undefined, { sensitivity: 'base' });
  if (nameComparison !== 0) return nameComparison;
  return aFallback.localeCompare(bFallback);
}

function parentPath(relativePath: string): string | null {
  const separatorIndex = relativePath.lastIndexOf('/');
  if (separatorIndex === -1) return null;
  return relativePath.slice(0, separatorIndex);
}

function ancestorFolderPaths(folderPath: string): string[] {
  const parts = folderPath.split('/').filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}

function folderName(folderPath: string): string {
  return folderPath.split('/').filter(Boolean).pop() ?? folderPath;
}
