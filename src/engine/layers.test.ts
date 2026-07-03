import { describe, expect, it } from 'vitest';
import { LAYERS } from '../core/types';
import { MIRROR_PAIRS, MIRROR_STACK, mirrorLayer, mirrorPairOf } from './layers';

describe('mirror helpers (framework Ch 10)', () => {
  it('mirrorLayer is the involution l ↦ 8 − l', () => {
    for (const l of LAYERS) {
      expect(mirrorLayer(l)).toBe((8 - l) as typeof l);
      expect(mirrorLayer(mirrorLayer(l))).toBe(l);
    }
  });

  it('L4 is the unique fixed point (the axis of symmetry)', () => {
    expect(LAYERS.filter((l) => mirrorLayer(l) === l)).toEqual([4]);
  });

  it('both members of a pair resolve to the same MirrorPair object and contain the layer', () => {
    for (const l of LAYERS) {
      const pair = mirrorPairOf(l);
      expect(mirrorPairOf(l)).toBe(mirrorPairOf(mirrorLayer(l)));
      expect([pair.lower, pair.upper]).toContain(l);
    }
    expect(mirrorPairOf(0).name).toBe('the two nothingnesses');
    expect(mirrorPairOf(3).name).toBe('the two limits');
  });

  it('MIRROR_STACK covers all nine layers exactly once', () => {
    expect([...MIRROR_STACK.flat()].sort((a, b) => a - b)).toEqual([...LAYERS]);
  });

  it('every pair carries a learner-facing name and gloss', () => {
    for (const p of MIRROR_PAIRS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.gloss.length).toBeGreaterThan(0);
    }
  });
});
