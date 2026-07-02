import { describe, expect, it } from 'vitest';
import { analyzeCorpus, resolveTopicConcept } from './corpus';
import { fixtureCorpus, fixtureDocs, fixturePassages } from './fixture.test-helper';

describe('analyzeCorpus', () => {
  it('finds terms that recur across independent sources', () => {
    const corpus = fixtureCorpus();
    const ids = corpus.concepts.map((c) => c.id);
    expect(ids).toContain('gradient descent');
    expect(ids).toContain('loss function');
    expect(ids).toContain('learning rate');
  });

  it('marks cross-source recurring phrases as important', () => {
    const corpus = fixtureCorpus();
    const lossFn = corpus.concepts.find((c) => c.id === 'loss function');
    expect(lossFn?.important).toBe(true);
  });

  it('finds the passage that defines a concept', () => {
    const corpus = fixtureCorpus();
    const gd = corpus.concepts.find((c) => c.id === 'gradient descent');
    expect(gd?.definedByPassage).toBe('p_0'); // "Gradient descent is an optimization algorithm…"
  });

  it('connects passages through shared important concepts, capped per passage', () => {
    const corpus = fixtureCorpus();
    let total = 0;
    for (const [, conns] of corpus.connections) {
      expect(conns.length).toBeLessThanOrEqual(6);
      total += conns.length;
      for (const c of conns) {
        expect(c.via.length).toBeGreaterThan(0);
        expect(c.strength).toBeGreaterThan(0);
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it('is deterministic: same input, same concepts in the same order', () => {
    const a = analyzeCorpus('gradient descent', fixtureDocs, fixturePassages());
    const b = analyzeCorpus('gradient descent', fixtureDocs, fixturePassages());
    expect(a.concepts.map((c) => c.id)).toEqual(b.concepts.map((c) => c.id));
  });
});

describe('resolveTopicConcept', () => {
  it('resolves the session topic to its corpus concept', () => {
    const corpus = fixtureCorpus();
    expect(resolveTopicConcept(corpus)?.id).toBe('gradient descent');
  });
});
