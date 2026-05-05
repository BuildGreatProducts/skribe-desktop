import { describe, expect, it } from 'vitest';
import {
  characterCount,
  fleschKincaidGradeLevel,
  readingLevelLabel,
  readingTime,
  sentenceCount,
  stripMarkdown,
  syllableCount,
  wordCount,
} from './readability';

describe('readability utilities', () => {
  it('strips common markdown syntax', () => {
    expect(stripMarkdown('# Hello **world** [link](https://example.com)')).toBe(
      'Hello world link',
    );
  });

  it('counts words', () => {
    expect(wordCount('one two\n\nthree')).toBe(3);
  });

  it('counts sentences with and without terminal punctuation', () => {
    expect(sentenceCount('One sentence. Two questions? Three cheers!')).toBe(3);
    expect(sentenceCount('One sentence without a period')).toBe(1);
    expect(sentenceCount('')).toBe(0);
  });

  it('counts readable characters', () => {
    expect(characterCount('## Hello **wide** world')).toBe(16);
  });

  it('estimates English syllables with common endings', () => {
    expect(syllableCount('cat')).toBe(1);
    expect(syllableCount('reading')).toBe(2);
    expect(syllableCount('make')).toBe(1);
    expect(syllableCount('bottle')).toBe(2);
    expect(syllableCount('syllable')).toBe(3);
    expect(syllableCount('2026')).toBe(1);
  });

  it('calculates Flesch-Kincaid grade level from sentence and syllable averages', () => {
    expect(fleschKincaidGradeLevel('The cat sat. The dog ran.')).toBeCloseTo(-2.62, 2);
    expect(
      fleschKincaidGradeLevel(
        'This is a simple sentence. This is another simple sentence.',
      ),
    ).toBeCloseTo(5.24, 2);
  });

  it('labels reading levels for display', () => {
    expect(readingLevelLabel('')).toBeNull();
    expect(readingLevelLabel('The cat sat. The dog ran.')).toBe('Below grade 1');
    expect(
      readingLevelLabel('This is a simple sentence. This is another simple sentence.'),
    ).toBe('Grade 5.2');
  });

  it('calculates reading time at 200 wpm', () => {
    expect(readingTime(400)).toEqual({ minutes: 2, seconds: 0 });
  });
});
