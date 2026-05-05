export function buildClaudeArgs(systemPrompt?: string | null) {
  const args = [
    '--print',
    '--input-format',
    'text',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--permission-mode',
    'acceptEdits',
    '--tools',
    'Read,Glob,Grep,LS',
    '--no-session-persistence',
  ];

  const appendSystemPrompt = systemPrompt?.trim();
  if (appendSystemPrompt) {
    args.push('--append-system-prompt', appendSystemPrompt);
  }

  return args;
}
