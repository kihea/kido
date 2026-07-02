// The tutor loop (docs/ENGINE.md §6, protocol): diagnose before teaching;
// one scaffold, one focused learner action, feedback, next-layer decision.
// Pure state machine — same inputs and seed replay the same session.

import type {
  ComprisingRelation,
  Corpus,
  DimensionalProfile,
  DomainFamily,
  EvidenceEvent,
  ExcerptCard,
  ExplanationCard,
  Layer,
  MasteryVector,
  Outcome,
  Passage,
  PracticeCard,
  PracticeItem,
  ReviewItem,
  SessionCard,
  SummaryCard,
} from '../core/types';
import { hashId } from '../core/ids';
import { contentWords, normalize, wordCount } from '../core/text';
import { buildGauge, chooseTargetLayer, moveForLayer } from './diagnose';
import { buildPracticePool, itemsForLayer } from './exertion';
import { applyEvidence, effectiveMastery, initMastery } from './mastery';
import { LAYER_INFO } from './layers';

export interface TutorState {
  corpus: Corpus;
  profile: DimensionalProfile;
  family: DomainFamily;
  mastery: MasteryVector;
  pool: PracticeItem[];
  cards: SessionCard[];
  usedItemIds: string[];
  usedPassageIds: string[];
  phase: 'gauge' | 'teach' | 'practice' | 'done';
  /** Item ids still queued in the opening gauge. */
  gaugeIds: string[];
  target: Layer;
  /** Consecutive cards spent on the current target layer. */
  stepsAtTarget: number;
  cardsRemaining: number;
  events: EvidenceEvent[];
}

export interface TutorOptions {
  family: DomainFamily;
  /** Teaching+practice card budget for the session (excludes gauge/summary). */
  maxCards?: number;
  mastery?: MasteryVector;
  /** Clock reading at session start (staleness in target choice). */
  now?: number;
}

const MAX_STEPS_AT_TARGET = 3;

export function startSession(
  corpus: Corpus,
  profile: DimensionalProfile,
  opts: TutorOptions,
): { state: TutorState; card: SessionCard } {
  const pool = buildPracticePool(corpus, profile);
  const gauge = buildGauge(pool, opts.family);
  const base: TutorState = {
    corpus,
    profile,
    family: opts.family,
    mastery: opts.mastery ?? initMastery(),
    pool,
    cards: [],
    usedItemIds: [],
    usedPassageIds: [],
    phase: gauge.length > 0 ? 'gauge' : 'teach',
    gaugeIds: gauge.map((g) => g.id),
    target: 6,
    stepsAtTarget: 0,
    cardsRemaining: opts.maxCards ?? 14,
    events: [],
  };
  return next(base, opts.now ?? 0);
}

// -- card planning -------------------------------------------------------------

/** Pick the best unshown passage for a layer: tag confidence × topical relevance. */
function pickPassage(state: TutorState, layer: Layer): Passage | undefined {
  const topicWords = new Set(contentWords(state.corpus.topic));
  let best: Passage | undefined;
  let bestScore = 0;
  for (const p of state.corpus.passages) {
    if (state.usedPassageIds.includes(p.id)) continue;
    const tag = (p.layers ?? []).find((t) => t.layer === layer);
    if (!tag || tag.confidence < 0.4) continue;
    const overlap = contentWords(p.text).filter((w) => topicWords.has(w)).length;
    const score = tag.confidence * (1 + Math.min(overlap, 5) * 0.2);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

function excerptCard(state: TutorState, passage: Passage, layer: Layer): ExcerptCard {
  const doc = state.corpus.docs.get(passage.docId)!;
  const shownPassages = state.usedPassageIds;
  const conns = state.corpus.connections.get(passage.id) ?? [];
  const threads: ExcerptCard['threads'] = [];
  const conceptById = new Map(state.corpus.concepts.map((c) => [c.id, c]));
  for (const conn of conns) {
    const other = conn.a === passage.id ? conn.b : conn.a;
    if (!shownPassages.includes(other)) continue;
    const priorCard = state.cards.find((c) => c.kind === 'excerpt' && c.passage.id === other);
    if (!priorCard) continue;
    threads.push({
      toCardId: priorCard.id,
      via: conn.via,
      viaLabels: conn.via.map((id) => conceptById.get(id)?.label ?? id),
    });
  }
  const seen = new Set(
    state.cards.flatMap((c) => (c.kind === 'excerpt' ? c.newConcepts : [])),
  );
  const newConcepts = state.corpus.concepts
    .filter((c) => c.important && c.passageIds.includes(passage.id) && !seen.has(c.id))
    .map((c) => c.id)
    .slice(0, 3);
  const info = LAYER_INFO[layer];
  return {
    kind: 'excerpt',
    id: hashId('card', `${passage.id}|${state.cards.length}`),
    passage,
    doc,
    newConcepts,
    threads,
    layer,
    reason: `You're working the ${info.name} layer — ${info.question.toLowerCase()} This excerpt carries it in the source's own words.`,
  };
}

/** Template explanation for a layer the corpus can't teach directly — labeled synthesis. */
function templateExplanation(state: TutorState, layer: Layer): ExplanationCard {
  const info = LAYER_INFO[layer];
  const neighbor = state.profile.neighboring[0];
  const comprising = state.profile.comprising.slice(0, 3).map((e) => e.label);
  const bits: string[] = [];
  bits.push(`The ${info.name} question for ${state.profile.topic}: ${info.question}`);
  if (layer === 3 && neighbor) {
    bits.push(`Your sources contrast it most directly with ${neighbor.label} — that boundary is where the definition earns its keep.`);
  } else if (comprising.length > 0) {
    bits.push(`From your sources, the load-bearing pieces are: ${comprising.join(', ')}. Hold the question against those.`);
  }
  bits.push(`The sources gathered for this session are thin here — treat this as a signpost, not an answer, and consider researching this layer directly.`);
  return {
    kind: 'explanation',
    id: hashId('expl', `${state.profile.topic}|${layer}|${state.cards.length}`),
    layer,
    text: bits.join(' '),
    by: 'template',
    passageIds: [],
    reason: `No source excerpt covers the ${info.name} layer — KIDO says so rather than papering over the gap.`,
  };
}

function practiceCard(state: TutorState, item: PracticeItem): PracticeCard {
  const gated =
    item.type === 'cloze' ||
    item.type === 'sequence' ||
    item.type === 'map-repair' ||
    item.type === 'grouping';
  return {
    kind: 'practice',
    id: hashId('pcard', `${item.id}|${state.cards.length}`),
    item,
    move: moveForLayer(item.layer),
    gate: gated,
    reason: item.reason,
  };
}

/**
 * Plan the next card. Returns the summary card when the session is spent.
 * Rhythm: scaffold (excerpt) → focused action (practice) → re-diagnose.
 */
export function next(state: TutorState, now: number): { state: TutorState; card: SessionCard } {
  if (state.phase === 'done' || state.cardsRemaining <= 0) {
    return finish(state, now);
  }

  // Opening gauge: quick probes, no explanations, no budget cost. The
  // learner's answers seed the mastery vector before any teaching happens.
  if (state.phase === 'gauge') {
    const itemId = state.gaugeIds[0];
    const item = state.pool.find((i) => i.id === itemId);
    if (item) {
      const card: PracticeCard = {
        kind: 'practice',
        id: hashId('gcard', `${item.id}|${state.cards.length}`),
        item,
        move: 'diagnostic',
        gate: true,
        reason: 'Opening gauge — this seeds where we start.',
      };
      const nextState: TutorState = {
        ...state,
        cards: [...state.cards, card],
        usedItemIds: [...state.usedItemIds, item.id],
        gaugeIds: state.gaugeIds.slice(1),
      };
      return { state: nextState, card };
    }
    // Gauge spent: pick the first target from the seeded evidence.
    const target = chooseTargetLayer(state.profile, state.mastery, state.family, now);
    return next({ ...state, phase: 'teach', target, stepsAtTarget: 0 }, now);
  }

  // Re-diagnose when we've given the current layer its arc.
  let target = state.target;
  let steps = state.stepsAtTarget;
  if (steps >= MAX_STEPS_AT_TARGET) {
    target = chooseTargetLayer(state.profile, state.mastery, state.family, now);
    steps = 0;
  }

  if (state.phase === 'teach') {
    const passage = pickPassage(state, target);
    const card: SessionCard = passage ? excerptCard(state, passage, target) : templateExplanation(state, target);
    const usedPassageIds = passage ? [...state.usedPassageIds, passage.id] : state.usedPassageIds;
    const nextState: TutorState = {
      ...state,
      cards: [...state.cards, card],
      usedPassageIds,
      phase: 'practice',
      target,
      stepsAtTarget: steps + 1,
      cardsRemaining: state.cardsRemaining - 1,
    };
    return { state: nextState, card };
  }

  // practice phase — draw with variety so interactive modes (grouping,
  // flashcard, map-repair) actually surface instead of being crowded out by
  // whatever text item happens to sit first in the pool for this layer.
  const available = itemsForLayer(state.pool, target).filter((i) => !state.usedItemIds.includes(i.id));
  const item = pickVaried(available, state.cards);
  if (!item) {
    // Nothing to exercise at this layer — teach a different one.
    const reTarget = chooseTargetLayer(
      state.profile,
      state.mastery,
      state.family,
      now,
    );
    const moved: TutorState = { ...state, phase: 'teach', target: reTarget, stepsAtTarget: 0 };
    return next(moved, now);
  }
  const card = practiceCard(state, item);
  const nextState: TutorState = {
    ...state,
    cards: [...state.cards, card],
    usedItemIds: [...state.usedItemIds, item.id],
    phase: 'teach',
    target,
    stepsAtTarget: steps + 1,
    cardsRemaining: state.cardsRemaining - 1,
  };
  return { state: nextState, card };
}

/**
 * Prefer an item whose interaction type hasn't appeared in the last few cards.
 * Keeps the session from becoming a wall of one interaction, and gives the
 * hands-on modes a real rotation. Falls back to first-available.
 */
function pickVaried(available: PracticeItem[], cards: SessionCard[]): PracticeItem | undefined {
  if (available.length <= 1) return available[0];
  const recentTypes = cards
    .slice(-4)
    .flatMap((c) => (c.kind === 'practice' ? [c.item.type] : []));
  const fresh = available.find((i) => !recentTypes.includes(i.type));
  return fresh ?? available[0];
}

function finish(state: TutorState, now: number): { state: TutorState; card: SummaryCard } {
  const nextLayer = chooseTargetLayer(state.profile, state.mastery, state.family, now);
  const eff = effectiveMastery(state.mastery[nextLayer], now);
  const info = LAYER_INFO[nextLayer];
  const card: SummaryCard = {
    kind: 'summary',
    id: hashId('sum', `${state.profile.topic}|${state.cards.length}`),
    mastery: state.mastery,
    next: {
      layer: nextLayer,
      why:
        eff === null
          ? `The ${info.name} layer is untested — ${info.question.toLowerCase()}`
          : `The ${info.name} layer is your weakest demonstrated layer right now.`,
    },
  };
  return {
    state: { ...state, phase: 'done', cards: [...state.cards, card] },
    card,
  };
}

// -- responses & grading ---------------------------------------------------------

export type PracticeResponse =
  | { type: 'cloze'; text: string }
  | { type: 'boundary'; text: string }
  | { type: 'sequence'; order: number[] } // learner's arrangement: original indices
  | { type: 'feynman'; text: string }
  | { type: 'map-repair'; choice: ComprisingRelation }
  | { type: 'transfer'; text: string; selfGrade?: 'pass' | 'partial' | 'miss' }
  | { type: 'grouping'; placedInA: string[] } // labels the learner put in group A
  | { type: 'flashcard'; recalled: 'pass' | 'partial' | 'miss' } // self-graded on flip
  | { type: 'skip' };

export interface Feedback {
  outcome: Outcome;
  note: string;
  /** Shown after grading: the answer, the key contrast, the correct order… */
  reveal?: string;
}

export function gradeResponse(item: PracticeItem, response: PracticeResponse): Feedback {
  if (response.type === 'skip') {
    return { outcome: 'skipped', note: 'Skipped — no penalty, no credit. It stays on the schedule.' };
  }
  switch (item.type) {
    case 'cloze': {
      if (response.type !== 'cloze') break;
      const given = normalize(response.text);
      const hit = item.accept.some((a) => normalize(a) === given);
      return hit
        ? { outcome: 'pass', note: 'Recalled, not recognized — that is the difference that lasts.' }
        : {
            outcome: 'miss',
            note: 'Not this time. Read the sentence again with the answer in place before moving on.',
            reveal: item.answer,
          };
    }
    case 'sequence': {
      if (response.type !== 'sequence') break;
      const order = response.order;
      const n = item.steps.length;
      if (order.length !== n) break;
      let adjacent = 0;
      for (let i = 0; i + 1 < order.length; i++) {
        if (order[i]! + 1 === order[i + 1]!) adjacent += 1;
      }
      const exact = order.every((v, i) => v === i);
      const outcome: Outcome = exact ? 'pass' : adjacent >= Math.ceil((n - 1) / 2) ? 'partial' : 'miss';
      return {
        outcome,
        note: exact
          ? 'The process is yours now, not just the label.'
          : 'Some links held, some slipped. Trace what each step needs from the one before it.',
        ...(exact ? {} : { reveal: item.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') }),
      };
    }
    case 'map-repair': {
      if (response.type !== 'map-repair') break;
      const hit = response.choice === item.answer;
      return hit
        ? { outcome: 'pass', note: `Right — ${item.fromLabel} ${relationGloss(item.answer)} ${item.toLabel}.` }
        : {
            outcome: 'miss',
            note: 'The relation type matters as much as the connection itself.',
            reveal: `${item.fromLabel} ${relationGloss(item.answer)} ${item.toLabel}`,
          };
    }
    case 'feynman': {
      if (response.type !== 'feynman') break;
      const text = normalize(response.text);
      const words = wordCount(response.text);
      const mentioned = item.mustMention.filter((m) => text.includes(normalize(m)));
      const hasNegation = /\b(not|isn t|is not|unlike|rather than|as opposed)\b/.test(text);
      if (words < 25) {
        return {
          outcome: 'partial',
          note: 'Too compressed to test itself. Where would a newcomer stop you and ask "wait, why"?',
        };
      }
      const share = item.mustMention.length === 0 ? 1 : mentioned.length / item.mustMention.length;
      if (share >= 0.6 && hasNegation) {
        return { outcome: 'pass', note: 'It touches the load-bearing pieces and draws a boundary. Solid reconstruction.' };
      }
      return {
        outcome: 'partial',
        note:
          share < 0.6
            ? `A newcomer would still be missing: ${item.mustMention.filter((m) => !mentioned.includes(m)).join(', ')}.`
            : 'Good center — but no boundary. What is this NOT? Add the near-miss.',
      };
    }
    case 'boundary': {
      if (response.type !== 'boundary') break;
      const text = normalize(response.text);
      const words = wordCount(response.text);
      const namesNeighbor = text.includes(normalize(item.neighborLabel));
      const contrastLanguage = /\b(not|unlike|whereas|but|however|differs|instead|only|requires|lacks)\b/.test(text);
      if (words >= 15 && namesNeighbor && contrastLanguage) {
        return {
          outcome: 'pass',
          note: 'You drew a line, not a vibe. Check it against the source contrast.',
          ...(item.keyContrast ? { reveal: item.keyContrast } : {}),
        };
      }
      return {
        outcome: words >= 15 ? 'partial' : 'miss',
        note: namesNeighbor
          ? 'Name the exact property that flips the classification — "different" is not a boundary.'
          : `Engage the neighbor directly: what does ${item.neighborLabel} have or lack that decides the call?`,
        ...(item.keyContrast ? { reveal: item.keyContrast } : {}),
      };
    }
    case 'transfer': {
      if (response.type !== 'transfer') break;
      const words = wordCount(response.text);
      if (response.selfGrade) {
        return {
          outcome: response.selfGrade,
          note: 'Self-graded. Be harsher than feels fair — transfer is where understanding actually gets tested.',
        };
      }
      return {
        outcome: words >= 25 ? 'partial' : 'miss',
        note:
          words >= 25
            ? 'Recorded. Compare your prediction against the sources — then grade yourself.'
            : 'Run the scenario further: name one thing that survives and one that breaks.',
      };
    }
    case 'grouping': {
      if (response.type !== 'grouping') break;
      const inA = new Set(response.placedInA.map((s) => s.toLowerCase()));
      const total = item.groupA.members.length + item.groupB.members.length;
      let correct = 0;
      for (const m of item.groupA.members) if (inA.has(m.toLowerCase())) correct += 1;
      for (const m of item.groupB.members) if (!inA.has(m.toLowerCase())) correct += 1;
      const outcome: Outcome = correct === total ? 'pass' : correct >= Math.ceil(total * 0.7) ? 'partial' : 'miss';
      return {
        outcome,
        note:
          outcome === 'pass'
            ? 'Every one placed right — the boundary is real to you, not just the definition.'
            : 'Some crossed the line the wrong way. The reveal shows which belong inside.',
        ...(outcome === 'pass'
          ? {}
          : {
              reveal: `Inside: ${item.groupA.members.join(', ')}\nNeighbors: ${item.groupB.members.join(', ')}`,
            }),
      };
    }
    case 'flashcard': {
      if (response.type !== 'flashcard') break;
      return {
        outcome: response.recalled,
        note:
          response.recalled === 'pass'
            ? 'Retrieved cleanly. It stays on the schedule so it stays retrievable.'
            : 'Noted — this one comes back sooner.',
      };
    }
  }
  return { outcome: 'skipped', note: 'Response type did not match the item — treated as a skip.' };
}

function relationGloss(r: ComprisingRelation): string {
  switch (r) {
    case 'requires':
      return 'is required by';
    case 'part-of':
      return 'is part of';
    case 'mechanism-of':
      return 'is a mechanism of';
    case 'example-of':
      return 'is an example within';
  }
}

/** Record a graded response into the learner model. */
export function applyResponse(
  state: TutorState,
  item: PracticeItem,
  response: PracticeResponse,
  now: number,
  hinted = false,
): { state: TutorState; feedback: Feedback; event: EvidenceEvent } {
  const feedback = gradeResponse(item, response);
  const event: EvidenceEvent = {
    at: now,
    layer: item.layer,
    kind: item.kind,
    outcome: feedback.outcome,
    itemId: item.id,
    ...(hinted ? { hinted: true } : {}),
  };
  const mastery = applyEvidence(state.mastery, event);
  return {
    state: { ...state, mastery, events: [...state.events, event] },
    feedback,
    event,
  };
}

/** Seed the spaced-review queue from what this session actually exercised. */
export function reviewSeeds(state: TutorState, topicId: string, now: number, make: (topicId: string, layer: Layer, itemId: string, now: number) => ReviewItem): ReviewItem[] {
  const seen = new Set<string>();
  const out: ReviewItem[] = [];
  for (const e of state.events) {
    if (!e.itemId || e.outcome === 'skipped' || seen.has(e.itemId)) continue;
    seen.add(e.itemId);
    out.push(make(topicId, e.layer, e.itemId, now));
  }
  return out;
}
