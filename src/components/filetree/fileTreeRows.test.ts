import { describe, expect, it } from 'vitest';
import type { MarkdownFile, MarkdownFolder } from '../../types';
import {
  buildFileTreeRows,
  defaultCollapsedFolderPaths,
  folderPathsForEntries,
  folderPathsForFiles,
} from './fileTreeRows';

function markdownFile(relativePath: string): MarkdownFile {
  return {
    path: `/project/${relativePath}`,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    size: 1,
    modifiedAt: 1,
  };
}

function markdownFolder(relativePath: string): MarkdownFolder {
  return {
    path: `/project/${relativePath}`,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
  };
}

describe('buildFileTreeRows', () => {
  it('renders nested folders in order with folders before files', () => {
    const files = [
      markdownFile('README.md'),
      markdownFile('drafts/Outline.md'),
      markdownFile('drafts/chapter-1/Scene.md'),
      markdownFile('drafts/chapter-1/Beat.md'),
      markdownFile('notes/Loose.md'),
    ];

    expect(buildFileTreeRows(files, new Set())).toMatchObject([
      {
        type: 'folder',
        folderPath: 'drafts',
        folderName: 'drafts',
        fileCount: 3,
        collapsed: false,
        depth: 0,
      },
      {
        type: 'folder',
        folderPath: 'drafts/chapter-1',
        folderName: 'chapter-1',
        fileCount: 2,
        collapsed: false,
        depth: 1,
      },
      {
        type: 'file',
        file: { relativePath: 'drafts/chapter-1/Beat.md' },
        folderPath: 'drafts/chapter-1',
        depth: 2,
      },
      {
        type: 'file',
        file: { relativePath: 'drafts/chapter-1/Scene.md' },
        folderPath: 'drafts/chapter-1',
        depth: 2,
      },
      {
        type: 'file',
        file: { relativePath: 'drafts/Outline.md' },
        folderPath: 'drafts',
        depth: 1,
      },
      {
        type: 'folder',
        folderPath: 'notes',
        folderName: 'notes',
        fileCount: 1,
        collapsed: false,
        depth: 0,
      },
      {
        type: 'file',
        file: { relativePath: 'notes/Loose.md' },
        folderPath: 'notes',
        depth: 1,
      },
      { type: 'file', file: { relativePath: 'README.md' }, folderPath: null, depth: 0 },
    ]);
  });

  it('hides all descendants in collapsed folders', () => {
    const files = [
      markdownFile('README.md'),
      markdownFile('drafts/Outline.md'),
      markdownFile('drafts/chapter-1/Scene.md'),
    ];

    expect(buildFileTreeRows(files, new Set(['drafts']))).toMatchObject([
      { type: 'folder', folderPath: 'drafts', fileCount: 2, collapsed: true, depth: 0 },
      { type: 'file', file: { relativePath: 'README.md' }, depth: 0 },
    ]);
  });

  it('hides only child folder descendants when a child folder is collapsed', () => {
    const files = [
      markdownFile('README.md'),
      markdownFile('drafts/Outline.md'),
      markdownFile('drafts/chapter-1/Scene.md'),
    ];

    expect(buildFileTreeRows(files, new Set(['drafts/chapter-1']))).toMatchObject([
      { type: 'folder', folderPath: 'drafts', fileCount: 2, collapsed: false, depth: 0 },
      {
        type: 'folder',
        folderPath: 'drafts/chapter-1',
        fileCount: 1,
        collapsed: true,
        depth: 1,
      },
      {
        type: 'file',
        file: { relativePath: 'drafts/Outline.md' },
        folderPath: 'drafts',
        depth: 1,
      },
      { type: 'file', file: { relativePath: 'README.md' }, depth: 0 },
    ]);
  });

  it('keeps empty folders visible inline', () => {
    const files = [markdownFile('README.md')];
    const folders = [
      markdownFolder('drafts'),
      markdownFolder('drafts/chapter-1'),
    ];

    expect(buildFileTreeRows(files, new Set(), folders)).toMatchObject([
      {
        type: 'folder',
        folderPath: 'drafts',
        folderName: 'drafts',
        fileCount: 0,
        collapsed: false,
        depth: 0,
      },
      {
        type: 'folder',
        folderPath: 'drafts/chapter-1',
        folderName: 'chapter-1',
        fileCount: 0,
        collapsed: false,
        depth: 1,
      },
      { type: 'file', file: { relativePath: 'README.md' }, depth: 0 },
    ]);
  });

  it('ignores empty root folder entries', () => {
    const files = [markdownFile('README.md')];
    const folders = [
      {
        path: '/project',
        relativePath: '',
        name: '',
      },
      markdownFolder('drafts'),
    ];

    expect(buildFileTreeRows(files, new Set(), folders)).toMatchObject([
      {
        type: 'folder',
        folderPath: 'drafts',
        folderName: 'drafts',
        fileCount: 0,
        depth: 0,
      },
      { type: 'file', file: { relativePath: 'README.md' }, depth: 0 },
    ]);
  });

  it('creates synthetic ancestor rows for nested files when folder entries are missing', () => {
    const files = [markdownFile('drafts/chapter-1/Scene.md')];

    expect(buildFileTreeRows(files, new Set())).toMatchObject([
      {
        type: 'folder',
        folderPath: 'drafts',
        folder: null,
        fileCount: 1,
        depth: 0,
      },
      {
        type: 'folder',
        folderPath: 'drafts/chapter-1',
        folder: null,
        fileCount: 1,
        depth: 1,
      },
      {
        type: 'file',
        file: { relativePath: 'drafts/chapter-1/Scene.md' },
        folderPath: 'drafts/chapter-1',
        depth: 2,
      },
    ]);
  });
});

describe('folderPathsForFiles', () => {
  it('returns only folder paths that contain markdown files', () => {
    const paths = folderPathsForFiles([
      markdownFile('README.md'),
      markdownFile('drafts/Outline.md'),
      markdownFile('drafts/chapter-1/Scene.md'),
    ]);

    expect([...paths]).toEqual(['drafts', 'drafts/chapter-1']);
  });
});

describe('folderPathsForEntries', () => {
  it('returns folder paths from both folders and files', () => {
    const paths = folderPathsForEntries(
      [markdownFile('drafts/chapter-1/Scene.md')],
      [markdownFolder('drafts')],
    );

    expect([...paths]).toEqual(['drafts', 'drafts/chapter-1']);
  });
});

describe('defaultCollapsedFolderPaths', () => {
  it('returns folders that have no descendant markdown files', () => {
    const paths = defaultCollapsedFolderPaths(
      [markdownFile('drafts/chapter-1/Scene.md')],
      [
        markdownFolder('drafts'),
        markdownFolder('drafts/empty'),
        markdownFolder('archive'),
        markdownFolder('archive/deep'),
      ],
    );

    expect([...paths].sort()).toEqual([
      'archive',
      'archive/deep',
      'drafts/empty',
    ]);
  });
});
