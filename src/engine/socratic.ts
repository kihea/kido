// Socratic dialogue (move library §10.3): one pointed question at a time,
// aimed at the weakest layer, grounded in the profile. Heuristic path uses
// the layer questions and the profile's own boundaries/principles as
// templates; a configured model may rephrase but never changes the target.

import type { DimensionalProfile, DirectionVector, Layer, MasteryVector } from '../core/types';
import { LAYER_INFO } from './layers';
import { chooseTargetLayer } from './diagnose';
import { effectiveMastery } from './mastery';
import { truncate } from '../core/text';
import type { DomainFamily } from '../core/types';

export interface SocraticTurn {
  layer: Layer;
  /** The question posed to the learner. */
  question: string;
  /** What a strong answer engages — shown after the learner responds. */
  lookFor: string;
}

/**
 * The L0 gate (framework Ch 18: "ordinary teaching rarely needs L0"). The
 * possibility question presupposes knowing what the thing is (L6) and where it
 * stops (L3), so it only opens for a learner who has demonstrated both, on a
 * profile that actually holds alternatives. With initMastery() it stays shut.
 */
export function l0Unlocked(profile: DimensionalProfile, mastery: MasteryVector, now: number): boolean {
  const material = profile.layers[0].claims.length > 0 || profile.neighboring.length >= 2;
  if (!material) return false;
  const evidencedCount = ([1, 2, 3, 4, 5, 6, 7, 8] as Layer[]).filter(
    (l) => effectiveMastery(mastery[l], now) !== null,
  ).length;
  const e3 = effectiveMastery(mastery[3], now);
  const e6 = effectiveMastery(mastery[6], now);
  const anchored = e3 !== null && e3 >= 0.6 && e6 !== null && e6 >= 0.6;
  return evidencedCount >= 4 && anchored;
}

/** The next Socratic question for the current state. Deterministic. */
export function nextSocraticTurn(
  profile: DimensionalProfile,
  mastery: MasteryVector,
  family: DomainFamily,
  now: number,
  asked: string[] = [],
  direction?: DirectionVector,
): SocraticTurn | null {
  const target = chooseTargetLayer(profile, mastery, family, now, direction);
  const candidates = turnsForLayer(profile, target).filter((t) => !asked.includes(t.question));
  if (candidates.length > 0) return candidates[0]!;
  // Target exhausted — walk the other teachable layers. L0 comes last and only
  // once the gate opens, so novices never meet the possibility question.
  const unlocked = l0Unlocked(profile, mastery, now);
  const walk = [3, 8, 5, 6, 2, 4, 7, 1, ...(unlocked ? [0] : [])] as Layer[];
  for (const l of walk) {
    if (l === target) continue;
    const alt = turnsForLayer(profile, l).filter((t) => !asked.includes(t.question));
    if (alt.length > 0) return alt[0]!;
  }
  return null;
}

/** A generic, layer-addressed question for a layer the profile can't ground. */
function genericTurn(topic: string, layer: Layer): SocraticTurn {
  return {
    layer,
    question: `For ${topic}: ${LAYER_INFO[layer].question}`,
    lookFor: `A strong answer works at the ${LAYER_INFO[layer].name} layer — ${LAYER_INFO[layer].gloss}.`,
  };
}

/**
 * The complete Ch-13 survey as an engine artifact: one question per layer,
 * each addressed to its own layer, L0 last ("the question almost never asked").
 * Grounded where the profile has material, generic template where it doesn't.
 */
export function nineQuestionSurvey(profile: DimensionalProfile): SocraticTurn[] {
  return ([1, 2, 3, 4, 5, 6, 7, 8, 0] as Layer[]).map(
    (l) => turnsForLayer(profile, l)[0] ?? genericTurn(profile.topic, l),
  );
}

function turnsForLayer(profile: DimensionalProfile, layer: Layer): SocraticTurn[] {
  const topic = profile.topic;
  const out: SocraticTurn[] = [];
  // Ground the check in the learner's own sources whenever a claim exists.
  const cite = (l: Layer, rubric: string): string => {
    const c = profile.layers[l].claims[0];
    return c ? `${rubric} Compare against the source: “${truncate(c.text, 200)}”` : rubric;
  };
  switch (layer) {
    case 0: {
      // First non-empty grounding wins, deterministically.
      if (profile.neighboring.length >= 2) {
        const alts = profile.neighboring.slice(0, 2).map((n) => n.label);
        out.push({
          layer: 0,
          question: `${topic} wasn't the only thing that could have stood here. What else could have been the case — and what did selecting ${topic} over it foreclose?`,
          lookFor: `Your profile holds ${alts[0]} and ${alts[1]} beside it. A strong answer names a live alternative and the cost of the selection — not just “it could have been different.”`,
        });
      } else if (profile.layers[0].claims[0]) {
        out.push({
          layer: 0,
          question: `Where is ${topic} still open — what about it could yet be otherwise, according to your own sources?`,
          lookFor: `Compare against the source: “${profile.layers[0].claims[0]!.text.slice(0, 200)}”`,
        });
      }
      break;
    }
    case 1: {
      out.push({
        layer: 1,
        question: `What is the unit here — when you point at one ${topic}, what exactly counts as one?`,
        lookFor: profile.layers[1].claims[0]
          ? `Compare against the source: “${profile.layers[1].claims[0]!.text.slice(0, 200)}”`
          : `A strong answer posits a countable unit — one what? — not a theme.`,
      });
      break;
    }
    case 3: {
      for (const n of profile.neighboring.slice(0, 3)) {
        out.push({
          layer: 3,
          question: n.boundaryQuestion,
          lookFor: n.contrast
            ? `The sources put it this way: “${n.contrast}”`
            : `A strong answer names the property that decides the call, not just “they're different.”`,
        });
      }
      break;
    }
    case 8: {
      const claim = profile.layers[8].claims[0];
      if (claim) {
        out.push({
          layer: 8,
          question: `What single rule, if it stopped holding, would make ${topic} fall apart — and why that one?`,
          lookFor: `Compare against the source: “${claim.text.slice(0, 200)}”`,
        });
      }
      break;
    }
    case 5:
      out.push({
        layer: 5,
        question: `Walk me through ${topic} as a process — what has to happen first, and what breaks if the order flips?`,
        lookFor: cite(5, `A strong answer names dependencies between steps, not just their sequence.`),
      });
      break;
    case 2: {
      const edge = profile.comprising.find((e) => e.layer === 2) ?? profile.comprising[0];
      if (edge) {
        out.push({
          layer: 2,
          question: `If you could only measure one thing about ${topic}, what would you measure, and what would ${edge.label} tell you?`,
          lookFor: cite(2, `A strong answer picks a gradient that discriminates cases, not a static fact.`),
        });
      }
      break;
    }
    case 4:
      out.push({
        layer: 4,
        question: `Give me one concrete case of ${topic} — then point at exactly where in that case the idea is doing work.`,
        lookFor: cite(4, `The idea should be locatable inside the instance, not floating above it.`),
      });
      break;
    case 7: {
      const parts = profile.comprising.slice(0, 3).map((e) => e.label);
      if (parts.length >= 2) {
        out.push({
          layer: 7,
          question: `${parts.join(' and ')} all sit inside ${topic}. Which one could you remove and still have ${topic}? Defend it.`,
          lookFor: cite(7, `A strong answer distinguishes load-bearing parts from replaceable ones.`),
        });
      }
      break;
    }
    case 6:
    default:
      out.push({
        layer: 6,
        question: `Strip the jargon: what is ${topic}, in one sentence a sharp newcomer couldn't misunderstand?`,
        lookFor: cite(6, `Center plus boundary — what it is AND what near-miss it is not.`),
      });
      break;
  }
  return out;
}
