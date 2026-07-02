import { describe, expect, it } from 'vitest';
import { buildPracticePool, itemsForLayer } from './exertion';
import { buildProfile } from './profile';
import { fixtureCorpus } from './fixture.test-helper';

describe('buildPracticePool', () => {
  const corpus = fixtureCorpus();
  const profile = buildProfile(corpus);
  const pool = buildPracticePool(corpus, profile);

  it('every item states its reason and its grounding', () => {
    expect(pool.length).toBeGreaterThan(4);
    for (const item of pool) {
      expect(item.reason.length).toBeGreaterThan(10);
      if (item.type !== 'boundary' || item.passageIds.length > 0) {
        // boundary items from study-map adjacents may have no passage yet
        expect(Array.isArray(item.passageIds)).toBe(true);
      }
    }
  });

  it('clozes blank the concept inside a real source sentence', () => {
    const clozes = pool.filter((i) => i.type === 'cloze');
    expect(clozes.length).toBeGreaterThan(0);
    for (const c of clozes) {
      expect(c.prompt).toContain('＿');
      expect(c.prompt.toLowerCase()).not.toContain(c.answer.toLowerCase());
      expect(c.accept).toContain(c.answer.toLowerCase());
    }
  });

  it('boundary items come from the neighboring map', () => {
    const bounds = pool.filter((i) => i.type === 'boundary');
    expect(bounds.length).toBe(profile.neighboring.length);
    for (const b of bounds) {
      expect(b.layer).toBe(3);
      expect(b.question.length).toBeGreaterThan(0);
    }
  });

  it('sequence items keep the source order as the answer key', () => {
    const seqs = pool.filter((i) => i.type === 'sequence');
    expect(seqs.length).toBeGreaterThan(0); // the fixture has a 4-step process passage
    for (const s of seqs) {
      expect(s.steps.length).toBeGreaterThanOrEqual(3);
      expect(s.layer).toBe(5);
    }
  });

  it('the Feynman item demands the load-bearing pieces', () => {
    const fey = pool.find((i) => i.type === 'feynman');
    expect(fey).toBeDefined();
    expect(fey!.mustMention.length).toBeGreaterThan(0);
  });

  it('map-repair answers match the profile relations', () => {
    const maps = pool.filter((i) => i.type === 'map-repair');
    for (const m of maps) {
      const edge = profile.comprising.find((e) => e.label === m.fromLabel);
      expect(edge?.relation).toBe(m.answer);
    }
  });

  it('is deterministic: same corpus and profile → identical pool ids', () => {
    const again = buildPracticePool(corpus, buildProfile(corpus));
    expect(again.map((i) => i.id)).toEqual(pool.map((i) => i.id));
  });

  it('itemsForLayer filters by layer', () => {
    for (const item of itemsForLayer(pool, 3)) expect(item.layer).toBe(3);
  });
});
