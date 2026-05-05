export function shouldApplyStream(previous: string, next: string) {
  return next.length > 0 && next !== previous;
}
