import { describe, expect, it } from 'vitest';
import { clampAtSentence, dropLeadingMeta, isMetaSentence, queryTokens, relevanceOk, stripHtml } from './net';

describe('stripHtml', () => {
  it('removes tags and decodes common entities', () => {
    expect(stripHtml('<p>a &amp; b &#x27;c&#x27;</p>')).toBe("a & b 'c'");
  });
});

describe('meta-sentence trimming', () => {
  it('detects document-describing prose', () => {
    expect(isMetaSentence('This paper examines the causes of inflation.')).toBe(true);
    expect(isMetaSentence('Chapter 2 delves into monetary history.')).toBe(true);
    expect(isMetaSentence('Inflation is a sustained rise in the price level.')).toBe(false);
  });

  it('drops leading meta but keeps substance', () => {
    const text =
      'This article is about the economic phenomenon. Inflation is a sustained rise in the general price level of goods and services in an economy over a period of time, and it erodes purchasing power in ways that are measured by price indices across many categories.';
    const out = dropLeadingMeta(text);
    expect(out.startsWith('Inflation is a sustained rise')).toBe(true);
  });

  it('returns empty when nothing substantial remains', () => {
    expect(dropLeadingMeta('This paper examines things. Here we present results.')).toBe('');
  });
});

describe('clampAtSentence', () => {
  it('leaves short text alone', () => {
    expect(clampAtSentence('Short. Text.', 700, 1100)).toBe('Short. Text.');
  });

  it('cuts long text at a sentence boundary, never mid-word', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog and keeps running through the field. ';
    const long = sentence.repeat(30);
    const out = clampAtSentence(long, 200, 400);
    expect(out.length).toBeLessThanOrEqual(400);
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('relevance', () => {
  it('accepts text where two query terms appear or one recurs', () => {
    const tokens = queryTokens('gradient descent optimization');
    expect(relevanceOk('Gradient descent is used for optimization of models.', tokens)).toBe(true);
    expect(relevanceOk('The descent from the mountain took hours; the descent was steep.', tokens)).toBe(true);
    expect(relevanceOk('A completely unrelated sentence about cooking.', tokens)).toBe(false);
  });
});
