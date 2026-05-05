import { describe, expect, it } from 'vitest';
import { streamPreviewFromDelta, type StreamPreview } from './aiStore';

const emptyPreview: StreamPreview = {
  text: '',
  visible: true,
  complete: false,
  hasContent: false,
};

describe('streamPreviewFromDelta', () => {
  it('starts with the first Claude text delta', () => {
    expect(streamPreviewFromDelta(emptyPreview, 'Hello')).toEqual({
      text: 'Hello',
      visible: true,
      complete: false,
      hasContent: true,
    });
  });

  it('appends following deltas and honors replace deltas', () => {
    const withContent = streamPreviewFromDelta(emptyPreview, 'Hello');

    expect(streamPreviewFromDelta(withContent, ' there')).toEqual({
      text: 'Hello there',
      visible: true,
      complete: false,
      hasContent: true,
    });

    expect(streamPreviewFromDelta(withContent, 'Fresh text', true)).toEqual({
      text: 'Fresh text',
      visible: true,
      complete: false,
      hasContent: true,
    });
  });
});
