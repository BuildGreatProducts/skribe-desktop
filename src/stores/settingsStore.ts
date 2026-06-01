import { create } from 'zustand';
import { DEFAULT_AGENT_ID } from '../lib/agents';
import { errorMessage, tauriClient } from '../lib/tauri';
import {
  DEFAULT_GLOBAL_WRITING_INSTRUCTIONS,
  settingsWithDefaultWritingInstructions,
} from '../lib/writingInstructions';
import type { AppSettings } from '../types';

export const defaultSettings: AppSettings = {
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
    dangerouslySkipPermissions: false,
    selectedAgent: DEFAULT_AGENT_ID,
    systemPrompt: DEFAULT_GLOBAL_WRITING_INSTRUCTIONS,
    projectWritingInstructions: {},
  },
  preflight: {
    claudeCodeDetected: false,
    claudeCodeVersion: null,
    lastDetectedAt: 0,
  },
};

type SettingsState = {
  settings: AppSettings;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (settings: AppSettings) => Promise<void>;
  update: (recipe: (settings: AppSettings) => AppSettings) => Promise<void>;
  addRecentFolder: (folderPath: string) => Promise<void>;
};

function applyAccent(settings: AppSettings) {
  document.documentElement.dataset.accent = settings.editor.accentColor;
}

function settingsWithDefaults(settings: AppSettings): AppSettings {
  const partial = settings as Partial<AppSettings>;
  const ai = partial.ai ?? defaultSettings.ai;
  return settingsWithDefaultWritingInstructions({
    ...defaultSettings,
    ...settings,
    editor: {
      ...defaultSettings.editor,
      ...partial.editor,
    },
    ui: {
      ...defaultSettings.ui,
      ...partial.ui,
    },
    widgets: {
      ...defaultSettings.widgets,
      ...partial.widgets,
    },
    ai: {
      ...defaultSettings.ai,
      ...ai,
      projectWritingInstructions:
        ai.projectWritingInstructions ?? defaultSettings.ai.projectWritingInstructions,
    },
    preflight: {
      ...defaultSettings.preflight,
      ...partial.preflight,
    },
  });
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  error: null,
  load: async () => {
    try {
      const settings = settingsWithDefaults(await tauriClient.settings.load());
      applyAccent(settings);
      set({ settings, loaded: true, error: null });
    } catch (error) {
      set({ settings: defaultSettings, loaded: true, error: errorMessage(error) });
    }
  },
  save: async (settings) => {
    applyAccent(settings);
    set({ settings, error: null });
    await tauriClient.settings.save(settings);
  },
  update: async (recipe) => {
    const next = recipe(get().settings);
    await get().save(next);
  },
  addRecentFolder: async (folderPath) => {
    try {
      const settings = settingsWithDefaults(
        await tauriClient.settings.addRecentFolder(folderPath),
      );
      applyAccent(settings);
      set({ settings });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
}));
