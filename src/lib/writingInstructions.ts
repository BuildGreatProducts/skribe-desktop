import type { AppSettings } from '../types';

export const DEFAULT_GLOBAL_WRITING_INSTRUCTIONS = `Write like a careful human editor, not a content bot.
- Use plain, concrete language; cut throat-clearing, filler, hedging, and generic summaries.
- Vary rhythm with short and long sentences. Let occasional fragments stand when natural.
- Prefer specific examples, texture, and a clear point of view over vague balanced claims.
- Avoid stock AI phrases like "delve", "leverage", "landscape", "it is important to note", and "in conclusion".
- Never invent personal experience, facts, or sources.`;

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
  const globalInstructions = settings.ai.systemPrompt;
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
