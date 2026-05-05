export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(markdown: string): number {
  const stripped = stripMarkdown(markdown);
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(Boolean).length;
}

export function characterCount(markdown: string): number {
  return stripMarkdown(markdown).length;
}

export function sentenceCount(markdown: string): number {
  const stripped = stripMarkdown(markdown);
  if (!stripped) return 0;

  const sentences =
    stripped.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) ?? [];

  return sentences.filter((sentence) => wordCount(sentence) > 0).length;
}

export function syllableCount(word: string): number {
  const normalized = word
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');

  if (!normalized) return 0;
  if (/\d/.test(normalized)) return 1;

  const letters = normalized.replace(/[^a-z]/g, '');
  if (!letters) return 1;

  let count = letters.match(/[aeiouy]+/g)?.length ?? 0;
  const hasSilentE = letters.endsWith('e') && !/[^aeiouy]le$/.test(letters);
  if (hasSilentE && count > 1) count -= 1;

  const hasSilentEnding =
    /[^aeiouy](?:ed|es)$/.test(letters) &&
    !/(?:ted|ded|ses|xes|zes|ches|shes)$/.test(letters);
  if (hasSilentEnding && count > 1) count -= 1;

  return Math.max(1, count);
}

export function fleschKincaidGradeLevel(markdown: string): number | null {
  const stripped = stripMarkdown(markdown);
  if (!stripped) return null;

  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const sentences = sentenceCount(stripped);
  if (sentences === 0) return null;

  const syllables = words.reduce((total, word) => total + syllableCount(word), 0);
  if (syllables === 0) return null;

  const averageSentenceLength = words.length / sentences;
  const averageSyllablesPerWord = syllables / words.length;
  return 0.39 * averageSentenceLength + 11.8 * averageSyllablesPerWord - 15.59;
}

export function readingLevelLabel(markdown: string): string | null {
  const grade = fleschKincaidGradeLevel(markdown);
  if (grade === null) return null;
  if (grade < 1) return 'Below grade 1';
  return `Grade ${grade.toFixed(1)}`;
}

export function readingTime(words: number): { minutes: number; seconds: number } {
  const totalSeconds = Math.max(0, Math.round((words / 200) * 60));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

export function readingTimeLabel(words: number): string {
  if (words === 0) return 'Empty document';
  const time = readingTime(words);
  if (time.minutes === 0) return '<1 min';
  return `${time.minutes} min`;
}
