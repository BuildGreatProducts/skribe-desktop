export const AGENT_IDS = ['claude', 'codex'] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export const DEFAULT_AGENT_ID: AgentId = 'claude';

export type AgentMetadata = {
  id: AgentId;
  label: string;
  shortLabel: string;
  installUrl: string;
  loginCommand: string | null;
  missingDescription: string;
  readyDescription: string;
};

export const AGENTS: Record<AgentId, AgentMetadata> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    shortLabel: 'Claude',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    loginCommand: 'claude login',
    missingDescription: 'Install Claude Code to enable AI edits in Skribe.',
    readyDescription:
      'Claude Code is available. Login will be checked when a request runs.',
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    shortLabel: 'Codex',
    installUrl: 'https://github.com/zed-industries/codex-acp',
    loginCommand: null,
    missingDescription: 'Install Codex ACP to enable Codex edits in Skribe.',
    readyDescription:
      'Codex ACP is available. Authentication will be checked when a request runs.',
  },
};

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && (AGENT_IDS as readonly string[]).includes(value);
}

export function agentLabel(agentId: AgentId) {
  return AGENTS[agentId].label;
}
