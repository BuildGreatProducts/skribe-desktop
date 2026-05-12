import { describe, expect, it } from 'vitest';
import { buildClaudeArgs } from '../src/claudeArgs.js';

describe('buildClaudeArgs', () => {
  it('uses Claude Code accept-edits permissions by default', () => {
    const args = buildClaudeArgs();

    expect(args).toContain('--permission-mode');
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits');
    expect(args).not.toContain('--dangerously-skip-permissions');
  });

  it('makes WebFetch available and auto-allowed without enabling web search', () => {
    const args = buildClaudeArgs();
    const toolsIndex = args.indexOf('--tools');
    const allowedToolsIndex = args.indexOf('--allowedTools');

    expect(toolsIndex).toBeGreaterThan(-1);
    expect(args[toolsIndex + 1].split(',')).toEqual([
      'Read',
      'Glob',
      'Grep',
      'LS',
      'WebFetch',
    ]);
    expect(args[toolsIndex + 1].split(',')).not.toContain('WebSearch');
    expect(allowedToolsIndex).toBeGreaterThan(-1);
    expect(args[allowedToolsIndex + 1]).toBe('WebFetch');
  });

  it('does not append a system prompt for empty or whitespace settings text', () => {
    expect(buildClaudeArgs()).not.toContain('--append-system-prompt');
    expect(buildClaudeArgs('   \n\t  ')).not.toContain('--append-system-prompt');
  });

  it('appends non-empty settings text as a Claude Code system prompt', () => {
    const systemPrompt = 'Use plain language.\nPrefer short paragraphs.';
    const args = buildClaudeArgs(systemPrompt);
    const index = args.indexOf('--append-system-prompt');

    expect(index).toBeGreaterThan(-1);
    expect(args[index + 1]).toBe(systemPrompt);
  });

  it('adds unique attachment directories to Claude Code permissions', () => {
    const args = buildClaudeArgs(null, [
      '/tmp/project/assets',
      '/tmp/project/assets',
      '  /tmp/reference  ',
    ]);

    const firstIndex = args.indexOf('--add-dir');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(args.slice(firstIndex, firstIndex + 4)).toEqual([
      '--add-dir',
      '/tmp/project/assets',
      '--add-dir',
      '/tmp/reference',
    ]);
  });

  it('can bypass Claude Code permissions when explicitly enabled', () => {
    const args = buildClaudeArgs(null, [], { dangerouslySkipPermissions: true });

    expect(args).toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--permission-mode');
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('WebFetch');
  });
});
