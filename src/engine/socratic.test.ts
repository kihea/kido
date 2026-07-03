import { describe, expect, it } from 'vitest';
import { l0Unlocked, nextSocraticTurn, nineQuestionSurvey } from './socratic';
import { buildProfile } from './profile';
import { fixtureCorpus } from './fixture.test-helper';
import { applyEvidence, initMastery } from './mastery';
import type { EvidenceEvent, Layer } from '../core/types';

const T0 = 1_750_000_000_000;

function seedLayers(layers: Layer[]): ReturnType<typeof initMastery> {
  let m = initMastery();
  for (const l of layers) {
    const e: EvidenceEvent = { at: T0, layer: l, kind: 'retrieval', outcome: 'pass' };
    m = applyEvidence(m, e);
  }
  return m;
}

describe('nextSocraticTurn', () => {
  const profile = buildProfile(fixtureCorpus());

  it('asks one question aimed at a teachable layer, with a lookFor', () => {
    const turn = nextSocraticTurn(profile, initMastery(), 'ml', T0);
    expect(turn).not.toBeNull();
    expect(turn!.question.length).toBeGreaterThan(10);
    expect(turn!.lookFor.length).toBeGreaterThan(10);
  });

  it('never repeats an asked question and eventually runs dry', () => {
    const asked: string[] = [];
    for (let i = 0; i < 30; i++) {
      const turn = nextSocraticTurn(profile, initMastery(), 'ml', T0, asked);
      if (!turn) break;
      expect(asked).not.toContain(turn.question);
      asked.push(turn.question);
    }
    expect(asked.length).toBeGreaterThan(2); // multiple distinct questions
    expect(nextSocraticTurn(profile, initMastery(), 'ml', T0, asked)).toBeNull();
  });

  it('boundary questions come from the profile neighbors', () => {
    const asked: string[] = [];
    let sawNeighbor = false;
    for (let i = 0; i < 30; i++) {
      const turn = nextSocraticTurn(profile, initMastery(), 'ml', T0, asked);
      if (!turn) break;
      asked.push(turn.question);
      if (profile.neighboring.some((n) => n.boundaryQuestion === turn.question)) sawNeighbor = true;
    }
    expect(sawNeighbor).toBe(true);
  });

  it('is deterministic', () => {
    const a = nextSocraticTurn(profile, initMastery(), 'ml', T0);
    const b = nextSocraticTurn(profile, initMastery(), 'ml', T0);
    expect(a).toEqual(b);
  });

  it('never surfaces the L0 possibility question for a fresh learner', () => {
    const asked: string[] = [];
    for (let i = 0; i < 30; i++) {
      const turn = nextSocraticTurn(profile, initMastery(), 'ml', T0, asked);
      if (!turn) break;
      expect(turn.layer).not.toBe(0);
      expect(turn.question).not.toMatch(/could have been/i);
      asked.push(turn.question);
    }
  });

  it('unlocks L0 only after demonstrated L3+L6 competence, and only last', () => {
    const strong = seedLayers([3, 6, 2, 5]); // 4 evidenced, L3 & L6 at 1.0
    expect(l0Unlocked(profile, strong, T0)).toBe(true);
    expect(l0Unlocked(profile, initMastery(), T0)).toBe(false);
    expect(l0Unlocked(profile, seedLayers([3, 6]), T0)).toBe(false); // only 2 evidenced

    const asked: string[] = [];
    let l0Index = -1;
    let lastNonL0 = -1;
    let i = 0;
    for (; i < 40; i++) {
      const turn = nextSocraticTurn(profile, strong, 'ml', T0, asked);
      if (!turn) break;
      if (turn.layer === 0) l0Index = i;
      else lastNonL0 = i;
      asked.push(turn.question);
    }
    expect(l0Index).toBeGreaterThan(-1); // it did appear
    expect(l0Index).toBeGreaterThan(lastNonL0); // strictly after all other questions
  });
});

describe('nineQuestionSurvey', () => {
  const profile = buildProfile(fixtureCorpus());

  it('is complete, layer-addressed, and ordered with L0 last', () => {
    const survey = nineQuestionSurvey(profile);
    expect(survey).toHaveLength(9);
    expect(new Set(survey.map((t) => t.layer)).size).toBe(9);
    expect(survey[0]!.layer).toBe(1);
    expect(survey[8]!.layer).toBe(0);
    for (const t of survey) {
      expect(t.question.length).toBeGreaterThan(0);
      expect(t.lookFor.length).toBeGreaterThan(0);
    }
  });

  it('addresses the L1 question to the unit, not the concept default', () => {
    expect(nineQuestionSurvey(profile)[0]!.question).toMatch(/unit|counts as one/i);
  });

  it('is deterministic', () => {
    expect(nineQuestionSurvey(profile)).toEqual(nineQuestionSurvey(profile));
  });
});
