import { describe, expect, it } from 'vitest';
import { characterCount, readingTime, stripMarkdown, wordCount } from './readability';

describe('readability utilities', () => {
  it('strips common markdown syntax', () => {
    expect(stripMarkdown('# Hello **world** [link](https://example.com)')).toBe(
      'Hello world link',
    );
  });

  it('counts words', () => {
    expect(wordCount('one two\n\nthree')).toBe(3);
  });

  it('counts readable characters', () => {
    expect(characterCount('## Hello **wide** world')).toBe(16);
  });

  it('calculates reading time at 200 wpm', () => {
    expect(readingTime(400)).toEqual({ minutes: 2, seconds: 0 });
  });
});
