import { describe, expect, it } from 'vitest';
import { relationTargets } from './wikidata';
import { mergeStructuredRelations } from '../engine/profile';
import { buildProfile } from '../engine/profile';
import { fixtureCorpus } from '../engine/fixture.test-helper';

const claim = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });

describe('relationTargets', () => {
  it('maps has-part and uses to comprising, different-from to neighboring', () => {
    const t = relationTargets({
      P527: [claim('Q1'), claim('Q2')],
      P2283: [claim('Q3')],
      P1889: [claim('Q4')],
      P9999: [claim('Q5')], // irrelevant property ignored
    });
    expect(t.comprising).toEqual([
      { id: 'Q1', relation: 'part-of' },
      { id: 'Q2', relation: 'part-of' },
      { id: 'Q3', relation: 'requires' },
    ]);
    expect(t.neighboring).toEqual(['Q4']);
  });

  it('tolerates malformed claims', () => {
    const t = relationTargets({ P527: [{}, claim('Q1')] });
    expect(t.comprising).toEqual([{ id: 'Q1', relation: 'part-of' }]);
  });
});

describe('mergeStructuredRelations', () => {
  const profile = buildProfile(fixtureCorpus());

  it('adds new ontology edges without duplicating text-derived ones', () => {
    const existingNeighbor = profile.neighboring[0]!.label;
    const merged = mergeStructuredRelations(profile, {
      comprising: [{ label: 'objective function', relation: 'requires' }],
      neighboring: [{ label: existingNeighbor }, { label: 'simulated annealing' }],
    });
    expect(merged.comprising.some((e) => e.label === 'objective function' && e.passageIds.length === 0)).toBe(true);
    // duplicate skipped, new neighbor added with a boundary question
    const labels = merged.neighboring.map((n) => n.label);
    expect(labels.filter((l) => l === existingNeighbor)).toHaveLength(1);
    const added = merged.neighboring.find((n) => n.label === 'simulated annealing');
    expect(added?.boundaryQuestion).toContain('gradient descent');
  });

  it('is a no-op when nothing new arrives, and never mutates the input', () => {
    const before = JSON.stringify(profile);
    const merged = mergeStructuredRelations(profile, { comprising: [], neighboring: [] });
    expect(merged).toBe(profile);
    expect(JSON.stringify(profile)).toBe(before);
  });

  it('re-credits maturity when an empty map gains entries', () => {
    const empty = { ...profile, comprising: [], maturity: 0.5 };
    const merged = mergeStructuredRelations(empty, {
      comprising: [{ label: 'stochastic sampling', relation: 'part-of' }],
      neighboring: [],
    });
    expect(merged.maturity).toBeCloseTo(0.5 + 1 / 9);
  });
});
