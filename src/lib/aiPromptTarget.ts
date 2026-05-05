import type { AiPromptTarget, HighlightedTextSelection } from '../types';

export const documentPromptTarget: AiPromptTarget = { type: 'document' };

export function targetFromSelection(
  activeFilePath: string,
  selection: HighlightedTextSelection | null,
): AiPromptTarget {
  if (!selection || selection.filePath !== activeFilePath) {
    return documentPromptTarget;
  }

  return { type: 'selection', selection };
}

export function selectedTextForPromptTarget(
  activeFilePath: string,
  target: AiPromptTarget = documentPromptTarget,
) {
  return target.type === 'selection' && target.selection.filePath === activeFilePath
    ? target.selection.text
    : undefined;
}
