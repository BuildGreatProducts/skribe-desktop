import { describe, expect, it } from 'vitest';
import { scaffoldPrompt } from './acp';

describe('ACP prompt scaffolding', () => {
  it('includes the active file and user request', () => {
    const prompt = scaffoldPrompt('make it warmer', '/tmp/project/README.md');
    expect(prompt).toContain('/tmp/project/README.md');
    expect(prompt).toContain('make it warmer');
    expect(prompt).toContain('active markdown document');
  });
});
