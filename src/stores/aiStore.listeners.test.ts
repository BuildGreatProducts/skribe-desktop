import { beforeEach, describe, expect, it, vi } from 'vitest';

function installMocks({
  folderPath = null,
  projectWritingInstructions = {},
  dangerouslySkipPermissions = false,
}: {
  folderPath?: string | null;
  projectWritingInstructions?: Record<string, string>;
  dangerouslySkipPermissions?: boolean;
} = {}) {
  const preflightState = {
    availability: { status: 'ready' },
    markLoginRequired: vi.fn(),
    markMissing: vi.fn(),
  };
  const acpEvents = {
    onTextDelta: vi.fn(async () => () => undefined),
    onComplete: vi.fn(async () => () => undefined),
    onStatus: vi.fn(async () => () => undefined),
    onUserInputRequired: vi.fn(async () => () => undefined),
  };
  const tauriClient = {
    acp: {
      start: vi.fn(async () => {
        await Promise.resolve();
        return { sessionId: 'session-1' };
      }),
      stop: vi.fn(async () => undefined),
      sendPrompt: vi.fn(async () => undefined),
      respondClarification: vi.fn(async () => undefined),
      cancel: vi.fn(async () => undefined),
    },
  };
  const settingsState = {
    settings: {
      ai: {
        systemPrompt: 'Keep the voice spare and precise.',
        projectWritingInstructions,
        dangerouslySkipPermissions,
      },
    },
  };

  vi.doMock('../lib/acp', () => ({ acpEvents }));
  vi.doMock('../lib/tauri', () => ({
    errorMessage: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
    tauriClient,
  }));
  vi.doMock('./preflightStore', () => ({
    usePreflightStore: {
      getState: () => preflightState,
    },
  }));
  vi.doMock('./settingsStore', () => ({
    useSettingsStore: {
      getState: () => settingsState,
    },
  }));
  vi.doMock('./folderStore', () => ({
    useFolderStore: {
      getState: () => ({ path: folderPath }),
    },
  }));

  return { acpEvents, tauriClient };
}

describe('AI store listener setup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('registers ACP listeners and starts the sidecar only once across concurrent startup', async () => {
    const { acpEvents, tauriClient } = installMocks();
    const { useAiStore } = await import('./aiStore');

    await Promise.all([
      useAiStore.getState().startSession('/tmp/project'),
      useAiStore.getState().startSession('/tmp/project'),
    ]);

    expect(acpEvents.onTextDelta).toHaveBeenCalledTimes(1);
    expect(acpEvents.onComplete).toHaveBeenCalledTimes(1);
    expect(acpEvents.onStatus).toHaveBeenCalledTimes(1);
    expect(acpEvents.onUserInputRequired).toHaveBeenCalledTimes(1);
    expect(tauriClient.acp.start).toHaveBeenCalledTimes(1);
    expect(useAiStore.getState().sessionId).toBe('session-1');
  });

  it('submits the current settings system prompt with each AI prompt', async () => {
    const { tauriClient } = installMocks();
    const { useAiStore } = await import('./aiStore');

    await useAiStore.getState().startSession('/tmp/project');
    await useAiStore.getState().submitPrompt('make it warmer', '/tmp/project/README.md');

    expect(tauriClient.acp.sendPrompt).toHaveBeenCalledWith(
      'session-1',
      'make it warmer',
      '/tmp/project/README.md',
      'Keep the voice spare and precise.',
      undefined,
      [],
      [],
      false,
    );
  });

  it('restarts the sidecar and retries once when a prompt hits a broken pipe', async () => {
    const { tauriClient } = installMocks({ folderPath: '/tmp/project' });
    tauriClient.acp.sendPrompt
      .mockRejectedValueOnce(new Error('Broken pipe (os error 32)'))
      .mockResolvedValueOnce(undefined);
    const { useAiStore } = await import('./aiStore');

    await useAiStore.getState().startSession('/tmp/project');
    await useAiStore.getState().submitPrompt('make it warmer', '/tmp/project/README.md');

    expect(tauriClient.acp.stop).toHaveBeenCalledWith('session-1');
    expect(tauriClient.acp.start).toHaveBeenCalledTimes(2);
    expect(tauriClient.acp.sendPrompt).toHaveBeenCalledTimes(2);
    expect(useAiStore.getState().status).toBe('streaming');
  });

  it('submits project writing instructions alongside global writing instructions', async () => {
    const { tauriClient } = installMocks({
      folderPath: '/tmp/project',
      projectWritingInstructions: {
        '/tmp/project': 'Favor vivid chapter endings.',
      },
    });
    const { useAiStore } = await import('./aiStore');

    await useAiStore.getState().startSession('/tmp/project');
    await useAiStore.getState().submitPrompt('make it warmer', '/tmp/project/README.md');

    expect(tauriClient.acp.sendPrompt).toHaveBeenCalledWith(
      'session-1',
      'make it warmer',
      '/tmp/project/README.md',
      [
        'Global writing instructions:\nKeep the voice spare and precise.',
        'Project writing instructions:\nFavor vivid chapter endings.',
      ].join('\n\n'),
      undefined,
      [],
      [],
      false,
    );
  });

  it('submits the Claude Code permission bypass setting with each AI prompt', async () => {
    const { tauriClient } = installMocks({ dangerouslySkipPermissions: true });
    const { useAiStore } = await import('./aiStore');

    await useAiStore.getState().startSession('/tmp/project');
    await useAiStore.getState().submitPrompt('make it warmer', '/tmp/project/README.md');

    expect(tauriClient.acp.sendPrompt).toHaveBeenCalledWith(
      'session-1',
      'make it warmer',
      '/tmp/project/README.md',
      'Keep the voice spare and precise.',
      undefined,
      [],
      [],
      true,
    );
  });

  it('submits document references with the AI prompt', async () => {
    const { tauriClient } = installMocks();
    const { useAiStore } = await import('./aiStore');

    await useAiStore.getState().startSession('/tmp/project');
    await useAiStore.getState().submitPrompt(
      'make it warmer',
      '/tmp/project/README.md',
      undefined,
      [
        {
          name: 'Voice.md',
          relativePath: 'docs/Voice.md',
          path: '/tmp/project/docs/Voice.md',
        },
      ],
    );

    expect(tauriClient.acp.sendPrompt).toHaveBeenCalledWith(
      'session-1',
      'make it warmer',
      '/tmp/project/README.md',
      'Keep the voice spare and precise.',
      undefined,
      [
        {
          name: 'Voice.md',
          relativePath: 'docs/Voice.md',
          path: '/tmp/project/docs/Voice.md',
        },
      ],
      [],
      false,
    );
  });

  it('submits prompt attachments with the AI prompt', async () => {
    const { tauriClient } = installMocks();
    const { useAiStore } = await import('./aiStore');

    await useAiStore.getState().startSession('/tmp/project');
    await useAiStore.getState().submitPrompt(
      'use the screenshot',
      '/tmp/project/README.md',
      undefined,
      [],
      [
        {
          name: 'image.png',
          path: '/tmp/project/image.png',
          size: 1536,
          kind: 'image',
          mimeType: 'image/png',
          previewDataUrl: 'data:image/png;base64,preview',
        },
      ],
    );

    expect(tauriClient.acp.sendPrompt).toHaveBeenCalledWith(
      'session-1',
      'use the screenshot',
      '/tmp/project/README.md',
      'Keep the voice spare and precise.',
      undefined,
      [],
      [
        {
          name: 'image.png',
          path: '/tmp/project/image.png',
          size: 1536,
          kind: 'image',
          mimeType: 'image/png',
          previewDataUrl: 'data:image/png;base64,preview',
        },
      ],
      false,
    );
  });
});
