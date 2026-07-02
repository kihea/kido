// Diagnosis and move selection (docs/ENGINE.md §6): the weakest HIGH-VALUE
// layer, where "high-value" comes from the domain pedagogy matrix — domains
// weight layers differently and prescribe different entry sequences.

import type {
  DiagnosticCard,
  DimensionalProfile,
  DomainFamily,
  Layer,
  MasteryVector,
  MoveKind,
} from '../core/types';
import { hashId } from '../core/ids';
import { effectiveMastery } from './mastery';
import { LAYER_INFO } from './layers';

/** Layer value weights per domain family (pedagogy matrix §1). */
export const DOMAIN_WEIGHTS: Record<DomainFamily, Partial<Record<Layer, number>>> = {
  math: { 2: 1, 3: 1, 8: 1, 4: 0.8, 6: 0.7 },
  ml: { 2: 1, 5: 1, 7: 1, 1: 0.8, 8: 0.7 },
  programming: { 4: 1, 5: 1, 7: 1, 3: 0.7, 2: 0.6 },
  systems: { 5: 1, 7: 1, 8: 1, 2: 0.8, 1: 0.6 },
  design: { 3: 1, 4: 1, 6: 1, 2: 0.8, 8: 0.6 },
  history: { 5: 1, 6: 1, 7: 1, 4: 0.9, 8: 0.6 },
  language: { 2: 1, 4: 1, 5: 1, 3: 0.8, 6: 0.6 },
  general: { 1: 0.8, 2: 0.8, 3: 0.9, 4: 0.9, 5: 0.8, 6: 0.9, 7: 0.8, 8: 0.7 },
};

/** Entry sequences per family (which layer to open with, when nothing is known). */
export const ENTRY_SEQUENCE: Record<DomainFamily, Layer[]> = {
  math: [4, 2, 3, 6, 8],
  ml: [1, 2, 5, 7, 8],
  programming: [4, 5, 2, 3, 7],
  systems: [1, 2, 5, 7, 8],
  design: [4, 3, 2, 6, 8],
  history: [4, 5, 7, 6, 8],
  language: [4, 5, 2, 3, 6],
  general: [1, 4, 3, 5, 6, 7],
};

const FAMILY_CUES: [DomainFamily, RegExp][] = [
  ['math', /\b(theorem|calculus|algebra|geometry|derivative|integral|proof|equation|topolog|probabilit|matrix|number theory)\b/i],
  ['ml', /\b(machine learning|neural|gradient|training|model|dataset|classifier|deep learning|transformer|llm|reinforcement)\b/i],
  ['programming', /\b(programming|algorithm|code|software|compiler|database|recursion|api|framework|runtime|concurrency)\b/i],
  ['systems', /\b(econom|inflation|market|policy|incentive|ecosystem|supply|demand|governance|network effect|feedback loop)\b/i],
  ['design', /\b(design|typograph|architecture style|minimalis|composition|aesthetic|ux|ui|art movement)\b/i],
  ['history', /\b(history|war|revolution|empire|century|ancient|medieval|dynasty|movement|reformation|colonial)\b/i],
  ['language', /\b(language|grammar|tense|vocabulary|pronunciation|dialect|linguistic|syntax|phonolog)\b/i],
];

export function inferDomainFamily(topic: string, sampleText = ''): DomainFamily {
  const hay = `${topic}\n${sampleText.slice(0, 4000)}`;
  let best: DomainFamily = 'general';
  let bestHits = 0;
  for (const [family, re] of FAMILY_CUES) {
    const hits = hay.match(new RegExp(re.source, re.flags + 'g'))?.length ?? 0;
    if (hits > bestHits) {
      best = family;
      bestHits = hits;
    }
  }
  // The topic string itself is decisive; body text needs stronger signal.
  return bestHits >= (new RegExp(FAMILY_CUES.find(([f]) => f === best)?.[1].source ?? '', 'i').test(topic) ? 1 : 3)
    ? best
    : 'general';
}

/**
 * The teaching target: weakest high-value layer that the profile can actually
 * teach (has claims). Unknown layers rank as weak-but-promising; the entry
 * sequence breaks ties early in a session.
 */
export function chooseTargetLayer(
  profile: DimensionalProfile,
  mastery: MasteryVector,
  family: DomainFamily,
  now: number,
): Layer {
  const weights = DOMAIN_WEIGHTS[family];
  const entry = ENTRY_SEQUENCE[family];
  const teachable = ([1, 2, 3, 4, 5, 6, 7, 8] as Layer[]).filter(
    (l) => profile.layers[l].claims.length > 0 || (l === 3 && profile.neighboring.length > 0),
  );
  if (teachable.length === 0) return 6;

  let best: Layer = teachable[0]!;
  let bestScore = -Infinity;
  for (const l of teachable) {
    // Domain weight, but with a floor for boundary (L3) and concept (L6):
    // discrimination and retrieval are universal techniques (pedagogy matrix
    // §10), so they earn attention in every domain, not only where weighted.
    const value = Math.max(weights[l] ?? 0.4, l === 3 || l === 6 ? 0.62 : 0);
    const eff = effectiveMastery(mastery[l], now);
    const gap = eff === null ? 0.85 : 1 - eff; // unknown ≈ probably weak, worth probing
    const entryIdx = entry.indexOf(l);
    const entryBias = entryIdx >= 0 ? (entry.length - entryIdx) * 0.02 : 0;
    const score = value * gap + entryBias;
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

/** Move for a weak layer (docs/ENGINE.md §6 table). */
export function moveForLayer(layer: Layer): MoveKind {
  switch (layer) {
    case 0:
    case 1:
      return 'direct-explanation';
    case 2:
      return 'gradient-prompt';
    case 3:
      return 'boundary-test';
    case 4:
      return 'worked-example';
    case 5:
      return 'sequence-reconstruction';
    case 6:
      return 'feynman';
    case 7:
      return 'map-repair';
    case 8:
      return 'principle-transfer';
  }
}

/**
 * The one calibrating question (protocol §10.1). Options are phrased as
 * confusions, not theory — each maps to the layer the tutor would enter.
 */
export function buildDiagnostic(profile: DimensionalProfile, family: DomainFamily): DiagnosticCard {
  const topic = profile.topic;
  const all: { label: string; layer: Layer }[] = [
    { label: `What ${topic} even is, at base`, layer: 1 },
    { label: `What actually varies in it — the quantities, the knobs`, layer: 2 },
    { label: `How it differs from things that look like it`, layer: 3 },
    { label: `Seeing it work in one concrete case`, layer: 4 },
    { label: `How it unfolds or came to be, step by step`, layer: 5 },
    { label: `Saying the core idea in my own words`, layer: 6 },
    { label: `How it fits into the bigger picture around it`, layer: 7 },
  ];
  const entry = ENTRY_SEQUENCE[family];
  const available = all.filter(
    (o) => profile.layers[o.layer].claims.length > 0 || (o.layer === 3 && profile.neighboring.length > 0),
  );
  const ordered = available.sort((a, b) => idx(entry, a.layer) - idx(entry, b.layer)).slice(0, 4);
  return {
    kind: 'diagnostic',
    id: hashId('diag', topic),
    question: `Before we start: when you think about ${topic}, where does it get fuzzy first?`,
    options: ordered.length >= 2 ? ordered : all.slice(0, 4),
    reason: `One calibrating question locates your entry layer — teaching before diagnosing wastes both our time (${LAYER_INFO[6].name} isn't always the problem).`,
  };
}

function idx(seq: Layer[], l: Layer): number {
  const i = seq.indexOf(l);
  return i === -1 ? 99 : i;
}

/**
 * The opening gauge (replaces self-report): a short battery of quick,
 * objectively gradable probes across the family's high-value layers. The
 * learner doesn't know what they don't know — outcomes seed the mastery
 * vector, and teaching starts from evidence instead of a guess.
 */
export function buildGauge(
  pool: import('../core/types').PracticeItem[],
  family: DomainFamily,
  max = 4,
): import('../core/types').PracticeItem[] {
  const weights = DOMAIN_WEIGHTS[family];
  // Quick to answer and objectively gradable; no essays in a gauge.
  const quickness: Record<string, number> = { cloze: 3, 'map-repair': 2.5, sequence: 1.5, boundary: 1 };
  const scored = pool
    .map((item) => ({ item, score: (weights[item.layer] ?? 0.4) * (quickness[item.type] ?? 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const byLayer = new Map<Layer, import('../core/types').PracticeItem>();
  for (const { item } of scored) {
    if (!byLayer.has(item.layer)) byLayer.set(item.layer, item);
    if (byLayer.size >= max) break;
  }
  return [...byLayer.values()];
}
