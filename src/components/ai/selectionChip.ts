const CHIP_LABEL_LENGTH = 10;

export function selectionChipLabel(text: string) {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > CHIP_LABEL_LENGTH
    ? `${collapsed.slice(0, CHIP_LABEL_LENGTH)}...`
    : collapsed;
}
