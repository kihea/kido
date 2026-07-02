import { describe, expect, it } from 'vitest';
import { buildProfile } from './profile';
import { fixtureCorpus } from './fixture.test-helper';

describe('buildProfile', () => {
  const corpus = fixtureCorpus();
  const profile = buildProfile(corpus);

  it('produces excerpt claims (verbatim, supported) for evidenced layers', () => {
    for (const layer of [1, 2, 3, 5] as const) {
      const entry = profile.layers[layer];
      expect(entry.claims.length).toBeGreaterThan(0);
      for (const claim of entry.claims) {
        expect(claim.kind).toBe('excerpt');
        expect(claim.passageIds.length).toBeGreaterThan(0);
        // Extractive averaging: claim text IS a passage text.
        expect(corpus.passages.some((p) => p.text === claim.text)).toBe(true);
      }
    }
  });

  it('builds the neighboring map from source contrasts, with boundary questions', () => {
    expect(profile.neighboring.length).toBeGreaterThan(0);
    const labels = profile.neighboring.map((n) => n.label.toLowerCase());
    expect(labels.some((l) => l.includes('random search'))).toBe(true);
    for (const n of profile.neighboring) {
      expect(n.boundaryQuestion).toContain('gradient descent');
    }
  });

  it('builds the comprising map from composition/dependency sentences', () => {
    expect(profile.comprising.length).toBeGreaterThan(0);
    for (const e of profile.comprising) {
      expect(e.passageIds.length).toBeGreaterThan(0);
      expect(['requires', 'part-of', 'mechanism-of', 'example-of']).toContain(e.relation);
    }
  });

  it('states gaps instead of hiding them', () => {
    for (const g of profile.gaps) {
      expect(profile.layers[g].claims.length).toBe(0);
    }
  });

  it('scores maturity as the share of answerable maturity questions', () => {
    expect(profile.maturity).toBeGreaterThan(0.5); // rich fixture
    expect(profile.maturity).toBeLessThanOrEqual(1);
  });

  it('marks disagreement instead of averaging it away', () => {
    // The paper passage says convergence "remained debated" — tension language.
    const claims = Object.values(profile.layers).flatMap((e) => e.claims);
    const tensioned = claims.filter((c) => c.tension);
    for (const c of tensioned) {
      expect(c.tension).toMatch(/differ/i);
    }
  });
});
