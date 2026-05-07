import { describe, expect, it } from 'vitest';
import { buildSkribePrompt } from '../src/prompts.js';

const basePrompt = {
  prompt: 'make it warmer',
  activeFilePath: '/tmp/project/README.md',
  workingFolder: '/tmp/project',
};

describe('buildSkribePrompt', () => {
  it('asks for a complete document when no text is selected', () => {
    const prompt = buildSkribePrompt(basePrompt);

    expect(prompt).toContain('complete final Markdown contents');
    expect(prompt).toContain('/tmp/project/README.md');
    expect(prompt).toContain('Do not add an outer code fence');
    expect(prompt).toContain('file trees');
    expect(prompt).toContain('text fence');
    expect(prompt).not.toContain('SKRIBE_SELECTED_TEXT');
  });

  it('asks for replacement Markdown when highlighted text is selected', () => {
    const prompt = buildSkribePrompt({
      ...basePrompt,
      selectedText: 'selected text',
    });

    expect(prompt).toContain('selected text only');
    expect(prompt).toContain('selected text');
    expect(prompt).toContain('replacement Markdown for the highlighted text');
    expect(prompt).toContain('Do not add an outer code fence');
    expect(prompt).toContain('file trees');
    expect(prompt).not.toContain('complete final Markdown contents');
  });

  it('lists referenced documents by path without inlining contents', () => {
    const prompt = buildSkribePrompt({
      ...basePrompt,
      documentReferences: [
        {
          name: 'Voice.md',
          relativePath: 'docs/Voice.md',
          path: '/tmp/project/docs/Voice.md',
        },
      ],
    });

    expect(prompt).toContain('User-selected context documents');
    expect(prompt).toContain('Voice.md');
    expect(prompt).toContain('docs/Voice.md');
    expect(prompt).toContain('/tmp/project/docs/Voice.md');
    expect(prompt).toContain('Read them when useful');
    expect(prompt).not.toContain('Referenced document contents');
  });

  it('lists attached files by metadata without inlining contents', () => {
    const prompt = buildSkribePrompt({
      ...basePrompt,
      attachments: [
        {
          name: 'reference.png',
          path: '/tmp/project/reference.png',
          size: 1536,
          kind: 'image',
          mimeType: 'image/png',
        },
      ],
    });

    expect(prompt).toContain('User-attached files');
    expect(prompt).toContain('reference.png');
    expect(prompt).toContain('/tmp/project/reference.png');
    expect(prompt).toContain('Kind: image');
    expect(prompt).toContain('Size: 1536 bytes');
    expect(prompt).toContain('MIME type: image/png');
    expect(prompt).toContain('Read them when useful');
    expect(prompt).not.toContain('data:image/png');
  });

  it('keeps selection output rules when attachments are present', () => {
    const prompt = buildSkribePrompt({
      ...basePrompt,
      selectedText: 'selected text',
      attachments: [
        {
          name: 'notes.txt',
          path: '/tmp/project/notes.txt',
          size: 42,
          kind: 'text',
          mimeType: 'text/plain',
        },
      ],
    });

    expect(prompt).toContain('User-attached files');
    expect(prompt).toContain('replacement Markdown for the highlighted text');
    expect(prompt).not.toContain('complete final Markdown contents');
  });
});
