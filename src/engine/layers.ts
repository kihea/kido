// The L0–L8 stack (docs/ENGINE.md §1). Names, questions, and learner-facing
// glosses. The engine stores all nine layers; the UI may compress to the
// seven-position working stack (L0·L1 merged, L7·L8 merged).

import type { Layer, LayerInfo, MirrorPair } from '../core/types';

export const LAYER_INFO: Record<Layer, LayerInfo> = {
  0: {
    layer: 0,
    name: 'potential',
    question: 'What could be, prior to distinction?',
    gloss: 'the possibility space this topic was carved from',
  },
  1: {
    layer: 1,
    name: 'existence',
    question: 'What unit is being distinguished?',
    gloss: 'the basic units — what we are even talking about',
  },
  2: {
    layer: 2,
    name: 'extent',
    question: 'Along what gradients does it vary?',
    gloss: 'what varies, by how much, in which direction',
  },
  3: {
    layer: 3,
    name: 'boundary',
    question: 'What makes it this and not that?',
    gloss: 'where it stops being itself — against its neighbors',
  },
  4: {
    layer: 4,
    name: 'embodiment',
    question: 'What concrete instance shows it?',
    gloss: 'a real case you can inspect',
  },
  5: {
    layer: 5,
    name: 'time',
    question: 'How does it persist, change, emerge, or decay?',
    gloss: 'how it unfolds — process, history, iteration',
  },
  6: {
    layer: 6,
    name: 'concept',
    question: 'What abstraction averages its instances?',
    gloss: 'the stable idea across all the cases',
  },
  7: {
    layer: 7,
    name: 'structure',
    question: 'What system organizes it?',
    gloss: 'the larger whole it belongs to',
  },
  8: {
    layer: 8,
    name: 'principle',
    question: 'What invariant governs the structure?',
    gloss: 'the rule that makes the whole thing hold together',
  },
};

/**
 * The seven-position working stack for navigation and display:
 * L0·L1 and L7·L8 are analytically distinct but operationally inseparable.
 */
export const WORKING_STACK: readonly Layer[][] = [
  [0, 1],
  [2],
  [3],
  [4],
  [5],
  [6],
  [7, 8],
];

export function layerName(layer: Layer): string {
  return LAYER_INFO[layer].name;
}

/**
 * The stack is symmetric about embodiment (framework Ch 10): L0↔L8, L1↔L7,
 * L2↔L6, L3↔L5; L4 is the axis, paired with itself. Framing and display only —
 * mirror partnership never feeds mastery math (Ch 13: understanding is a vector).
 */
export const MIRROR_PAIRS: readonly MirrorPair[] = [
  {
    lower: 0,
    upper: 8,
    name: 'the two nothingnesses',
    gloss: 'open possibility below, pure constraint above — the blank before the mark and the blank after distillation',
  },
  {
    lower: 1,
    upper: 7,
    name: 'the two infinities',
    gloss: 'no limit to the units you can posit; no limit to the systems that can hold them',
  },
  {
    lower: 2,
    upper: 6,
    name: 'variation and its compression',
    gloss: 'extent opens the gradients instances differ along; concept closes them into one idea',
  },
  {
    lower: 3,
    upper: 5,
    name: 'the two limits',
    gloss: 'boundary is where it stops being itself in form; time is where it stops being itself in change',
  },
  { lower: 4, upper: 4, name: 'the axis', gloss: 'embodiment is the mirror itself — the one layer paired with itself' },
];

/** Mirror presentation of the full nine-layer stack, folded about L4. */
export const MIRROR_STACK: readonly Layer[][] = MIRROR_PAIRS.map((p) =>
  p.lower === p.upper ? [p.lower] : [p.lower, p.upper],
);

/** The mirror partner of a layer (involution l ↦ 8 − l; unique fixed point is L4). */
export function mirrorLayer(layer: Layer): Layer {
  return (8 - layer) as Layer;
}

/** The mirror pair a layer belongs to (both members return the same object). */
export function mirrorPairOf(layer: Layer): MirrorPair {
  return MIRROR_PAIRS[Math.min(layer, 8 - layer)]!;
}

/** Layers worth teaching directly (L0 is background; surfaced only on request). */
export const TEACHABLE_LAYERS: readonly Layer[] = [1, 2, 3, 4, 5, 6, 7, 8];
