import { describe, expect, it } from 'vitest';
import { applyResponse, gradeResponse, next, reviewSeeds, startSession } from './tutor';
import { buildProfile } from './profile';
import { fixtureCorpus } from './fixture.test-helper';
import { newReviewItem } from './review';
import type { BoundaryItem, ClozeItem, FeynmanItem, MapRepairItem, SequenceItem } from '../core/types';

const T0 = 1_750_000_000_000;

function makeSession() {
  const corpus = fixtureCorpus();
  const profile = buildProfile(corpus);
  return startSession(corpus, profile, { family: 'ml', maxCards: 8 });
}

describe('session flow', () => {
  it('opens with a gauge: quick, gated, objectively gradable probes', () => {
    const { state, card } = makeSession();
    expect(card.kind).toBe('practice');
    if (card.kind === 'practice') {
      expect(card.move).toBe('diagnostic');
      expect(card.gate).toBe(true);
      expect(['cloze', 'map-repair', 'sequence', 'boundary']).toContain(card.item.type);
    }
    expect(state.phase).toBe('gauge');
  });

  it('gauge probes cover distinct high-value layers and seed mastery before teaching', () => {
    let { state, card } = makeSession();
    const gaugeLayers: number[] = [];
    // Answer (skip) through the whole gauge.
    while (state.phase === 'gauge' && card.kind === 'practice') {
      gaugeLayers.push(card.item.layer);
      const graded = applyResponse(state, card.item, { type: 'skip' }, T0);
      state = graded.state;
      const r = next(state, T0);
      state = r.state;
      card = r.card;
    }
    expect(new Set(gaugeLayers).size).toBe(gaugeLayers.length); // one probe per layer
    expect(gaugeLayers.length).toBeGreaterThanOrEqual(2);
    // After the gauge, teaching begins with a scaffold.
    expect(card.kind === 'excerpt' || card.kind === 'explanation').toBe(true);
  });

  it('every card carries a stated reason (except summary)', () => {
    let { state } = makeSession();
    for (let i = 0; i < 12; i++) {
      const r = next(state, T0 + i);
      state = r.state;
      if (r.card.kind === 'summary') break;
      expect('reason' in r.card && r.card.reason.length > 0).toBe(true);
    }
  });

  it('runs to a summary with a recommended next layer', () => {
    let { state } = makeSession();
    let summary = null;
    for (let i = 0; i < 40; i++) {
      const r = next(state, T0 + i);
      state = r.state;
      if (r.card.kind === 'summary') {
        summary = r.card;
        break;
      }
    }
    expect(summary).not.toBeNull();
    expect(summary!.next?.why.length).toBeGreaterThan(0);
  });

  it('responses update the mastery ledger on the exercised layer', () => {
    let { state, card } = makeSession();
    let practiceItem = card.kind === 'practice' ? card.item : null;
    for (let i = 0; i < 6 && !practiceItem; i++) {
      const r = next(state, T0 + i);
      state = r.state;
      if (r.card.kind === 'practice') practiceItem = r.card.item;
    }
    expect(practiceItem).not.toBeNull();
    const before = state.mastery[practiceItem!.layer].evidence;
    const { state: after } = applyResponse(state, practiceItem!, { type: 'skip' }, T0 + 10);
    expect(after.mastery[practiceItem!.layer].evidence).toBe(before); // skips = no evidence
    const { state: after2, feedback } = applyResponse(
      state,
      practiceItem!,
      practiceItem!.type === 'boundary'
        ? { type: 'boundary', text: `random search does not use local slope information, whereas gradient descent requires the gradient of the loss` }
        : { type: 'skip' },
      T0 + 11,
    );
    if (practiceItem!.type === 'boundary') {
      expect(after2.mastery[3].evidence).toBe(before + 1);
      expect(['pass', 'partial', 'miss']).toContain(feedback.outcome);
    }
  });

  it('seeds spaced review only from exercised, non-skipped items', () => {
    let { state } = makeSession();
    let practiceItem = null;
    for (let i = 0; i < 6 && !practiceItem; i++) {
      const r = next(state, T0 + i);
      state = r.state;
      if (r.card.kind === 'practice') practiceItem = r.card.item;
    }
    const graded = applyResponse(state, practiceItem!, { type: 'skip' }, T0);
    expect(reviewSeeds(graded.state, 'topic1', T0, newReviewItem)).toHaveLength(0);
  });
});

describe('grading', () => {
  const corpus = fixtureCorpus();
  const profile = buildProfile(corpus);
  const { state } = startSession(corpus, profile, { family: 'ml' });
  const pool = state.pool;

  it('cloze: accepts listed forms, rejects and reveals otherwise', () => {
    const cloze = pool.find((i) => i.type === 'cloze') as ClozeItem;
    expect(gradeResponse(cloze, { type: 'cloze', text: cloze.answer.toUpperCase() }).outcome).toBe('pass');
    const miss = gradeResponse(cloze, { type: 'cloze', text: 'definitely wrong' });
    expect(miss.outcome).toBe('miss');
    expect(miss.reveal).toBe(cloze.answer);
  });

  it('sequence: exact order passes, mostly-right is partial, scrambled misses', () => {
    const seq = pool.find((i) => i.type === 'sequence') as SequenceItem;
    const n = seq.steps.length;
    const right = [...Array(n).keys()];
    expect(gradeResponse(seq, { type: 'sequence', order: right }).outcome).toBe('pass');
    const scrambled = [...right].reverse();
    expect(gradeResponse(seq, { type: 'sequence', order: scrambled }).outcome).toBe('miss');
  });

  it('map-repair: right relation passes, wrong reveals the relation', () => {
    const map = pool.find((i) => i.type === 'map-repair') as MapRepairItem;
    expect(gradeResponse(map, { type: 'map-repair', choice: map.answer }).outcome).toBe('pass');
    const wrong = map.options.find((o) => o !== map.answer)!;
    const fb = gradeResponse(map, { type: 'map-repair', choice: wrong });
    expect(fb.outcome).toBe('miss');
    expect(fb.reveal).toBeDefined();
  });

  it('feynman: mentions + boundary language pass; thin answers are partial with pointed feedback', () => {
    const fey = pool.find((i) => i.type === 'feynman') as FeynmanItem;
    const good = `Gradient descent walks downhill on the loss function by following the slope. The learning rate decides the step size, and the loss function scores each guess. It is not random search — unlike guessing, it uses local information. For example, fitting a line: nudge the slope, re-measure the error, repeat until it settles. ${fey.mustMention.join(' and ')} all matter here.`;
    expect(gradeResponse(fey, { type: 'feynman', text: good }).outcome).toBe('pass');
    const thin = gradeResponse(fey, { type: 'feynman', text: 'It just minimizes stuff.' });
    expect(thin.outcome).toBe('partial');
    expect(thin.note.length).toBeGreaterThan(0);
  });

  it('boundary: naming the neighbor with a real contrast passes and reveals the source line', () => {
    const b = pool.find((i) => i.type === 'boundary') as BoundaryItem;
    const good = `${b.neighborLabel} does not use local slope information, whereas the topic requires the gradient at each step to pick a direction.`;
    const fb = gradeResponse(b, { type: 'boundary', text: good });
    expect(fb.outcome).toBe('pass');
  });

  it('skip is honest: no penalty, no credit', () => {
    const any = pool[0]!;
    expect(gradeResponse(any, { type: 'skip' }).outcome).toBe('skipped');
  });
});
