import { describe, expect, it } from 'vitest';
import type { MarkdownFile } from '../../types';
import { buildFileTreeRows, folderPathsForFiles } from './fileTreeRows';

function markdownFile(relativePath: string): MarkdownFile {
  return {
    path: `/project/${relativePath}`,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    size: 1,
    modifiedAt: 1,
  };
}

describe('buildFileTreeRows', () => {
  it('groups child-folder documents below a collapsible heading', () => {
    const files = [
      markdownFile('README.md'),
      markdownFile('drafts/Outline.md'),
      markdownFile('drafts/Scene.md'),
      markdownFile('notes/Loose.md'),
    ];

    expect(buildFileTreeRows(files, new Set())).toMatchObject([
      { type: 'file', file: { relativePath: 'README.md' } },
      {
        type: 'folder',
        folderPath: 'drafts',
        folderName: 'drafts',
        fileCount: 2,
        collapsed: false,
      },
      { type: 'file', file: { relativePath: 'drafts/Outline.md' }, folderPath: 'drafts' },
      { type: 'file', file: { relativePath: 'drafts/Scene.md' }, folderPath: 'drafts' },
      {
        type: 'folder',
        folderPath: 'notes',
        folderName: 'notes',
        fileCount: 1,
        collapsed: false,
      },
      { type: 'file', file: { relativePath: 'notes/Loose.md' }, folderPath: 'notes' },
    ]);
  });

  it('hides files in collapsed folders', () => {
    const files = [markdownFile('README.md'), markdownFile('drafts/Outline.md')];

    expect(buildFileTreeRows(files, new Set(['drafts']))).toMatchObject([
      { type: 'file', file: { relativePath: 'README.md' } },
      { type: 'folder', folderPath: 'drafts', fileCount: 1, collapsed: true },
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
