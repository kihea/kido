// The learner model (docs/ENGINE.md §5): per-layer mastery from evidence only.
// An untested layer is UNKNOWN, not 0.5 — the UI must render it as such.
// Stored values never decay in place; staleness is computed at read time so
// the record stays an honest ledger of what was demonstrated when.

import type { EvidenceEvent, Layer, LayerMastery, MasteryVector, Outcome } from '../core/types';
import { LAYERS } from '../core/types';

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
