type ClaudeArgsOptions = {
  dangerouslySkipPermissions?: boolean;
};

export function buildClaudeArgs(
  systemPrompt?: string | null,
  additionalDirectories: string[] = [],
  options: ClaudeArgsOptions = {},
) {
  const args = [
    '--print',
    '--input-format',
    'text',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
  ];

  if (options.dangerouslySkipPermissions) {
    args.push('--dangerously-skip-permissions');
  } else {
    args.push('--permission-mode', 'acceptEdits');
  }

  args.push(
    '--tools',
    'Read,Glob,Grep,LS,WebFetch',
    '--allowedTools',
    'WebFetch',
    '--no-session-persistence',
  );

  for (const directory of uniqueNonEmpty(additionalDirectories)) {
    args.push('--add-dir', directory);
  }

  const appendSystemPrompt = systemPrompt?.trim();
  if (appendSystemPrompt) {
    args.push('--append-system-prompt', appendSystemPrompt);
  }

  return args;
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
