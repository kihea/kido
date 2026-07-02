import { describe, expect, it } from 'vitest';
import { nextSocraticTurn } from './socratic';
import { buildProfile } from './profile';
import { fixtureCorpus } from './fixture.test-helper';
import { initMastery } from './mastery';

const T0 = 1_750_000_000_000;

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
});
