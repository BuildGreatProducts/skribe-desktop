export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let timeout: number | undefined;
  return (...args: Parameters<T>) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), wait);
  };
}
