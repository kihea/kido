import { describe, expect, it } from 'vitest';
import { rankWorks, reconstructAbstract } from './openalex';

describe('reconstructAbstract', () => {
  it('rebuilds verbatim word order from an inverted index', () => {
    const inv = { Gradient: [0], descent: [1], is: [2], iterative: [3] };
    expect(reconstructAbstract(inv)).toBe('Gradient descent is iterative');
  });
  it('handles repeated words at multiple positions', () => {
    const inv = { the: [0, 2], loss: [1], function: [3] };
    expect(reconstructAbstract(inv)).toBe('the loss the function');
  });
  it('returns empty for a missing index', () => {
    expect(reconstructAbstract(null)).toBe('');
  });
});

describe('rankWorks', () => {
  it('lifts a landmark (highly-cited) paper above a fresh but uncited title match', () => {
    const fresh = { title: 'Fresh', cited_by_count: 0 };
    const landmark = { title: 'Landmark', cited_by_count: 50000 };
    // fresh is first by relevance; citations should still float the landmark up.
    const ranked = rankWorks([fresh, landmark]);
    expect(ranked[0]!.title).toBe('Landmark');
  });

  it('keeps relevance order when citations are comparable', () => {
    const a = { title: 'A', cited_by_count: 10 };
    const b = { title: 'B', cited_by_count: 10 };
    expect(rankWorks([a, b]).map((w) => w.title)).toEqual(['A', 'B']);
  });
});
