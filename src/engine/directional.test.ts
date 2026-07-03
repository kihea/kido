import { describe, expect, it } from 'vitest';
import {
  KIND_DIRECTION,
  applyDirectionalEvidence,
  effectiveMastery,
  initDirection,
} from './mastery';
import { LAYER_DIRECTION, describeImbalance, detectImbalance } from './diagnose';
import type { Direction, EvidenceEvent, EvidenceKind } from '../core/types';

const T0 = 1_750_000_000_000;
const DAY = 86_400_000;

function ev(kind: EvidenceKind, outcome: 'pass' | 'partial' | 'miss' | 'skipped', at = T0): EvidenceEvent {
  return { at, layer: 6, kind, outcome };
}

describe('directional competence (framework Ch 13–14)', () => {
  it('KIND_DIRECTION covers every EvidenceKind', () => {
    const kinds: EvidenceKind[] = [
      'identify',
      'gradient',
      'boundary',
      'instantiate',
      'sequence',
      'retrieval',
      'feynman',
      'map-repair',
      'transfer',
      'potential',
    ];
    for (const k of kinds) expect(['up', 'down']).toContain(KIND_DIRECTION[k]);
  });

  it('the directional ledger starts unknown', () => {
    const d = initDirection();
    expect(effectiveMastery(d.up, T0)).toBeNull();
    expect(effectiveMastery(d.down, T0)).toBeNull();
  });

  it('a boundary pass moves down and only down; a feynman pass moves up', () => {
    const afterBoundary = applyDirectionalEvidence(initDirection(), ev('boundary', 'pass'));
    expect(afterBoundary.down.value).toBe(1);
    expect(afterBoundary.down.evidence).toBe(1);
    expect(afterBoundary.up.evidence).toBe(0);
    const afterFeynman = applyDirectionalEvidence(initDirection(), ev('feynman', 'pass'));
    expect(afterFeynman.up.value).toBe(1);
    expect(afterFeynman.down.evidence).toBe(0);
  });

  it('skips carry no directional evidence', () => {
    expect(applyDirectionalEvidence(initDirection(), ev('transfer', 'skipped'))).toEqual(initDirection());
  });

  it('directional EWMA matches the layer EWMA formula', () => {
    let d = initDirection();
    d = applyDirectionalEvidence(d, ev('transfer', 'pass')); // down = 1
    d = applyDirectionalEvidence(d, ev('transfer', 'miss', T0 + 1)); // 1 + 0.5*(0.1-1) = 0.55
    expect(d.down.evidence).toBe(2);
    expect(d.down.value).toBeCloseTo(0.55, 5);
  });

  it('no imbalance until both directions clear the evidence gate', () => {
    let d = initDirection();
    for (let i = 0; i < 3; i++) d = applyDirectionalEvidence(d, ev('feynman', 'pass', T0 + i));
    expect(detectImbalance(d, T0)).toBeNull(); // down has no evidence
    for (let i = 0; i < 3; i++) d = applyDirectionalEvidence(d, ev('boundary', 'miss', T0 + i));
    expect(detectImbalance(d, T0)).not.toBeNull();
  });

  it('detects stuck ascending and stuck descending symmetrically', () => {
    let up = initDirection();
    for (let i = 0; i < 3; i++) up = applyDirectionalEvidence(up, ev('feynman', 'pass', T0 + i));
    for (let i = 0; i < 3; i++) up = applyDirectionalEvidence(up, ev('boundary', 'miss', T0 + i));
    const asc = detectImbalance(up, T0)!;
    expect(asc.weak).toBe('down');
    expect(describeImbalance(asc).label).toBe('stuck-ascending');
    expect(describeImbalance(asc).line).toMatch(/apply it/i);

    let down = initDirection();
    for (let i = 0; i < 3; i++) down = applyDirectionalEvidence(down, ev('boundary', 'pass', T0 + i));
    for (let i = 0; i < 3; i++) down = applyDirectionalEvidence(down, ev('feynman', 'miss', T0 + i));
    const desc = detectImbalance(down, T0)!;
    expect(desc.weak).toBe('up');
    expect(describeImbalance(desc).label).toBe('stuck-descending');
  });

  it('small gaps are noise, not imbalance', () => {
    let d = initDirection();
    for (let i = 0; i < 3; i++) d = applyDirectionalEvidence(d, ev('feynman', 'pass', T0 + i)); // up = 1
    d = applyDirectionalEvidence(d, ev('boundary', 'pass', T0)); // down = 1
    d = applyDirectionalEvidence(d, ev('boundary', 'pass', T0 + 1)); // down = 1
    d = applyDirectionalEvidence(d, ev('boundary', 'partial', T0 + 2)); // 1 + (1/3)(0.55-1) = 0.85; gap 0.15
    expect(detectImbalance(d, T0)).toBeNull();
  });

  it('staleness alone can open a real imbalance', () => {
    let d = initDirection();
    for (let i = 0; i < 3; i++) d = applyDirectionalEvidence(d, ev('feynman', 'pass', T0 + i)); // up fresh
    for (let i = 0; i < 3; i++) d = applyDirectionalEvidence(d, ev('boundary', 'pass', T0 - 90 * DAY + i)); // down stale
    expect(detectImbalance(d, T0)).not.toBeNull();
    expect(detectImbalance(d, T0)!.weak).toBe('down');
  });

  it('LAYER_DIRECTION agrees with KIND_DIRECTION at each home layer', () => {
    const at: [number, EvidenceKind][] = [
      [1, 'identify'],
      [2, 'gradient'],
      [3, 'boundary'],
      [4, 'instantiate'],
      [5, 'sequence'],
      [7, 'map-repair'],
      [8, 'transfer'],
    ];
    for (const [layer, kind] of at) {
      expect(LAYER_DIRECTION[layer as 1]).toBe(KIND_DIRECTION[kind] as Direction);
    }
    expect(LAYER_DIRECTION[6]).toBe(KIND_DIRECTION.feynman);
    expect(LAYER_DIRECTION[0 as 1]).toBeUndefined();
  });
});
