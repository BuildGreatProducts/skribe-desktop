import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GLOBAL_WRITING_INSTRUCTIONS,
} from '../../lib/writingInstructions';
import { useFolderStore } from '../../stores/folderStore';
import { usePreflightStore } from '../../stores/preflightStore';
import { useSessionSettingsStore } from '../../stores/sessionSettingsStore';
import { defaultSettings, useSettingsStore } from '../../stores/settingsStore';
import type { AppSettings } from '../../types';
import { Settings } from './Settings';

const tauriMocks = vi.hoisted(() => ({
  openCodexInstaller: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('../../lib/tauri', () => ({
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  tauriClient: {
    agents: {
      openCodexInstaller: tauriMocks.openCodexInstaller,
    },
  },
}));

describe('Settings', () => {
  beforeEach(() => {
    tauriMocks.openCodexInstaller.mockResolvedValue(undefined);

    const update = vi.fn(async (recipe: (settings: AppSettings) => AppSettings) => {
      const settings = recipe(useSettingsStore.getState().settings);
      useSettingsStore.setState({ settings });
    });

    useSettingsStore.setState({
      settings: defaultSettings,
      loaded: true,
      error: null,
      update,
    });
    usePreflightStore.setState({
      availabilityByAgent: {
        claude: {
          agentId: 'claude',
          status: 'ready',
          installed: true,
          version: '1.0.0',
          loggedIn: null,
          lastCheckedAt: null,
          error: null,
        },
        codex: {
          agentId: 'codex',
          status: 'ready',
          installed: true,
          version: '0.15.0',
          loggedIn: null,
          lastCheckedAt: null,
          error: null,
        },
      },
      run: vi.fn(async () => undefined),
    });
    useFolderStore.setState({ path: '/tmp/project' });
    useSessionSettingsStore.setState({ dangerouslySkipPermissionsByFolder: {} });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the global writing instructions as editable settings text', () => {
    render(<Settings open onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));

    const instructions = screen.getByLabelText(
      'Global writing instructions',
    ) as HTMLTextAreaElement;
    expect(instructions).toHaveValue(DEFAULT_GLOBAL_WRITING_INSTRUCTIONS);

    fireEvent.change(instructions, { target: { value: 'Keep it warm and direct.' } });

    expect(instructions).toHaveValue('Keep it warm and direct.');
  });

  it('toggles the Claude Code permission bypass for the open folder session', () => {
    render(<Settings open onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    const toggle = screen.getByRole('switch', {
      name: 'Dangerously skip Claude Code permissions',
    });

    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    expect(
      useSessionSettingsStore.getState().dangerouslySkipPermissionsByFolder[
        '/tmp/project'
      ],
    ).toBe(true);
    expect(useSettingsStore.getState().settings.ai.dangerouslySkipPermissions).toBe(false);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('opens the Codex ACP installer and verifies the install from settings', async () => {
    const run = vi.fn(async () => undefined);
    usePreflightStore.setState((state) => ({
      availabilityByAgent: {
        ...state.availabilityByAgent,
        codex: {
          agentId: 'codex',
          status: 'missing',
          installed: false,
          version: null,
          loggedIn: false,
          lastCheckedAt: null,
          error: null,
        },
      },
      run,
    }));

    render(<Settings open onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Install Codex ACP' }));

    expect(tauriMocks.openCodexInstaller).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        'After Terminal finishes, return here and verify the installation.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Verify installation' }));

    expect(run).toHaveBeenCalledWith({ force: true, agentId: 'codex' });
  });
});
