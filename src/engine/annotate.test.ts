import { describe, expect, it } from 'vitest';
import { annotationCoverage, dominantLayer, heuristicTags } from './annotate';
import { fixturePassages } from './fixture.test-helper';
import type { Passage } from '../core/types';

function layersOf(text: string): number[] {
  return heuristicTags(text).map((t) => t.layer);
}

describe('heuristicTags', () => {
  it('tags explicit definitions as existence (L1)', () => {
    expect(layersOf('A derivative refers to the instantaneous rate of change.')).toContain(1);
  });

  it('tags gradients and quantities as extent (L2)', () => {
    expect(layersOf('The learning rate controls the step size, and higher values diverge more than lower ones.')).toContain(2);
  });

  it('tags contrast markers as boundary (L3)', () => {
    expect(layersOf('Unlike random search, gradient descent uses slope information.')).toContain(3);
  });

  it('tags example markers as embodiment (L4)', () => {
    expect(layersOf('For example, consider fitting a line to data.')).toContain(4);
  });

  it('tags process language as time (L5)', () => {
    expect(layersOf('First the gradient is computed, then the parameters are updated during each step of the process.')).toContain(5);
  });

  it('tags abstraction statements as concept (L6)', () => {
    expect(layersOf('In general, gradient descent is a form of local optimization.')).toContain(6);
  });

  it('tags system relations as structure (L7)', () => {
    expect(layersOf('The training system consists of interacting components within the larger framework.')).toContain(7);
  });

  it('tags invariants as principle (L8)', () => {
    expect(layersOf('The principle of conservation governs the whole structure and cannot be violated.')).toContain(8);
  });

  it('records the cue that produced every tag', () => {
    for (const tag of heuristicTags('Unlike Newton’s method, this always converges.')) {
      expect(tag.cue.length).toBeGreaterThan(0);
      expect(tag.by).toBe('heuristic');
    }
  });

  it('reinforces a layer when multiple distinct cues fire', () => {
    const single = heuristicTags('The rate increases.').find((t) => t.layer === 2);
    const double = heuristicTags('The rate increases more than the proportion decreases.').find((t) => t.layer === 2);
    expect(double!.confidence).toBeGreaterThan(single!.confidence);
  });
});

describe('dominantLayer / coverage', () => {
  it('defaults to concept (L6) for cue-free text', () => {
    const p: Passage = { id: 'x', docId: 'd', text: 'Plain words only here today friend.', index: 0, layers: [] };
    expect(dominantLayer(p)).toBe(6);
  });

  it('reports per-layer coverage over an annotated corpus', () => {
    const passages = fixturePassages();
    for (const p of passages) p.layers = heuristicTags(p.text);
    const cov = annotationCoverage(passages);
    expect(cov[3]).toBeGreaterThan(0); // the fixture has contrast passages
    expect(cov[5]).toBeGreaterThan(0);
    for (const v of Object.values(cov)) expect(v).toBeLessThanOrEqual(1);
  });
});
