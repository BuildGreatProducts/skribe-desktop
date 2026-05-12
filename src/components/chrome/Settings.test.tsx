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

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

describe('Settings', () => {
  beforeEach(() => {
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
      availability: {
        status: 'ready',
        installed: true,
        version: '1.0.0',
        loggedIn: null,
        lastCheckedAt: null,
        error: null,
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
});
