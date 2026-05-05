import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../../stores/editorStore';
import { defaultSettings, useSettingsStore } from '../../stores/settingsStore';
import { StatusLine } from './StatusLine';

const readableContent = 'This is a simple sentence. This is another simple sentence.';

describe('StatusLine', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: {
        ...defaultSettings,
        widgets: {
          ...defaultSettings.widgets,
          readingLevel: true,
        },
      },
    });
    useEditorStore.setState({
      content: readableContent,
      saveStatus: 'saved',
      lastSavedAt: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the reading level widget when enabled', () => {
    render(<StatusLine />);

    expect(screen.getByText('Reading level: Grade 5.2')).toBeInTheDocument();
  });

  it('hides the reading level widget when disabled', () => {
    useSettingsStore.setState({
      settings: {
        ...defaultSettings,
        widgets: {
          ...defaultSettings.widgets,
          readingLevel: false,
        },
      },
    });

    render(<StatusLine />);

    expect(screen.queryByText(/Reading level:/)).not.toBeInTheDocument();
  });
});
