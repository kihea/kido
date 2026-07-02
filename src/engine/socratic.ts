// Socratic dialogue (move library §10.3): one pointed question at a time,
// aimed at the weakest layer, grounded in the profile. Heuristic path uses
// the layer questions and the profile's own boundaries/principles as
// templates; a configured model may rephrase but never changes the target.

import type { DimensionalProfile, Layer, MasteryVector } from '../core/types';
import { LAYER_INFO } from './layers';
import { chooseTargetLayer } from './diagnose';
import type { DomainFamily } from '../core/types';

export interface SocraticTurn {
  layer: Layer;
  /** The question posed to the learner. */
  question: string;
  /** What a strong answer engages — shown after the learner responds. */
  lookFor: string;
}

/** The next Socratic question for the current state. Deterministic. */
export function nextSocraticTurn(
  profile: DimensionalProfile,
  mastery: MasteryVector,
  family: DomainFamily,
  now: number,
  asked: string[] = [],
): SocraticTurn | null {
  const target = chooseTargetLayer(profile, mastery, family, now);
  const candidates = turnsForLayer(profile, target).filter((t) => !asked.includes(t.question));
  if (candidates.length > 0) return candidates[0]!;
  // Target exhausted — walk the other teachable layers.
  for (const l of [3, 8, 5, 6, 2, 4, 7, 1] as Layer[]) {
    if (l === target) continue;
    const alt = turnsForLayer(profile, l).filter((t) => !asked.includes(t.question));
    if (alt.length > 0) return alt[0]!;
  }
  return null;
}

function turnsForLayer(profile: DimensionalProfile, layer: Layer): SocraticTurn[] {
  const topic = profile.topic;
  const out: SocraticTurn[] = [];
  switch (layer) {
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
        lookFor: `A strong answer names dependencies between steps, not just their sequence.`,
      });
      break;
    case 2: {
      const edge = profile.comprising.find((e) => e.layer === 2) ?? profile.comprising[0];
      if (edge) {
        out.push({
          layer: 2,
          question: `If you could only measure one thing about ${topic}, what would you measure, and what would ${edge.label} tell you?`,
          lookFor: `A strong answer picks a gradient that discriminates cases, not a static fact.`,
        });
      }
      break;
    }
    case 4:
      out.push({
        layer: 4,
        question: `Give me one concrete case of ${topic} — then point at exactly where in that case the idea is doing work.`,
        lookFor: `The idea should be locatable inside the instance, not floating above it.`,
      });
      break;
    case 7: {
      const parts = profile.comprising.slice(0, 3).map((e) => e.label);
      if (parts.length >= 2) {
        out.push({
          layer: 7,
          question: `${parts.join(' and ')} all sit inside ${topic}. Which one could you remove and still have ${topic}? Defend it.`,
          lookFor: `A strong answer distinguishes load-bearing parts from replaceable ones.`,
        });
      }
      break;
    }
    case 6:
    default:
      out.push({
        layer: 6,
        question: `Strip the jargon: what is ${topic}, in one sentence a sharp newcomer couldn't misunderstand?`,
        lookFor: `Center plus boundary — what it is AND what near-miss it is not.`,
      });
      break;
  }
  return out;
}
