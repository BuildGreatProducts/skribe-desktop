import type { AppSettings } from '../types';

export const DEFAULT_GLOBAL_WRITING_INSTRUCTIONS = `Write like a careful human editor, not a content bot.
Use plain, concrete language, vary the rhythm, and keep the author's point of view.
Cut filler, hype, hedging, generic summaries, and stock AI phrasing.
Do not invent facts, sources, or personal experience.`;

const LEGACY_GLOBAL_WRITING_INSTRUCTIONS = `Write like a careful human editor, not a content bot.
- Use plain, concrete language; cut throat-clearing, filler, hedging, and generic summaries.
- Vary rhythm with short and long sentences. Let occasional fragments stand when natural.
- Prefer specific examples, texture, and a clear point of view over vague balanced claims.
- Avoid stock AI phrases like "delve", "leverage", "landscape", "it is important to note", and "in conclusion".
- Never invent personal experience, facts, or sources.`;

export function defaultedGlobalWritingInstructions(instructions: string): string {
  const trimmed = instructions.trim();
  if (!trimmed || trimmed === LEGACY_GLOBAL_WRITING_INSTRUCTIONS.trim()) {
    return DEFAULT_GLOBAL_WRITING_INSTRUCTIONS;
  }
  return instructions;
}

export function settingsWithDefaultWritingInstructions(settings: AppSettings): AppSettings {
  const systemPrompt = defaultedGlobalWritingInstructions(settings.ai.systemPrompt);
  if (systemPrompt === settings.ai.systemPrompt) return settings;

  return {
    ...settings,
    ai: {
      ...settings.ai,
      systemPrompt,
    },
  };
}

export function projectWritingInstructions(
  settings: AppSettings,
  folderPath: string | null,
): string {
  if (!folderPath) return '';
  return settings.ai.projectWritingInstructions?.[folderPath] ?? '';
}

export function buildWritingInstructionsSystemPrompt(
  settings: AppSettings,
  folderPath: string | null,
): string {
  const globalInstructions = defaultedGlobalWritingInstructions(settings.ai.systemPrompt);
  const projectInstructions = projectWritingInstructions(settings, folderPath);
  const hasGlobalInstructions = globalInstructions.trim().length > 0;
  const hasProjectInstructions = projectInstructions.trim().length > 0;

  if (hasGlobalInstructions && hasProjectInstructions) {
    return [
      `Global writing instructions:\n${globalInstructions.trim()}`,
      `Project writing instructions:\n${projectInstructions.trim()}`,
    ].join('\n\n');
  }

  if (hasProjectInstructions) return projectInstructions;
  if (hasGlobalInstructions) return globalInstructions;
  return '';
}
