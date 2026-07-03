import { describe, expect, it } from 'vitest';
import { applyEvidence, detectCollapse, initMastery } from './mastery';
import { chooseTargetLayer } from './diagnose';
import { buildProfile } from './profile';
import { fixtureCorpus } from './fixture.test-helper';
import type { EvidenceEvent, Layer } from '../core/types';

const T0 = 1_750_000_000_000;
const DAY = 86_400_000;

function seed(pairs: [Layer, 'pass' | 'partial' | 'miss', number?][]): ReturnType<typeof initMastery> {
  let m = initMastery();
  for (const [layer, outcome, at] of pairs) {
    const e: EvidenceEvent = { at: at ?? T0, layer, kind: 'retrieval', outcome };
    m = applyEvidence(m, e);
  }
  return m;
}

const strongUppers: [Layer, 'pass' | 'partial' | 'miss', number?][] = [
  [6, 'pass'],
  [6, 'pass'],
  [7, 'pass'],
  [7, 'pass'],
  [8, 'pass'],
  [8, 'pass'],
];

describe('collapse detection (framework Ch 8, 14)', () => {
  it('an all-untested profile is never flagged', () => {
    expect(detectCollapse(initMastery(), T0)).toBeNull();
  });

  it('fluent upper layers over an untested anchor flag possible collapse', () => {
    const sig = detectCollapse(seed(strongUppers), T0)!;
    expect(sig).not.toBeNull();
    expect(sig.anchorState).toBe('untested');
    expect(sig.anchorLayer).toBe(4);
    expect(sig.upperLayers).toEqual([6, 7, 8]);
    expect(sig.severity).toBeCloseTo(0.6, 2);
    expect(sig.reason).toMatch(/embodiment/);
  });

  it('a single lucky pass upstairs is not enough evidence', () => {
    expect(detectCollapse(seed([[6, 'pass']]), T0)).toBeNull(); // evidence 1 < 2
  });

  it('a demonstrated anchor clears the signal, even a single fresh partial', () => {
    expect(detectCollapse(seed([...strongUppers, [4, 'pass']]), T0)).toBeNull();
    expect(detectCollapse(seed([...strongUppers, [4, 'partial']]), T0)).toBeNull(); // 0.55 > 0.45
  });

  it('an anchor that fails under exertion escalates the signal', () => {
    const sig = detectCollapse(seed([...strongUppers, [4, 'miss'], [4, 'miss', T0 + 1]]), T0)!;
    expect(sig.anchorState).toBe('failing');
    expect(sig.severity).toBeCloseTo(0.9, 2);
    expect(sig.severity).toBeGreaterThan(0.6);
  });

  it('stale upper mastery decays out of the signal', () => {
    expect(detectCollapse(seed(strongUppers), T0 + 180 * DAY)).toBeNull();
  });

  it('middling upper mastery does not cry wolf', () => {
    const middling: [Layer, 'pass' | 'partial' | 'miss'][] = [
      [6, 'partial'],
      [6, 'partial'],
      [7, 'partial'],
      [7, 'partial'],
    ];
    expect(detectCollapse(seed(middling), T0)).toBeNull(); // 0.55 < 0.7
  });

  it('collapse steers the target to the embodiment anchor when teachable', () => {
    const profile = buildProfile(fixtureCorpus());
    if (profile.layers[4].claims.length > 0) {
      expect(chooseTargetLayer(profile, seed(strongUppers), 'ml', T0)).toBe(4);
    }
  });

  it('the override releases after one anchor pass', () => {
    const profile = buildProfile(fixtureCorpus());
    if (profile.layers[4].claims.length > 0) {
      const cleared = seed([...strongUppers, [4, 'pass']]);
      expect(chooseTargetLayer(profile, cleared, 'ml', T0)).not.toBe(4);
    }
  });
});
