import { describe, expect, it } from 'vitest';
import { heuristicStudyMap, looksHistorical, seedProviders } from './fanout';

describe('seedProviders', () => {
  it('always includes the keyless core, journals and papers', () => {
    const names = seedProviders().map((p) => p.name);
    expect(names).toContain('Wikipedia');
    expect(names).toContain('OpenAlex');
    expect(names).toContain('Crossref');
    expect(names).toContain('DOAJ');
  });

  it('adds Internet Archive full-text only for historical topics', () => {
    expect(seedProviders({ historical: true }).map((p) => p.name)).toContain('Internet Archive');
    expect(seedProviders({}).map((p) => p.name)).not.toContain('Internet Archive');
  });

  it('adds primary/newspaper providers only for historical topics', () => {
    expect(seedProviders({ historical: false }).map((p) => p.name)).not.toContain('Chronicling America');
    const hist = seedProviders({ historical: true }).map((p) => p.name);
    expect(hist).toContain('Chronicling America');
    expect(hist).toContain('Wikisource');
  });
});

describe('topic-shaped providers', () => {
  it('always includes Semantic Scholar alongside OpenAlex/Crossref', () => {
    expect(seedProviders().map((p) => p.name)).toContain('Semantic Scholar');
  });
  it('adds Stack Exchange for technical topics only', () => {
    expect(seedProviders({ technical: true }).map((p) => p.name)).toContain('Stack Exchange');
    expect(seedProviders({}).map((p) => p.name)).not.toContain('Stack Exchange');
  });
  it('adds Wikinews for current-events topics only', () => {
    expect(seedProviders({ current: true }).map((p) => p.name)).toContain('Wikinews');
    expect(seedProviders({}).map((p) => p.name)).not.toContain('Wikinews');
  });
});

describe('looksHistorical', () => {
  it('recognizes historical topics', () => {
    expect(looksHistorical('the French Revolution')).toBe(true);
    expect(looksHistorical('the printing press in the 1500s')).toBe(true);
    expect(looksHistorical('gradient descent')).toBe(false);
  });
});

describe('heuristicStudyMap', () => {
  it('widens with reach', () => {
    expect(heuristicStudyMap('x', 0.2).branches.length).toBeLessThan(heuristicStudyMap('x', 0.9).branches.length);
  });
  it('labels every branch with its kind and a why', () => {
    for (const b of heuristicStudyMap('inflation', 0.8).branches) {
      expect(b.kind.length).toBeGreaterThan(0);
      expect(b.why.length).toBeGreaterThan(0);
      expect(b.query.length).toBeGreaterThan(0);
    }
  });
});
