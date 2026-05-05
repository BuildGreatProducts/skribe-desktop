import { useEffect, useState } from 'react';
import {
  characterCount,
  readingLevelLabel,
  readingTimeLabel,
  wordCount,
} from '../../lib/readability';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';

const STATS_DEBOUNCE_MS = 200;

function saveLabel(status: string, lastSavedAt: number | null) {
  if (status === 'editing') return 'Editing...';
  if (status === 'saving') return 'Saving...';
  if (status === 'error') return "Couldn't save";
  if (!lastSavedAt) return 'Saved';
  const seconds = Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000));
  return seconds < 5 ? 'Saved now' : `Saved ${seconds}s ago`;
}

function documentStats(content: string, includeReadingLevel: boolean) {
  const words = wordCount(content);
  return {
    words,
    reading: readingTimeLabel(words),
    characters: characterCount(content),
    readingLevel: includeReadingLevel ? readingLevelLabel(content) : null,
  };
}

export function StatusLine() {
  const show = useSettingsStore((state) => state.settings.ui.showStatusLine);
  const showWordCount = useSettingsStore((state) => state.settings.widgets.wordCount);
  const showCharacterCount = useSettingsStore(
    (state) => state.settings.widgets.characterCount,
  );
  const showReadingLevel = useSettingsStore((state) => state.settings.widgets.readingLevel);
  const content = useEditorStore((state) => state.content);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const [stats, setStats] = useState(() => documentStats(content, showReadingLevel));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStats(documentStats(content, showReadingLevel));
    }, STATS_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [content, showReadingLevel]);

  if (!show) return null;

  return (
    <div
      className="sticky top-[57px] z-20 h-0"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute right-4 top-3 flex flex-col items-end text-right text-xs leading-normal text-chrome-text-soft">
        {showWordCount ? (
          <span>
            {stats.words === 0 ? 'Empty document' : `${stats.words} words (${stats.reading})`}
          </span>
        ) : null}
        {showCharacterCount ? (
          <span>{`${stats.characters.toLocaleString()} ${
            stats.characters === 1 ? 'character' : 'characters'
          }`}</span>
        ) : null}
        {showReadingLevel && stats.readingLevel ? (
          <span>{`Reading level: ${stats.readingLevel}`}</span>
        ) : null}
        <span>{saveLabel(saveStatus, lastSavedAt)}</span>
      </div>
    </div>
  );
}
