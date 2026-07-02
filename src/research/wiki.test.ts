import { describe, expect, it } from 'vitest';
import { htmlToText, spreadPick, splitSections } from './wiki';

const EXTRACT = [
  'Gradient descent is a first-order iterative optimization algorithm.',
  '',
  '== Description ==',
  'The idea is to take repeated steps in the opposite direction of the gradient.',
  '',
  '== Applications ==',
  'It is used to train machine learning models at scale.',
  '',
  '== See also ==',
  'Related methods.',
  '',
  '== References ==',
  'Citations here.',
].join('\n');

describe('splitSections', () => {
  it('splits a MediaWiki extract into titled sections and skips reference junk', () => {
    const sections = splitSections(EXTRACT);
    const names = sections.map((s) => s.section);
    expect(names).toEqual(['Overview', 'Description', 'Applications']);
    expect(sections[0]!.text).toContain('first-order iterative');
  });
});

describe('htmlToText', () => {
  it('keeps paragraph boundaries and strips tags/entities (for Wikisource render)', () => {
    const html = '<p>First para with a <sup>1</sup>footnote.</p><p>Second &amp; final.</p>';
    const text = htmlToText(html);
    expect(text).toContain('First para');
    expect(text).toContain('Second & final');
    expect(text).not.toContain('<');
  });
});

describe('spreadPick', () => {
  it('samples across early, middle, and late sections instead of only the top', () => {
    const candidates = Array.from({ length: 9 }, (_, i) => ({ sectionOrdinal: i, tag: `s${i}` }));
    const picked = spreadPick(candidates, 9, 3);
    const ordinals = picked.map((p) => p.sectionOrdinal);
    expect(ordinals.some((o) => o < 3)).toBe(true); // early
    expect(ordinals.some((o) => o >= 3 && o < 6)).toBe(true); // middle
    expect(ordinals.some((o) => o >= 6)).toBe(true); // late
  });

  it('returns candidates sorted by document position', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => ({ sectionOrdinal: 5 - i }));
    const picked = spreadPick(candidates, 6, 4);
    const ordinals = picked.map((p) => p.sectionOrdinal);
    expect([...ordinals].sort((a, b) => a - b)).toEqual(ordinals);
  });
});
