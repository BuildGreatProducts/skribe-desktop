import { describe, expect, it } from 'vitest';
import {
  assistantTextFromEvent,
  ClaudeStreamTextAccumulator,
} from '../src/claudeStream';

describe('Claude stream parsing', () => {
  it('extracts text from raw and SDK-wrapped stream deltas', () => {
    expect(
      assistantTextFromEvent({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello' },
      }),
    ).toEqual({ text: 'Hello', mode: 'append' });

    expect(
      assistantTextFromEvent({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: ' there' },
        },
      }),
    ).toEqual({ text: ' there', mode: 'append' });
  });

  it('skips final replacements that match the streamed text', () => {
    const accumulator = new ClaudeStreamTextAccumulator();

    expect(
      accumulator.consume({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello' },
      }),
    ).toEqual({ text: 'Hello', mode: 'append' });
    expect(accumulator.consume({ type: 'result', result: 'Hello' })).toBeNull();
  });

  it('uses final result text when no partial text was streamed', () => {
    const accumulator = new ClaudeStreamTextAccumulator();

    expect(accumulator.consume({ type: 'result', result: 'Final answer' })).toEqual({
      text: 'Final answer',
      mode: 'replace',
    });
  });

  it('replaces streamed text when the final result differs', () => {
    const accumulator = new ClaudeStreamTextAccumulator();

    accumulator.consume({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Draft' },
    });

    expect(accumulator.consume({ type: 'result', result: 'Final' })).toEqual({
      text: 'Final',
      mode: 'replace',
    });
  });
});
