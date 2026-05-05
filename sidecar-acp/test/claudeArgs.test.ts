import { describe, expect, it } from 'vitest';
import { buildClaudeArgs } from '../src/claudeArgs.js';

describe('buildClaudeArgs', () => {
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
});
