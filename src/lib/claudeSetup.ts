import { AGENTS } from './agents';

export const CLAUDE_INSTALL_URL = AGENTS.claude.installUrl;
export const CLAUDE_LOGIN_COMMAND = AGENTS.claude.loginCommand ?? 'claude login';

export async function copyClaudeLoginCommand() {
  await window.navigator.clipboard.writeText(CLAUDE_LOGIN_COMMAND);
}
