import { describe, expect, it } from 'vitest';
import { applyEvidence, effectiveMastery, initMastery, masteryConfidence, weakestLayers } from './mastery';
import type { EvidenceEvent } from '../core/types';

const T0 = 1_750_000_000_000;
const DAY = 86_400_000;

function ev(layer: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, outcome: 'pass' | 'partial' | 'miss' | 'skipped', at = T0, hinted = false): EvidenceEvent {
  return { at, layer, kind: 'retrieval', outcome, ...(hinted ? { hinted: true } : {}) };
}

describe('mastery', () => {
  it('starts unknown: zero evidence everywhere, effective mastery null', () => {
    const m = initMastery();
    for (const l of [0, 1, 2, 3, 4, 5, 6, 7, 8] as const) {
      expect(m[l].evidence).toBe(0);
      expect(effectiveMastery(m[l], T0)).toBeNull();
    }
  });

  it('first evidence sets the estimate directly; later evidence refines', () => {
    let m = initMastery();
    m = applyEvidence(m, ev(3, 'pass'));
    expect(m[3].value).toBe(1);
    m = applyEvidence(m, ev(3, 'miss'));
    expect(m[3].value).toBeLessThan(1);
    expect(m[3].value).toBeGreaterThan(0);
    expect(m[3].evidence).toBe(2);
  });

  it('a hinted pass counts for less than a clean pass', () => {
    const clean = applyEvidence(initMastery(), ev(2, 'pass'));
    const hinted = applyEvidence(initMastery(), ev(2, 'pass', T0, true));
    expect(hinted[2].value).toBeLessThan(clean[2].value);
  });

  it('skips carry no evidence', () => {
    const m = applyEvidence(initMastery(), ev(4, 'skipped'));
    expect(m[4].evidence).toBe(0);
  });

  it('discounts stale mastery at read time without mutating the record', () => {
    const m = applyEvidence(initMastery(), ev(5, 'pass'));
    const fresh = effectiveMastery(m[5], T0)!;
    const stale = effectiveMastery(m[5], T0 + 90 * DAY)!;
    expect(stale).toBeLessThan(fresh);
    expect(stale).toBeGreaterThan(0); // stale ≠ forgotten outright
    expect(m[5].value).toBe(1); // ledger untouched
  });

  it('ranks unknown layers as weakest', () => {
    let m = initMastery();
    m = applyEvidence(m, ev(6, 'pass'));
    const order = weakestLayers(m, T0);
    expect(order[order.length - 1]).toBe(6);
    expect(order.slice(0, 3).every((l) => m[l].evidence === 0)).toBe(true);
  });

  it('confidence grows with evidence count', () => {
    let m = initMastery();
    expect(masteryConfidence(m[1])).toBe(0);
    m = applyEvidence(m, ev(1, 'pass'));
    const one = masteryConfidence(m[1]);
    m = applyEvidence(m, ev(1, 'pass', T0 + 1));
    expect(masteryConfidence(m[1])).toBeGreaterThan(one);
  });
});
