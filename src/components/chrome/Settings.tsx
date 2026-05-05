import {
  ArrowClockwise,
  CheckCircle,
  ClipboardText,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { CLAUDE_INSTALL_URL, copyClaudeLoginCommand } from '../../lib/claudeSetup';
import { DEFAULT_GLOBAL_WRITING_INSTRUCTIONS } from '../../lib/writingInstructions';
import { usePreflightStore } from '../../stores/preflightStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button, Modal, Select, Toggle } from '../ui';

type SettingsProps = {
  open: boolean;
  onClose: () => void;
};

export function Settings({ open, onClose }: SettingsProps) {
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const availability = usePreflightStore((state) => state.availability);
  const runPreflight = usePreflightStore((state) => state.run);

  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Editor</h3>
            <Button
              variant="link"
              onClick={() =>
                void update((current) => ({
                  ...current,
                  editor: { fontSize: 18, accentColor: 'deep-ink', lineHeight: 1.7 },
                }))
              }
            >
              Reset
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-ink-soft">
              Font size
              <Select
                className="mt-1 w-full"
                value={settings.editor.fontSize}
                onChange={(event) =>
                  void update((current) => ({
                    ...current,
                    editor: {
                      ...current.editor,
                      fontSize: Number(event.target.value) as 14 | 16 | 18 | 20,
                    },
                  }))
                }
              >
                {[14, 16, 18, 20].map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-ink-soft">
              Line height
              <Select
                className="mt-1 w-full"
                value={settings.editor.lineHeight}
                onChange={(event) =>
                  void update((current) => ({
                    ...current,
                    editor: {
                      ...current.editor,
                      lineHeight: Number(event.target.value) as 1.5 | 1.7 | 1.9,
                    },
                  }))
                }
              >
                {[1.5, 1.7, 1.9].map((height) => (
                  <option key={height} value={height}>
                    {height}
                  </option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 text-sm text-ink-soft">
              Accent
              <Select
                className="mt-1 w-full"
                value={settings.editor.accentColor}
                onChange={(event) =>
                  void update((current) => ({
                    ...current,
                    editor: {
                      ...current.editor,
                      accentColor: event.target.value as 'deep-ink' | 'deep-green',
                    },
                  }))
                }
              >
                <option value="deep-ink">Deep ink</option>
                <option value="deep-green">Deep green</option>
              </Select>
            </label>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">UI</h3>
            <Button
              variant="link"
              onClick={() =>
                void update((current) => ({
                  ...current,
                  ui: { fileTreeWidth: 240, showStatusLine: true },
                }))
              }
            >
              Reset
            </Button>
          </div>
          <label className="block text-sm text-ink-soft">
            File tree width
            <input
              type="range"
              min={200}
              max={360}
              value={settings.ui.fileTreeWidth}
              className="mt-2 w-full accent-[var(--color-accent)]"
              onChange={(event) =>
                void update((current) => ({
                  ...current,
                  ui: { ...current.ui, fileTreeWidth: Number(event.target.value) },
                }))
              }
            />
          </label>
          <Toggle
            label="Show status line"
            checked={settings.ui.showStatusLine}
            onChange={(checked) =>
              void update((current) => ({
                ...current,
                ui: { ...current.ui, showStatusLine: checked },
              }))
            }
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Widgets</h3>
            <Button
              variant="link"
              onClick={() =>
                void update((current) => ({
                  ...current,
                  widgets: { wordCount: true, characterCount: true },
                }))
              }
            >
              Reset
            </Button>
          </div>
          <Toggle
            label="Word count"
            checked={settings.widgets.wordCount}
            onChange={(checked) =>
              void update((current) => ({
                ...current,
                widgets: { ...current.widgets, wordCount: checked },
              }))
            }
          />
          <Toggle
            label="Character count"
            checked={settings.widgets.characterCount}
            onChange={(checked) =>
              void update((current) => ({
                ...current,
                widgets: { ...current.widgets, characterCount: checked },
              }))
            }
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">AI</h3>
            <Button
              variant="link"
              onClick={() =>
                void update((current) => ({
                  ...current,
                  ai: {
                    ...current.ai,
                    autoFocusInputOnFolderOpen: false,
                    systemPrompt: DEFAULT_GLOBAL_WRITING_INSTRUCTIONS,
                  },
                }))
              }
            >
              Reset
            </Button>
          </div>
          <ClaudeCodeStatus
            status={availability.status}
            version={availability.version}
            error={availability.error}
            lastCheckedAt={availability.lastCheckedAt}
            onInstallGuide={() => void openExternal(CLAUDE_INSTALL_URL)}
            onCopyLogin={() => void copyClaudeLoginCommand().catch(() => undefined)}
            onRecheck={() => void runPreflight({ force: true })}
          />
          <Toggle
            label="Auto-focus AI input after opening a folder"
            checked={settings.ai.autoFocusInputOnFolderOpen}
            onChange={(checked) =>
              void update((current) => ({
                ...current,
                ai: { ...current.ai, autoFocusInputOnFolderOpen: checked },
              }))
            }
          />
          <label className="mt-3 block text-sm text-ink-soft">
            Global writing instructions
            <textarea
              value={settings.ai.systemPrompt}
              rows={5}
              className="mt-1 min-h-[120px] w-full resize-y rounded-md border border-hairline bg-paper px-3 py-2 text-base leading-relaxed text-ink placeholder:text-chrome-text-soft focus:border-accent focus:outline-none"
              placeholder="Writing style, tone, or standing instructions"
              onChange={(event) =>
                void update((current) => ({
                  ...current,
                  ai: { ...current.ai, systemPrompt: event.target.value },
                }))
              }
            />
          </label>
        </section>
      </div>
    </Modal>
  );
}

type ClaudeCodeStatusProps = {
  status: ReturnType<typeof usePreflightStore.getState>['availability']['status'];
  version: string | null;
  error: string | null;
  lastCheckedAt: number | null;
  onInstallGuide: () => void;
  onCopyLogin: () => void;
  onRecheck: () => void;
};

function ClaudeCodeStatus({
  status,
  version,
  error,
  lastCheckedAt,
  onInstallGuide,
  onCopyLogin,
  onRecheck,
}: ClaudeCodeStatusProps) {
  const copy = claudeStatusCopy(status);
  const Icon = copy.icon;

  return (
    <div className="mb-4 rounded-md border border-hairline bg-chrome-bg p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-semibold',
                copy.badgeClassName,
              )}
            >
              <Icon size={14} weight="bold" />
              {copy.label}
            </span>
            {version ? <span className="text-xs text-ink-soft">{version}</span> : null}
          </div>
          <p className="mt-2 text-sm text-ink-soft">{copy.description}</p>
          {status === 'check_failed' && error ? (
            <p className="mt-2 text-xs text-error">{error}</p>
          ) : null}
          <p className="mt-2 text-xs text-chrome-text-soft">
            Last checked {formatLastChecked(lastCheckedAt)}
          </p>
        </div>
        <Button
          variant="secondary"
          className="h-8 shrink-0 gap-1 border border-hairline bg-paper/60 px-2 text-xs"
          onClick={onRecheck}
          icon={<ArrowClockwise size={14} />}
        >
          {status === 'check_failed' ? 'Try again' : 'Re-check'}
        </Button>
      </div>
      {status === 'missing' ? (
        <Button
          variant="secondary"
          className="h-8 border border-hairline bg-paper/60 px-2 text-xs"
          onClick={onInstallGuide}
        >
          Install guide
        </Button>
      ) : null}
      {status === 'login_required' ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="h-8 gap-1 border border-hairline bg-paper/60 px-2 text-xs"
            onClick={onCopyLogin}
            icon={<ClipboardText size={14} />}
          >
            Copy claude login
          </Button>
          <Button
            variant="secondary"
            className="h-8 gap-1 border border-hairline bg-paper/60 px-2 text-xs"
            onClick={onRecheck}
            icon={<ArrowClockwise size={14} />}
          >
            Re-check after login
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function claudeStatusCopy(status: ClaudeCodeStatusProps['status']) {
  switch (status) {
    case 'checking':
      return {
        label: 'Checking',
        description: 'Looking for Claude Code on this Mac.',
        badgeClassName: 'bg-highlight text-ink',
        icon: ArrowClockwise,
      };
    case 'ready':
      return {
        label: 'Ready',
        description: 'Claude Code is available. Login will be checked when a request runs.',
        badgeClassName: 'bg-selection text-ink',
        icon: CheckCircle,
      };
    case 'missing':
      return {
        label: 'Missing',
        description: 'Install Claude Code to enable AI edits in Skribe.',
        badgeClassName: 'bg-highlight text-warning',
        icon: WarningCircle,
      };
    case 'login_required':
      return {
        label: 'Login required',
        description: 'Run claude login in your terminal, then re-check here.',
        badgeClassName: 'bg-highlight text-warning',
        icon: WarningCircle,
      };
    case 'check_failed':
      return {
        label: 'Check failed',
        description: 'Skribe could not check Claude Code status.',
        badgeClassName: 'bg-highlight text-error',
        icon: XCircle,
      };
  }
}

function formatLastChecked(lastCheckedAt: number | null) {
  if (!lastCheckedAt) return 'never';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(lastCheckedAt));
}
