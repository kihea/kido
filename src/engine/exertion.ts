// Exertion (docs/ENGINE.md §2): expand representations into practice —
// retrieval, boundary tests, sequences, Feynman reconstruction, map repair,
// transfer. Every item is grounded in verbatim passages and states its reason.
// Deterministic: same corpus + profile → same pool.

import type {
  BoundaryItem,
  ClozeItem,
  Concept,
  Corpus,
  DimensionalProfile,
  FeynmanItem,
  FlashcardItem,
  GroupingItem,
  Layer,
  MapRepairItem,
  PotentialItem,
  PracticeItem,
  SequenceItem,
  TransferItem,
} from '../core/types';
import { hashId } from '../core/ids';
import { escapeRegExp, sentences, wordCount } from '../core/text';

const BLANK = '＿＿＿＿';

function clozeFor(corpus: Corpus, concept: Concept, layer: Layer, kind: 'retrieval' | 'gradient'): ClozeItem | null {
  const byId = new Map(corpus.passages.map((p) => [p.id, p]));
  const re = new RegExp(`\\b${escapeRegExp(concept.label)}\\b`, 'i');
  const pool = concept.definedByPassage
    ? [concept.definedByPassage, ...concept.passageIds]
    : concept.passageIds;
  // Two passes: prefer a sentence that stands on its own (names its subject);
  // fall back to one opening with a bare back-reference ("This process…", "Its…")
  // only when nothing clearer carries the term — those read as riddles to a
  // learner who can't see the paragraph the pronoun points back to.
  for (const preferClear of [true, false]) {
    for (const pid of pool) {
      const p = byId.get(pid);
      if (!p) continue;
      for (const s of sentences(p.text)) {
        if (!re.test(s)) continue;
        const wc = wordCount(s);
        if (wc < 8 || wc > 60) continue; // too thin to cue, or a wall
        if (preferClear && opensWithBackReference(s)) continue;
        const blanked = s.replace(re, BLANK);
        if (blanked === s) continue;
        const doc = corpus.docs.get(p.docId);
        return {
        type: 'cloze',
        id: hashId('cloze', `${concept.id}|${pid}|${kind}`),
        layer,
        kind,
        prompt: blanked,
        answer: concept.label,
        accept: acceptForms(concept.label),
        conceptId: concept.id,
        sourceTitle: doc?.title ?? 'source',
        passageIds: [pid],
          reason:
            kind === 'gradient'
              ? `“${concept.label}” names something that varies in ${corpus.topic} — recalling it inside its own sentence exercises the extent layer.`
              : `“${concept.label}” recurs across your sources — recall beats rereading, so reconstruct it where the source used it.`,
        };
      }
    }
  }
  return null;
}

/** A sentence whose subject is a bare back-reference the learner can't resolve. */
function opensWithBackReference(s: string): boolean {
  return /^\s*(?:it|its|this|that|these|those|such|they|their|here)\b/i.test(s);
}

function acceptForms(label: string): string[] {
  const l = label.toLowerCase().trim();
  const forms = new Set([l]);
  if (l.endsWith('s')) forms.add(l.slice(0, -1));
  else forms.add(`${l}s`);
  if (l.endsWith('y')) forms.add(`${l.slice(0, -1)}ies`);
  return [...forms];
}

function boundaryItems(profile: DimensionalProfile): BoundaryItem[] {
  return profile.neighboring.map((n) => {
    const item: BoundaryItem = {
      type: 'boundary',
      id: hashId('bound', `${profile.topic}|${n.concept}`),
      layer: 3,
      kind: 'boundary',
      topicLabel: profile.topic,
      neighborLabel: n.label,
      question: n.boundaryQuestion,
      passageIds: n.passageIds,
      reason: `A definition is a center plus a boundary — knowing ${profile.topic} means being able to say why ${n.label} is (or isn't) it.`,
    };
    if (n.contrast) item.keyContrast = n.contrast;
    return item;
  });
}

function sequenceItems(corpus: Corpus, profile: DimensionalProfile): SequenceItem[] {
  const out: SequenceItem[] = [];
  // Scan L5-tagged passages directly: a claim can be temporally rich without
  // enough sentences to reorder, and vice versa.
  const candidates = corpus.passages
    .flatMap((p) => {
      const tag = (p.layers ?? []).find((t) => t.layer === 5 && t.confidence >= 0.4);
      return tag ? [{ p, conf: tag.confidence }] : [];
    })
    .sort((a, b) => b.conf - a.conf);
  for (const { p } of candidates) {
    if (out.length >= 2) break;
    const steps = sentences(p.text)
      .filter((s) => wordCount(s) >= 5)
      .slice(0, 5);
    if (steps.length < 3) continue;
    out.push({
      type: 'sequence',
      id: hashId('seq', p.id),
      layer: 5,
      kind: 'sequence',
      instruction: `These lines describe how ${profile.topic} unfolds, in the source's own words. Restore their order.`,
      steps,
      passageIds: [p.id],
      reason: `Time is the layer summaries usually flatten — if you can't reconstruct the order, you have the label but not the process.`,
    });
  }
  return out;
}

function feynmanItem(profile: DimensionalProfile): FeynmanItem {
  const mustMention = profile.comprising.slice(0, 4).map((e) => e.label);
  return {
    type: 'feynman',
    id: hashId('feyn', profile.topic),
    layer: 6,
    kind: 'feynman',
    prompt: `Explain ${profile.topic} in plain language to someone sharp but new to it. No jargon you can't unpack. Include one example and one thing it is NOT.`,
    mustMention,
    passageIds: profile.layers[6].claims.flatMap((c) => c.passageIds),
    reason: `Fluent vocabulary can hide gaps — a plain-language reconstruction with an example and a non-example is the honest test of the concept layer.`,
  };
}

function mapRepairItems(profile: DimensionalProfile): MapRepairItem[] {
  return profile.comprising.slice(0, 6).map((e) => ({
    type: 'map-repair',
    id: hashId('map', `${profile.topic}|${e.concept}`),
    layer: 7,
    kind: 'map-repair',
    fromLabel: e.label,
    toLabel: profile.topic,
    options: ['requires', 'part-of', 'mechanism-of', 'example-of'],
    answer: e.relation,
    passageIds: e.passageIds,
    reason: `Experts don't hold concepts as a list — they know HOW ${e.label} relates to ${profile.topic}. Naming the relation type is the structure layer at work.`,
  }));
}

function transferItems(corpus: Corpus, profile: DimensionalProfile): TransferItem[] {
  const out: TransferItem[] = [];
  const principle = profile.layers[8].claims[0];
  const extentEdge = profile.comprising.find((e) => e.layer === 2);
  const extentConcept =
    extentEdge ??
    profile.comprising[0] ??
    null;
  if (extentConcept) {
    out.push({
      type: 'transfer',
      id: hashId('xfer', `${profile.topic}|knob|${extentConcept.concept}`),
      layer: 8,
      kind: 'transfer',
      scenario: `Suppose ${extentConcept.label} changed drastically — much more of it, or almost none.`,
      question: `What happens to ${profile.topic}? Which parts survive the change, and what does that tell you about what really governs it?`,
      passageIds: extentConcept.passageIds,
      reason: `A principle you can't run under changed conditions is a slogan. Perturbing one real component tests the governing layer.`,
    });
  }
  if (principle) {
    out.push({
      type: 'transfer',
      id: hashId('xfer', `${profile.topic}|principle`),
      layer: 8,
      kind: 'transfer',
      scenario: `One of your sources says: “${truncate(principle.text, 220)}”`,
      question: `Apply that to a case the source never mentions. Where else should it hold — and where would it break?`,
      passageIds: principle.passageIds,
      reason: `Far transfer is the strongest evidence of principle-level understanding — the source gives the invariant, you supply the new terrain.`,
    });
  }
  // Instantiation (L4): find the topic inside a concrete case.
  const embodiment = profile.layers[4].claims[0];
  if (embodiment) {
    out.push({
      type: 'transfer',
      id: hashId('inst', `${profile.topic}|embody`),
      layer: 4,
      kind: 'instantiate',
      scenario: `A concrete case from your sources: “${truncate(embodiment.text, 260)}”`,
      question: `Where exactly does ${profile.topic} show up in this case, and what role is it playing?`,
      passageIds: embodiment.passageIds,
      reason: `Abstractions float free unless you can point at them inside an instance — this pins the embodiment layer down.`,
    });
  }
  return out;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/**
 * Grouping puzzle (L3 boundary): sort concepts into "part of the topic" vs.
 * "a neighbor of it". Needs enough of both to be a real discrimination, not a
 * giveaway.
 */
function groupingItem(profile: DimensionalProfile): GroupingItem | null {
  const inside = profile.comprising.slice(0, 4).map((e) => e.label);
  const outside = profile.neighboring.slice(0, 4).map((n) => n.label);
  if (inside.length < 2 || outside.length < 2) return null;
  return {
    type: 'grouping',
    id: hashId('group', profile.topic),
    layer: 3,
    kind: 'boundary',
    instruction: `Sort these into what belongs INSIDE ${profile.topic} and what only sits NEAR it.`,
    groupA: { label: `Part of ${profile.topic}`, members: inside },
    groupB: { label: `Neighbor, not part`, members: outside },
    passageIds: [
      ...profile.comprising.slice(0, 4).flatMap((e) => e.passageIds),
      ...profile.neighboring.slice(0, 4).flatMap((n) => n.passageIds),
    ],
    reason: `Boundaries are learned by sorting, not by reading a definition — placing each concept forces the inside/outside call ${profile.topic} depends on.`,
  };
}

/** Flashcards (retrieval): defined concepts, cue on the front, source answer on flip. */
function flashcardItems(corpus: Corpus): FlashcardItem[] {
  const out: FlashcardItem[] = [];
  const byId = new Map(corpus.passages.map((p) => [p.id, p]));
  for (const c of corpus.concepts.filter((c) => c.important && c.definedByPassage).slice(0, 6)) {
    const p = byId.get(c.definedByPassage!);
    if (!p) continue;
    const doc = corpus.docs.get(p.docId);
    const sentence = sentences(p.text).find((s) => new RegExp(`\\b${escapeRegExp(c.label)}\\b`, 'i').test(s)) ?? p.text;
    out.push({
      type: 'flashcard',
      id: hashId('flash', c.id),
      layer: 6,
      kind: 'retrieval',
      front: `What is ${c.label}?`,
      back: sentence,
      sourceTitle: doc?.title ?? 'source',
      sourceUrl: p.anchorUrl ?? doc?.url ?? '',
      passageIds: [p.id],
      reason: `Spaced flashcards keep a concept retrievable — the answer is the source's own sentence, not a paraphrase.`,
    });
  }
  return out;
}

/**
 * Potential (L0): the question almost never asked — what else could have
 * stood here? Grounded strictly in what the profile knows (its neighbors and
 * any possibility-marked excerpt); returns null rather than invent alternatives.
 */
function potentialItem(profile: DimensionalProfile): PotentialItem | null {
  const alts = profile.neighboring.slice(0, 3).map((n) => n.label);
  const l0 = profile.layers[0].claims[0];
  if (alts.length < 2 && !l0) return null;
  return {
    type: 'potential',
    id: hashId('pot', profile.topic),
    layer: 0,
    kind: 'potential',
    prompt: `What else could have been the case, from which ${profile.topic} was selected? Name one live alternative — and what choosing ${profile.topic} over it gave up.`,
    alternatives: alts,
    ...(l0 ? { frontierExcerpt: truncate(l0.text, 260) } : {}),
    passageIds: [...(l0?.passageIds ?? []), ...profile.neighboring.slice(0, 3).flatMap((n) => n.passageIds)],
    reason: `The question almost never asked: the possibility space ${profile.topic} was carved from. Naming the else guards against mistaking the current configuration for the only one.`,
  };
}

/**
 * The full practice pool for a session. The tutor draws from this by target
 * layer; the review scheduler replays items from it across days.
 */
export function buildPracticePool(corpus: Corpus, profile: DimensionalProfile): PracticeItem[] {
  const items: PracticeItem[] = [];

  // Retrieval clozes (L6-adjacent) from defined, important concepts.
  const defined = corpus.concepts.filter((c) => c.important && c.definedByPassage);
  const clozeSource = defined.length > 0 ? defined : corpus.concepts.filter((c) => c.important);
  for (const c of clozeSource.slice(0, 8)) {
    const item = clozeFor(corpus, c, 6, 'retrieval');
    if (item) items.push(item);
  }

  // Gradient clozes (L2): concepts whose passages carry extent tags.
  const l2Passages = new Set(
    corpus.passages.filter((p) => (p.layers ?? []).some((t) => t.layer === 2 && t.confidence >= 0.4)).map((p) => p.id),
  );
  for (const c of corpus.concepts.filter((c) => c.important)) {
    if (!c.passageIds.some((id) => l2Passages.has(id))) continue;
    const item = clozeFor(corpus, c, 2, 'gradient');
    if (item && !items.some((i) => i.id === item.id)) {
      items.push(item);
      if (items.filter((i) => i.layer === 2).length >= 4) break;
    }
  }

  // Grouping leads the boundary items so the hands-on discrimination puzzle is
  // drawn before the free-text one at L3; flashcards lead retrieval at L6.
  const grouping = groupingItem(profile);
  if (grouping) items.push(grouping);
  items.push(...boundaryItems(profile));
  items.push(...flashcardItems(corpus));
  items.push(...sequenceItems(corpus, profile));
  items.push(feynmanItem(profile));
  items.push(...mapRepairItems(profile));
  items.push(...transferItems(corpus, profile));
  const pot = potentialItem(profile);
  if (pot) items.push(pot);
  return items;
}

/** Items that exercise a given layer (for the tutor's targeted draw). */
export function itemsForLayer(pool: PracticeItem[], layer: Layer): PracticeItem[] {
  return pool.filter((i) => i.layer === layer);
}
