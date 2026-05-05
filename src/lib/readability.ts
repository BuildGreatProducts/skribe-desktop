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
