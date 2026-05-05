export const CLAUDE_INSTALL_URL = 'https://docs.anthropic.com/en/docs/claude-code';
export const CLAUDE_LOGIN_COMMAND = 'claude login';

export async function copyClaudeLoginCommand() {
  await window.navigator.clipboard.writeText(CLAUDE_LOGIN_COMMAND);
}
