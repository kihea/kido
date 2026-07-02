import { describe, expect, it } from 'vitest';
import { buildDiagnostic, chooseTargetLayer, inferDomainFamily, moveForLayer } from './diagnose';
import { buildProfile } from './profile';
import { fixtureCorpus } from './fixture.test-helper';
import { applyEvidence, initMastery } from './mastery';
import type { EvidenceEvent, Layer } from '../core/types';

const T0 = 1_750_000_000_000;

describe('inferDomainFamily', () => {
  it('recognizes ML topics from the topic string alone', () => {
    expect(inferDomainFamily('gradient descent training')).toBe('ml');
  });
  it('recognizes history topics', () => {
    expect(inferDomainFamily('the French revolution')).toBe('history');
  });
  it('falls back to general for weak signal', () => {
    expect(inferDomainFamily('coffee')).toBe('general');
  });
});

describe('chooseTargetLayer', () => {
  const profile = buildProfile(fixtureCorpus());

  it('targets only layers the profile can actually teach', () => {
    const layer = chooseTargetLayer(profile, initMastery(), 'ml', T0);
    const teachable = profile.layers[layer].claims.length > 0 || (layer === 3 && profile.neighboring.length > 0);
    expect(teachable).toBe(true);
  });

  it('moves away from a layer once it is demonstrated strong', () => {
    let mastery = initMastery();
    const first = chooseTargetLayer(profile, mastery, 'ml', T0);
    for (let i = 0; i < 4; i++) {
      const e: EvidenceEvent = { at: T0 + i, layer: first, kind: 'retrieval', outcome: 'pass' };
      mastery = applyEvidence(mastery, e);
    }
    const second = chooseTargetLayer(profile, mastery, 'ml', T0 + 10);
    expect(second).not.toBe(first);
  });
});

describe('moveForLayer', () => {
  it('maps every layer to its move per the spec table', () => {
    const expected: Record<Layer, string> = {
      0: 'direct-explanation',
      1: 'direct-explanation',
      2: 'gradient-prompt',
      3: 'boundary-test',
      4: 'worked-example',
      5: 'sequence-reconstruction',
      6: 'feynman',
      7: 'map-repair',
      8: 'principle-transfer',
    };
    for (const [layer, move] of Object.entries(expected)) {
      expect(moveForLayer(Number(layer) as Layer)).toBe(move);
    }
  });
});

describe('buildDiagnostic', () => {
  it('asks one question with layer-mapped options drawn from evidenced layers', () => {
    const profile = buildProfile(fixtureCorpus());
    const card = buildDiagnostic(profile, 'ml');
    expect(card.options.length).toBeGreaterThanOrEqual(2);
    expect(card.options.length).toBeLessThanOrEqual(4);
    for (const o of card.options) {
      const teachable = profile.layers[o.layer].claims.length > 0 || (o.layer === 3 && profile.neighboring.length > 0);
      expect(teachable).toBe(true);
    }
    expect(card.reason.length).toBeGreaterThan(0);
  });
});
