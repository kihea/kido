// The learner model (docs/ENGINE.md §5): per-layer mastery from evidence only.
// An untested layer is UNKNOWN, not 0.5 — the UI must render it as such.
// Stored values never decay in place; staleness is computed at read time so
// the record stays an honest ledger of what was demonstrated when.

import type {
  CollapseSignal,
  Direction,
  DirectionVector,
  EvidenceEvent,
  EvidenceKind,
  Layer,
  LayerMastery,
  MasteryVector,
  Outcome,
} from '../core/types';
import { LAYERS } from '../core/types';
import { LAYER_INFO } from './layers';

export function initMastery(): MasteryVector {
  const v = {} as MasteryVector;
  for (const l of LAYERS) v[l] = { value: 0, evidence: 0 };
  return v;
}

function outcomeValue(outcome: Outcome, hinted: boolean | undefined): number | null {
  switch (outcome) {
    case 'pass':
      return hinted ? 0.75 : 1;
    case 'partial':
      return 0.55;
    case 'miss':
      return 0.1;
    case 'skipped':
      return null; // no evidence either way
  }
}

/**
 * EWMA toward the evidence, learning rate shrinking with evidence count —
 * early evidence moves the estimate a lot, later evidence refines it.
 */
export function applyEvidence(mastery: MasteryVector, event: EvidenceEvent): MasteryVector {
  const value = outcomeValue(event.outcome, event.hinted);
  if (value === null) return mastery;
  const m = mastery[event.layer];
  const alpha = Math.max(0.25, 1 / (m.evidence + 1));
  const next: LayerMastery = {
    value: m.evidence === 0 ? value : m.value + alpha * (value - m.value),
    evidence: m.evidence + 1,
    lastAt: event.at,
  };
  return { ...mastery, [event.layer]: next };
}

const HALF_LIFE_DAYS = 21;

/**
 * Effective mastery for decision-making: demonstrated value discounted by
 * staleness. Returns null when the layer has no evidence (unknown ≠ weak-known).
 */
export function effectiveMastery(m: LayerMastery, now: number): number | null {
  if (m.evidence === 0) return null;
  if (m.lastAt === undefined) return m.value;
  const days = Math.max(0, (now - m.lastAt) / 86_400_000);
  const retention = Math.pow(0.5, days / HALF_LIFE_DAYS);
  return m.value * (0.35 + 0.65 * retention); // stale ≠ forgotten outright
}

/** Layers ordered by how badly they need attention (weakest/stalest first). */
export function weakestLayers(mastery: MasteryVector, now: number): Layer[] {
  return [...LAYERS].sort((a, b) => rank(mastery[a], now) - rank(mastery[b], now));
}

function rank(m: LayerMastery, now: number): number {
  const eff = effectiveMastery(m, now);
  return eff === null ? -1 : eff; // unknown sorts before weak-known
}

/** A compact confidence in the estimate, for display: 0 (none) → 1 (well-tested). */
export function masteryConfidence(m: LayerMastery): number {
  return 1 - 1 / (1 + m.evidence * 0.6);
}

// -- directional competence (framework Ch 13–14) --------------------------------
//
// The direction tag records the NAVIGATION a piece of practice demands, not the
// operator run in the act: retrieval and Feynman are exertions as acts, but the
// travel they demand (embodied material → the concept/handle) is upward, and
// Ch 14 assigns teaching to the averaging side. Application-shaped work
// (deciding cases, running the process, predicting under change) is downward.

export const KIND_DIRECTION: Record<EvidenceKind, Direction> = {
  identify: 'up',
  gradient: 'down',
  boundary: 'down',
  instantiate: 'down',
  sequence: 'down',
  retrieval: 'up',
  feynman: 'up',
  'map-repair': 'up',
  transfer: 'down',
  potential: 'down', // L0: naming a live alternative is exertion into the possibility field
};

export function initDirection(): DirectionVector {
  return { up: { value: 0, evidence: 0 }, down: { value: 0, evidence: 0 } };
}

/** Same EWMA as applyEvidence, keyed by the event's direction instead of its layer. */
export function applyDirectionalEvidence(direction: DirectionVector, event: EvidenceEvent): DirectionVector {
  const value = outcomeValue(event.outcome, event.hinted);
  if (value === null) return direction;
  const d = KIND_DIRECTION[event.kind];
  const m = direction[d];
  const alpha = Math.max(0.25, 1 / (m.evidence + 1));
  const next: LayerMastery = {
    value: m.evidence === 0 ? value : m.value + alpha * (value - m.value),
    evidence: m.evidence + 1,
    lastAt: event.at,
  };
  return { ...direction, [d]: next };
}

// -- collapse detection (framework Ch 8, 14) ------------------------------------

export const COLLAPSE_UPPER_LAYERS: readonly Layer[] = [6, 7, 8];
export const COLLAPSE_ANCHOR_LAYER: Layer = 4;
export const COLLAPSE_STRONG_EFF = 0.7;
export const COLLAPSE_STRONG_EVIDENCE = 2;
export const COLLAPSE_ANCHOR_WEAK = 0.45;

/**
 * Flags fluent upper-layer mastery sitting on a weak or untested embodiment
 * anchor — the collapse signature (recites perfectly, fails only under
 * exertion). Pure; evidence-gated so an all-untested profile never fires.
 */
export function detectCollapse(mastery: MasteryVector, now: number): CollapseSignal | null {
  const strong = COLLAPSE_UPPER_LAYERS.filter((l) => {
    const eff = effectiveMastery(mastery[l], now);
    return mastery[l].evidence >= COLLAPSE_STRONG_EVIDENCE && eff !== null && eff >= COLLAPSE_STRONG_EFF;
  });
  if (strong.length === 0) return null;

  const effAnchor = effectiveMastery(mastery[COLLAPSE_ANCHOR_LAYER], now);
  if (effAnchor !== null && effAnchor > COLLAPSE_ANCHOR_WEAK) return null; // the anchor holds

  const anchorState: 'untested' | 'failing' = effAnchor === null ? 'untested' : 'failing';
  const upperStrength =
    strong.reduce((s: number, l) => s + (effectiveMastery(mastery[l], now) ?? 0), 0) / strong.length;
  const anchorGap = anchorState === 'failing' ? 1 - effAnchor! : 0.6; // untested = suspicion, capped
  const breadth = 0.6 + 0.2 * (strong.length - 1); // progressive: concept→structure→principle
  const severity = Math.min(1, Math.round(upperStrength * anchorGap * breadth * 100) / 100);
  const names = strong.map((l) => LAYER_INFO[l].name).join(', ');
  const reason =
    `${names} ${strong.length > 1 ? 'test' : 'tests'} strong while ${LAYER_INFO[COLLAPSE_ANCHOR_LAYER].name} is ` +
    `${anchorState === 'untested' ? 'untested' : 'weak under exertion'} — fluent upper layers over a missing anchor ` +
    `is the collapse signature: a recital can be perfect and about nothing. One concrete instance settles it either way.`;
  return { upperLayers: strong, anchorLayer: COLLAPSE_ANCHOR_LAYER, anchorState, severity, reason };
}
