import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreflightStore } from '../../stores/preflightStore';
import { defaultSettings, useSettingsStore } from '../../stores/settingsStore';
import { PreflightBanner } from './PreflightBanner';

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

describe('PreflightBanner', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: {
        ...defaultSettings,
        ai: { ...defaultSettings.ai, selectedAgent: 'codex' },
      },
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
          status: 'missing',
          installed: false,
          version: null,
          loggedIn: false,
          lastCheckedAt: null,
          error: null,
        },
      },
      dismissed: {},
      run: vi.fn(async () => undefined),
      dismiss: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('centers missing-agent banner text across the full banner', () => {
    render(<PreflightBanner />);

    const message = screen.getByText('Codex is needed for AI edits.');
    const content = message.parentElement;
    const banner = content?.parentElement;

    expect(content).toHaveClass('justify-center');
    expect(banner).toHaveClass('justify-center', 'text-center', 'px-14');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass(
      'absolute',
      'right-4',
    );
  });
});
