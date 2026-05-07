import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../types';
import {
  DEFAULT_GLOBAL_WRITING_INSTRUCTIONS,
  buildWritingInstructionsSystemPrompt,
  defaultedGlobalWritingInstructions,
  settingsWithDefaultWritingInstructions,
} from './writingInstructions';

const baseSettings: AppSettings = {
  schemaVersion: 1,
  recentFolders: [],
  lastOpenedFolder: null,
  editor: {
    fontSize: 18,
    accentColor: 'deep-ink',
    lineHeight: 1.7,
  },
  ui: {
    fileTreeWidth: 240,
    showStatusLine: true,
  },
  widgets: {
    wordCount: true,
    characterCount: true,
    readingLevel: true,
  },
  ai: {
    autoFocusInputOnFolderOpen: false,
    dangerouslySkipPermissions: false,
    systemPrompt: DEFAULT_GLOBAL_WRITING_INSTRUCTIONS,
    projectWritingInstructions: {},
  },
  preflight: {
    claudeCodeDetected: false,
    claudeCodeVersion: null,
    lastDetectedAt: 0,
  },
};

describe('writing instructions', () => {
  it('uses the default global writing instructions when settings are blank', () => {
    expect(defaultedGlobalWritingInstructions('   ')).toBe(
      DEFAULT_GLOBAL_WRITING_INSTRUCTIONS,
    );
  });

  it('hydrates blank saved settings with editable default instructions', () => {
    const settings = settingsWithDefaultWritingInstructions({
      ...baseSettings,
      ai: { ...baseSettings.ai, systemPrompt: '' },
    });

    expect(settings.ai.systemPrompt).toBe(DEFAULT_GLOBAL_WRITING_INSTRUCTIONS);
  });

  it('builds the system prompt from global and project instructions', () => {
    const systemPrompt = buildWritingInstructionsSystemPrompt(
      {
        ...baseSettings,
        ai: {
          ...baseSettings.ai,
          projectWritingInstructions: {
            '/tmp/project': 'Keep chapter endings vivid.',
          },
        },
      },
      '/tmp/project',
    );

    expect(systemPrompt).toBe(
      [
        `Global writing instructions:\n${DEFAULT_GLOBAL_WRITING_INSTRUCTIONS}`,
        'Project writing instructions:\nKeep chapter endings vivid.',
      ].join('\n\n'),
    );
  });
});
