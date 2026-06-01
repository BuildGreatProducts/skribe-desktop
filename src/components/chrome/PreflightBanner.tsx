import { ArrowClockwise, ClipboardText, Warning, X } from '@phosphor-icons/react';
import { open } from '@tauri-apps/plugin-shell';
import { AGENTS } from '../../lib/agents';
import { CLAUDE_INSTALL_URL, copyClaudeLoginCommand } from '../../lib/claudeSetup';
import { usePreflightStore } from '../../stores/preflightStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../ui';

export function PreflightBanner() {
  const selectedAgent = useSettingsStore((state) => state.settings.ai.selectedAgent);
  const { availabilityByAgent, dismissed, dismiss, run } = usePreflightStore();
  const availability = availabilityByAgent[selectedAgent];
  const agent = AGENTS[selectedAgent];
  const isDismissed = Boolean(dismissed[selectedAgent]?.[availability.status]);
  if (isDismissed || !['missing', 'login_required'].includes(availability.status)) return null;

  const isMissing = availability.status === 'missing';
  const isClaude = selectedAgent === 'claude';

  return (
    <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-chrome-bg px-4 py-2 text-sm text-chrome-text">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Warning size={17} className="text-warning" />
        <span>
          {isMissing
            ? `${agent.label} is needed for AI edits.`
            : isClaude
              ? 'Run claude login in your terminal to enable AI edits.'
              : 'Sign in to Codex or set OPENAI_API_KEY/CODEX_API_KEY to enable AI edits.'}
        </span>
        {isMissing ? (
          <Button
            variant="link"
            className="gap-1"
            onClick={() =>
              void open(isClaude ? CLAUDE_INSTALL_URL : agent.installUrl)
            }
          >
            Install guide
          </Button>
        ) : (
          <>
            {isClaude ? (
              <Button
                variant="link"
                className="gap-1"
                onClick={() => void copyClaudeLoginCommand().catch(() => undefined)}
                icon={<ClipboardText size={15} />}
              >
                Copy command
              </Button>
            ) : null}
            <Button
              variant="link"
              className="gap-1"
              onClick={() => void run({ force: true, agentId: selectedAgent })}
              icon={<ArrowClockwise size={15} />}
            >
              Re-check
            </Button>
          </>
        )}
      </div>
      <Button
        aria-label="Dismiss"
        variant="secondary"
        className="h-7 w-7 px-0"
        onClick={() => dismiss(selectedAgent)}
        icon={<X size={15} />}
      />
    </div>
  );
}
