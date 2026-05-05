import { ArrowClockwise, ClipboardText, Warning, X } from '@phosphor-icons/react';
import { open } from '@tauri-apps/plugin-shell';
import { CLAUDE_INSTALL_URL, copyClaudeLoginCommand } from '../../lib/claudeSetup';
import { usePreflightStore } from '../../stores/preflightStore';
import { Button } from '../ui';

export function PreflightBanner() {
  const { availability, dismissed, dismiss, run } = usePreflightStore();
  const isDismissed = Boolean(dismissed[availability.status]);
  if (isDismissed || !['missing', 'login_required'].includes(availability.status)) return null;

  const isMissing = availability.status === 'missing';

  return (
    <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-chrome-bg px-4 py-2 text-sm text-chrome-text">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Warning size={17} className="text-warning" />
        <span>
          {isMissing
            ? 'Claude Code is needed for AI edits.'
            : 'Run claude login in your terminal to enable AI edits.'}
        </span>
        {isMissing ? (
          <Button
            variant="link"
            className="gap-1"
            onClick={() => void open(CLAUDE_INSTALL_URL)}
          >
            Install guide
          </Button>
        ) : (
          <>
            <Button
              variant="link"
              className="gap-1"
              onClick={() => void copyClaudeLoginCommand().catch(() => undefined)}
              icon={<ClipboardText size={15} />}
            >
              Copy command
            </Button>
            <Button
              variant="link"
              className="gap-1"
              onClick={() => void run({ force: true })}
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
        onClick={dismiss}
        icon={<X size={15} />}
      />
    </div>
  );
}
