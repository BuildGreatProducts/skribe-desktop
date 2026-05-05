import { XIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

export const CLAUDE_STREAM_PLACEHOLDERS = [
  'Writing...',
  'Editing...',
  'Refining...',
  'Researching...',
] as const;
export const CLAUDE_STREAM_PLACEHOLDER_TYPE_MS = 70;
export const CLAUDE_STREAM_PLACEHOLDER_HOLD_MS = 1200;
export const CLAUDE_STREAM_DISMISS_MS = 220;

type ClaudeStreamPreviewProps = {
  text: string;
  visible: boolean;
  complete: boolean;
  hasContent: boolean;
  onDismiss: () => void;
};

export function ClaudeStreamPreview({
  text,
  visible,
  complete,
  hasContent,
  onDismiss,
}: ClaudeStreamPreviewProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typedCharacterCount, setTypedCharacterCount] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);
  const currentPlaceholder = CLAUDE_STREAM_PLACEHOLDERS[placeholderIndex];

  useEffect(() => {
    if (visible) {
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setDismissing(false);
    }
  }, [text, visible]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible || hasContent || complete) {
      setPlaceholderIndex(0);
      setTypedCharacterCount(0);
      return;
    }

    const placeholderLength = currentPlaceholder.length;
    const timeout = window.setTimeout(
      () => {
        if (typedCharacterCount < placeholderLength) {
          setTypedCharacterCount((count) => Math.min(count + 1, placeholderLength));
          return;
        }

        setPlaceholderIndex((index) => (index + 1) % CLAUDE_STREAM_PLACEHOLDERS.length);
        setTypedCharacterCount(0);
      },
      typedCharacterCount < placeholderLength
        ? CLAUDE_STREAM_PLACEHOLDER_TYPE_MS
        : CLAUDE_STREAM_PLACEHOLDER_HOLD_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [complete, currentPlaceholder, hasContent, typedCharacterCount, visible]);

  if (!visible) return null;

  const displayText = hasContent ? text : currentPlaceholder.slice(0, typedCharacterCount);

  function dismiss() {
    if (dismissing) return;

    setDismissing(true);
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null;
      onDismiss();
    }, CLAUDE_STREAM_DISMISS_MS);
  }

  return (
    <div
      aria-label={!hasContent ? currentPlaceholder : undefined}
      aria-live="polite"
      className={`mx-auto flex max-h-44 w-[min(34rem,calc(100%-4rem))] items-start gap-3 overflow-hidden rounded-t-lg rounded-b-none border border-b-0 border-hairline bg-white/75 p-3 text-ink shadow-modal backdrop-blur-xl transition-[transform,opacity] duration-200 ease-in ${
        dismissing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
      role="status"
    >
      {!complete ? (
        <span
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
        />
      ) : null}
      <div className="skribe-scrollbar max-h-36 min-h-0 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
        {hasContent ? (
          <span>{displayText}</span>
        ) : (
          <span aria-hidden="true" className="block min-h-[1.375rem]">
            {displayText}
            <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-accent" />
          </span>
        )}
      </div>
      {complete ? (
        <button
          aria-label="Dismiss Claude stream preview"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-chrome-text-soft transition hover:bg-chrome-bg hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper"
          type="button"
          onClick={dismiss}
        >
          <XIcon size={15} weight="bold" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
