import { ArrowClockwise, ClipboardText } from '@phosphor-icons/react';
import { open } from '@tauri-apps/plugin-shell';
import { CLAUDE_INSTALL_URL, copyClaudeLoginCommand } from '../../lib/claudeSetup';
import { useAiStore } from '../../stores/aiStore';
import { useEditorStore } from '../../stores/editorStore';
import { usePreflightStore } from '../../stores/preflightStore';
import { Button } from '../ui';

export function ErrorState() {
  const error = useAiStore((state) => state.error);
  const prompt = useAiStore((state) => state.prompt);
  const promptFilePath = useAiStore((state) => state.promptFilePath);
  const promptTarget = useAiStore((state) => state.promptTarget);
  const promptDocumentReferences = useAiStore((state) => state.promptDocumentReferences);
  const promptAttachments = useAiStore((state) => state.promptAttachments);
  const submitPrompt = useAiStore((state) => state.submitPrompt);
  const filePath = useEditorStore((state) => state.filePath);
  const runPreflight = usePreflightStore((state) => state.run);
  if (!error) return null;

  const retryFilePath = promptFilePath ?? filePath;
  const targetMatchesFile =
    promptTarget.type === 'document' || promptTarget.selection.filePath === retryFilePath;
  const canRetry = Boolean(
    prompt.trim() && retryFilePath && targetMatchesFile && error.code !== 'AI_SELECTION_STALE',
  );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 px-4 text-xs text-error">
      <span>{error.message}</span>
      {error.code === 'CLAUDE_NOT_INSTALLED' ? (
        <>
          <Button
            variant="link"
            className="text-xs"
            onClick={() => void open(CLAUDE_INSTALL_URL)}
          >
            Install guide
          </Button>
          <Button
            variant="link"
            className="gap-1 text-xs"
            onClick={() => void runPreflight({ force: true })}
            icon={<ArrowClockwise size={13} />}
          >
            Re-check
          </Button>
        </>
      ) : null}
      {error.code === 'CLAUDE_NOT_LOGGED_IN' ? (
        <>
          <Button
            variant="link"
            className="gap-1 text-xs"
            onClick={() => void copyClaudeLoginCommand().catch(() => undefined)}
            icon={<ClipboardText size={13} />}
          >
            Copy command
          </Button>
          <Button
            variant="link"
            className="gap-1 text-xs"
            onClick={() => void runPreflight({ force: true })}
            icon={<ArrowClockwise size={13} />}
          >
            Re-check
          </Button>
        </>
      ) : null}
      {!['CLAUDE_NOT_INSTALLED', 'CLAUDE_NOT_LOGGED_IN'].includes(error.code) && canRetry ? (
        <Button
          variant="link"
          className="text-xs"
          onClick={() =>
            void submitPrompt(
              prompt,
              retryFilePath!,
              promptTarget,
              promptDocumentReferences,
              promptAttachments,
            )
          }
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}
