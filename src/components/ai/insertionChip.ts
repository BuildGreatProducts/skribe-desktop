const CHIP_LABEL_LENGTH = 12;

const FALLBACK_LABEL = 'Insert here';

export function insertionChipLabel(snippet?: string | null): string {
  const collapsed = (snippet ?? '').replace(/\s+/g, ' ').trim();
  if (!collapsed) return FALLBACK_LABEL;
  return collapsed.length > CHIP_LABEL_LENGTH
    ? `${collapsed.slice(0, CHIP_LABEL_LENGTH)}...`
    : collapsed;
}
