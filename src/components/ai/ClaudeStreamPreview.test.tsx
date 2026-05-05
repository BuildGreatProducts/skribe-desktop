import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLAUDE_STREAM_DISMISS_MS,
  CLAUDE_STREAM_PLACEHOLDER_HOLD_MS,
  CLAUDE_STREAM_PLACEHOLDER_TYPE_MS,
  CLAUDE_STREAM_PLACEHOLDERS,
  ClaudeStreamPreview,
} from './ClaudeStreamPreview';

function advanceTypedCharacters(count: number) {
  for (let index = 0; index < count; index += 1) {
    act(() => {
      vi.advanceTimersByTime(CLAUDE_STREAM_PLACEHOLDER_TYPE_MS);
    });
  }
}

describe('ClaudeStreamPreview', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('types and cycles placeholder text before Claude returns content', () => {
    vi.useFakeTimers();

    render(
      <ClaudeStreamPreview
        text=""
        visible
        complete={false}
        hasContent={false}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveAccessibleName('Writing...');
    expect(screen.queryByText('Writing...')).not.toBeInTheDocument();

    advanceTypedCharacters(1);
    expect(screen.getByText('W')).toBeInTheDocument();

    advanceTypedCharacters(CLAUDE_STREAM_PLACEHOLDERS[0].length - 1);
    expect(screen.getByText('Writing...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CLAUDE_STREAM_PLACEHOLDER_HOLD_MS);
    });
    expect(screen.getByRole('status')).toHaveAccessibleName('Editing...');
    expect(screen.queryByText('Writing...')).not.toBeInTheDocument();

    advanceTypedCharacters(CLAUDE_STREAM_PLACEHOLDERS[1].length);
    expect(screen.getByText('Editing...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CLAUDE_STREAM_PLACEHOLDER_HOLD_MS);
    });
    advanceTypedCharacters(CLAUDE_STREAM_PLACEHOLDERS[2].length);
    expect(screen.getByText('Refining...')).toBeInTheDocument();
  });

  it('shows streamed content instead of the placeholder once content arrives', () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <ClaudeStreamPreview
        text=""
        visible
        complete={false}
        hasContent={false}
        onDismiss={vi.fn()}
      />,
    );

    advanceTypedCharacters(1);
    expect(screen.getByText('W')).toBeInTheDocument();

    rerender(
      <ClaudeStreamPreview
        text="First chunk"
        visible
        complete={false}
        hasContent
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('First chunk')).toBeInTheDocument();
    expect(screen.queryByText('Editing...')).not.toBeInTheDocument();

    rerender(
      <ClaudeStreamPreview
        text="First chunk plus more"
        visible
        complete={false}
        hasContent
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('First chunk plus more')).toBeInTheDocument();
  });

  it('keeps final content visible and lets the user dismiss it', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <ClaudeStreamPreview
        text="Final Markdown"
        visible
        complete
        hasContent
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText('Final Markdown')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Claude stream preview' }));
    expect(screen.getByRole('status')).toHaveClass('translate-y-full', 'opacity-0');
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(CLAUDE_STREAM_DISMISS_MS);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
