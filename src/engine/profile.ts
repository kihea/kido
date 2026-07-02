// The averaging pass (docs/ENGINE.md §2, §4): compress the corpus into a
// DimensionalProfile — per-layer claims with verbatim support, comprising and
// neighboring maps, stated gaps, and a maturity score.
//
// AI-off honesty: with no model, averaging is EXTRACTIVE — claims are the
// best-supported verbatim excerpts per layer, never generated prose. A model
// may later add labeled `synthesis` claims alongside (never instead of) these.

import type {
  Claim,
  ComprisingEdge,
  ComprisingRelation,
  Concept,
  Corpus,
  DimensionalProfile,
  Layer,
  LayerEntry,
  NeighborEdge,
  Passage,
} from '../core/types';
import { hashId } from '../core/ids';
import { escapeRegExp, normalize, sentences } from '../core/text';
import { resolveTopicConcept } from './corpus';

const CLAIMS_PER_LAYER = 3;

const TENSION = /\bhowever\b|\bdisput\w+\b|\bcontested\b|\bdisagree\w*\b|\bcritici\w+\b|\bcontroversi\w+\b|\bdebate?d?\b/i;

interface Scored {
  passage: Passage;
  layer: Layer;
  score: number;
}

function scorePassagesByLayer(corpus: Corpus, topicConcept: Concept | undefined): Map<Layer, Scored[]> {
  const topicPassages = new Set(topicConcept?.passageIds ?? []);
  const byLayer = new Map<Layer, Scored[]>();
  for (const p of corpus.passages) {
    for (const tag of p.layers ?? []) {
      if (tag.confidence < 0.4) continue;
      const doc = corpus.docs.get(p.docId);
      const relevance = topicPassages.size === 0 ? 1 : topicPassages.has(p.id) ? 1 : 0.35;
      // Encyclopedias, textbooks and papers anchor claims; discussion and OCR'd
      // period newspapers add color and tension but shouldn't define a layer.
      const sourceQuality =
        doc?.sourceType === 'discussion' || doc?.sourceType === 'news' ? 0.6 : 1;
      const score = tag.confidence * relevance * sourceQuality;
      const list = byLayer.get(tag.layer) ?? [];
      list.push({ passage: p, layer: tag.layer, score });
      byLayer.set(tag.layer, list);
    }
  }
  for (const list of byLayer.values()) list.sort((a, b) => b.score - a.score);
  return byLayer;
}

/** Pick top claims per layer with source diversity (≤1 per doc when possible). */
function selectClaims(corpus: Corpus, scored: Scored[], layer: Layer): Claim[] {
  const claims: Claim[] = [];
  const usedDocs = new Set<string>();
  for (const pass of [true, false]) {
    for (const s of scored) {
      if (claims.length >= CLAIMS_PER_LAYER) break;
      if (claims.some((c) => c.passageIds.includes(s.passage.id))) continue;
      if (pass && usedDocs.has(s.passage.docId)) continue; // first pass: distinct docs
      usedDocs.add(s.passage.docId);
      claims.push({
        id: hashId('claim', `${layer}|${s.passage.id}`),
        layer,
        kind: 'excerpt',
        text: s.passage.text,
        passageIds: [s.passage.id],
      });
    }
    if (claims.length >= CLAIMS_PER_LAYER) break;
  }
  // Preserve disagreement: if any selected claim signals dispute, say so.
  for (const c of claims) {
    if (TENSION.test(c.text)) {
      c.tension = 'Sources differ here — read the excerpts against each other rather than picking one.';
    }
  }
  return claims;
}

const REL_PATTERNS: { re: RegExp; relation: ComprisingRelation }[] = [
  { re: /\b(?:requires?|depends? on|presupposes?|needs?|built on|based on)\b/i, relation: 'requires' },
  { re: /\b(?:consists? of|composed of|made (?:up )?of|part of|component|comprises?|contains?)\b/i, relation: 'part-of' },
  { re: /\b(?:works? by|achieved (?:by|through)|mechanism|drives?|causes?|produces?|enables?)\b/i, relation: 'mechanism-of' },
  { re: /\b(?:such as|for example|for instance|including|e\.g\.)\b/i, relation: 'example-of' },
];

function conceptDominantLayer(concept: Concept, corpus: Corpus): Layer {
  const votes = new Map<Layer, number>();
  const byId = new Map(corpus.passages.map((p) => [p.id, p]));
  for (const pid of concept.passageIds) {
    const p = byId.get(pid);
    for (const t of p?.layers ?? []) {
      votes.set(t.layer, (votes.get(t.layer) ?? 0) + t.confidence);
    }
  }
  let best: Layer = 6;
  let bestV = 0;
  for (const [l, v] of votes) {
    if (v > bestV) {
      best = l;
      bestV = v;
    }
  }
  return best;
}

/**
 * Comprising map: important concepts that co-occur with the topic in a
 * sentence carrying a composition/dependency pattern.
 */
function buildComprising(corpus: Corpus, topicLabel: string, topicConcept: Concept | undefined): ComprisingEdge[] {
  const topicRe = new RegExp(`\\b${escapeRegExp(topicLabel)}\\b`, 'i');
  const edges = new Map<string, ComprisingEdge>();
  const topicKey = normalize(topicLabel);
  for (const concept of corpus.concepts) {
    if (!concept.important || concept.id === topicKey || concept.id === topicConcept?.id) continue;
    const conceptRe = new RegExp(`\\b${escapeRegExp(concept.label)}\\b`, 'i');
    for (const p of corpus.passages) {
      if (!concept.passageIds.includes(p.id)) continue;
      for (const s of sentences(p.text)) {
        if (!conceptRe.test(s)) continue;
        const mentionsTopic = topicRe.test(s);
        for (const { re, relation } of REL_PATTERNS) {
          if (!re.test(s)) continue;
          // Require topic co-mention for a confident edge; allow doc-level
          // fallback only for strong 'requires' phrasing.
          if (!mentionsTopic && relation !== 'requires') continue;
          const existing = edges.get(concept.id);
          if (existing) {
            if (!existing.passageIds.includes(p.id)) existing.passageIds.push(p.id);
          } else {
            edges.set(concept.id, {
              concept: concept.id,
              label: concept.label,
              relation,
              layer: conceptDominantLayer(concept, corpus),
              passageIds: [p.id],
            });
          }
          break;
        }
      }
    }
  }
  return [...edges.values()].sort((a, b) => b.passageIds.length - a.passageIds.length).slice(0, 12);
}

const CONTRAST_CAPTURE = [
  /\bunlike\s+((?:the\s+)?[\w-]+(?:\s+[\w-]+){0,2})/i,
  /\bas opposed to\s+((?:the\s+)?[\w-]+(?:\s+[\w-]+){0,3})/i,
  /\bdiffers? from\s+((?:the\s+)?[\w-]+(?:\s+[\w-]+){0,3})/i,
  /\bdistinct from\s+((?:the\s+)?[\w-]+(?:\s+[\w-]+){0,3})/i,
  /\brather than\s+((?:the\s+)?[\w-]+(?:\s+[\w-]+){0,3})/i,
  /\bnot to be confused with\s+((?:the\s+)?[\w-]+(?:\s+[\w-]+){0,3})/i,
];

/**
 * Neighboring map: what the sources themselves contrast the topic with.
 * A definition is only complete with a boundary (D = center + boundary).
 */
function buildNeighboring(corpus: Corpus, topicLabel: string): NeighborEdge[] {
  const edges = new Map<string, NeighborEdge>();
  const conceptIds = new Set(corpus.concepts.map((c) => c.id));
  for (const p of corpus.passages) {
    const tagged = (p.layers ?? []).some((t) => t.layer === 3 && t.confidence >= 0.4);
    if (!tagged) continue;
    for (const s of sentences(p.text)) {
      for (const re of CONTRAST_CAPTURE) {
        const m = re.exec(s);
        if (!m?.[1]) continue;
        const raw = m[1].replace(/[,;:.].*$/, '').trim();
        const key = normalize(raw);
        if (!key || key === normalize(topicLabel) || key.length < 3) continue;
        const existing = edges.get(key);
        if (existing) {
          if (!existing.passageIds.includes(p.id)) existing.passageIds.push(p.id);
          continue;
        }
        edges.set(key, {
          concept: conceptIds.has(key) ? key : `ext:${key}`,
          label: raw,
          ...(s.length <= 240 ? { contrast: s } : {}),
          boundaryQuestion: `What separates ${topicLabel} from ${raw} — where exactly is the line?`,
          passageIds: [p.id],
        });
      }
    }
  }
  // Study-map adjacents are candidate neighbors even without a contrast sentence.
  for (const b of corpus.studyMap?.branches ?? []) {
    if (b.kind !== 'adjacent' && b.kind !== 'frontier') continue;
    const key = normalize(b.concept);
    if (edges.has(key)) continue;
    edges.set(key, {
      concept: conceptIds.has(key) ? key : `ext:${key}`,
      label: b.concept,
      boundaryQuestion: `Is ${b.concept} a case of ${topicLabel}, a rival to it, or something else entirely? Defend the line.`,
      passageIds: [],
    });
  }
  return [...edges.values()].slice(0, 8);
}

/**
 * Merge structured (Wikidata-style) relations into a text-derived profile.
 * Structured edges carry no passage support (passageIds: []) — the UI labels
 * them as ontology, not excerpts. Duplicates by normalized label are skipped;
 * maturity is re-credited if a previously-empty map gains entries. Pure.
 */
export function mergeStructuredRelations(
  profile: DimensionalProfile,
  relations: {
    comprising: { label: string; relation: ComprisingRelation }[];
    neighboring: { label: string }[];
  },
): DimensionalProfile {
  const haveC = new Set(profile.comprising.map((e) => normalize(e.label)));
  const haveN = new Set(profile.neighboring.map((n) => normalize(n.label)));
  const topicKey = normalize(profile.topic);

  const newComprising: ComprisingEdge[] = [];
  for (const c of relations.comprising) {
    const key = normalize(c.label);
    if (!key || key === topicKey || haveC.has(key)) continue;
    haveC.add(key);
    newComprising.push({
      concept: `wd:${key}`,
      label: c.label,
      relation: c.relation,
      layer: 7, // ontology edges are structural until text evidence refines them
      passageIds: [],
    });
  }

  const newNeighboring: NeighborEdge[] = [];
  for (const n of relations.neighboring) {
    const key = normalize(n.label);
    if (!key || key === topicKey || haveN.has(key)) continue;
    haveN.add(key);
    newNeighboring.push({
      concept: `wd:${key}`,
      label: n.label,
      boundaryQuestion: `${n.label} is often confused with ${profile.topic}. What decides which one you're looking at?`,
      passageIds: [],
    });
  }

  if (newComprising.length === 0 && newNeighboring.length === 0) return profile;
  const comprising = [...profile.comprising, ...newComprising].slice(0, 14);
  const neighboring = [...profile.neighboring, ...newNeighboring].slice(0, 10);
  // Re-credit the two structural maturity questions if they just became answerable.
  let maturity = profile.maturity;
  if (profile.comprising.length === 0 && comprising.length > 0) maturity += 1 / 9;
  if (profile.neighboring.length === 0 && neighboring.length > 0) maturity += 1 / 9;
  return { ...profile, comprising, neighboring, maturity: Math.min(1, maturity) };
}

export function buildProfile(corpus: Corpus): DimensionalProfile {
  const topicConcept = resolveTopicConcept(corpus);
  const topicLabel = topicConcept?.label ?? corpus.topic;
  const scored = scorePassagesByLayer(corpus, topicConcept);

  const layers = {} as Record<Layer, LayerEntry>;
  const gaps: Layer[] = [];
  for (const layer of [0, 1, 2, 3, 4, 5, 6, 7, 8] as Layer[]) {
    const list = scored.get(layer) ?? [];
    const claims = selectClaims(corpus, list, layer);
    // Coverage saturates with distinct supporting passages, not raw count.
    const distinct = new Set(list.map((s) => s.passage.id)).size;
    const coverage = Math.min(1, distinct / 4);
    layers[layer] = { layer, claims, coverage };
    if (claims.length === 0 && layer !== 0) gaps.push(layer);
  }

  const comprising = buildComprising(corpus, topicLabel, topicConcept);
  const neighboring = buildNeighboring(corpus, topicLabel);

  // Maturity (docs/ENGINE.md §4): the nine questions, answerable = evidenced.
  let answered = 0;
  const need: [boolean, number][] = [
    [layers[1].claims.length > 0, 1], // what is it
    [comprising.length > 0, 1], // what is it made from
    [layers[2].claims.length > 0, 1], // how does it vary
    [neighboring.length > 0, 1], // where does it stop being itself
    [layers[4].claims.length > 0, 1], // what instance shows it
    [layers[5].claims.length > 0, 1], // how does it change
    [layers[6].claims.length > 0, 1], // what concept averages it
    [layers[7].claims.length > 0, 1], // what contains it
    [layers[8].claims.length > 0, 1], // what governs it
  ];
  for (const [ok] of need) if (ok) answered += 1;
  const maturity = answered / need.length;

  const profile: DimensionalProfile = {
    topic: corpus.topic,
    layers,
    comprising,
    neighboring,
    gaps,
    maturity,
  };
  if (topicConcept) profile.conceptId = topicConcept.id;
  return profile;
}
