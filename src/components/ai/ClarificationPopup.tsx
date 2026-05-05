import { useEffect, useState } from 'react';
import { useAiStore } from '../../stores/aiStore';
import { Button, Input } from '../ui';

export function ClarificationPopup() {
  const pending = useAiStore((state) => state.pendingClarification);
  const respond = useAiStore((state) => state.respondClarification);
  const cancel = useAiStore((state) => state.cancel);
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!pending) return;
      if (event.key === 'Escape') void cancel();
      const numeric = Number(event.key);
      if (numeric >= 1 && numeric <= pending.options.length) {
        const option = pending.options[numeric - 1];
        void respond(option.id, null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancel, pending, respond]);

  if (!pending) return null;

  return (
    <div className="absolute bottom-[calc(100%+12px)] left-1/2 z-30 w-[min(400px,calc(100vw-48px))] -translate-x-1/2 rounded-lg bg-paper p-4 text-ink shadow-modal">
      <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-paper" />
      <p className="relative mb-3 text-sm font-semibold">{pending.question}</p>
      <div className="relative space-y-2">
        {pending.options.map((option, index) => (
          <button
            type="button"
            key={option.id}
            className="block w-full rounded-md border border-hairline px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-chrome-bg"
            onClick={() => void respond(option.id, null)}
          >
            <span className="mr-2 text-chrome-text-soft">{index + 1}</span>
            {option.label}
            {option.description ? (
              <span className="block pl-5 text-xs text-chrome-text-soft">{option.description}</span>
            ) : null}
          </button>
        ))}
        {pending.freeForm ? (
          <div className="flex gap-2">
            <Input
              value={freeText}
              placeholder="Write a response..."
              onChange={(event) => setFreeText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void respond(null, freeText);
              }}
            />
            <Button disabled={!freeText.trim()} onClick={() => void respond(null, freeText)}>
              Send
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
