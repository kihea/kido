// Corpus analysis: which terms recur ACROSS independent sources (a term one
// source uses is its vocabulary; a term many sources share is the topic's
// actual structure), and which passages connect through them.
//
// G1 spec: input = docs + verbatim passages; output = Concept[] and
// Connection map. Deterministic, no model, no network. The importance filter
// exists so practice never anchors on generic recurring words.

import type { Concept, Connection, Corpus, Passage, SourceDoc } from '../core/types';
import { contentWords, escapeRegExp, normalize, sentences } from '../core/text';

/** Words that recur everywhere but anchor nothing. */
const GENERIC = new Set(
  (
    'thing things way ways time times year years part parts number numbers example examples use used using term terms ' +
    'case cases form forms type types kind kinds new first second large small high low great different important known ' +
    'call called major main common general system systems area areas group groups work works world state states'
  ).split(/\s+/),
);

interface TermStat {
  key: string;
  surfaces: Map<string, number>;
  passageIds: Set<string>;
  docIds: Set<string>;
}

function addTerm(stats: Map<string, TermStat>, key: string, surface: string, passage: Passage): void {
  let s = stats.get(key);
  if (!s) {
    s = { key, surfaces: new Map(), passageIds: new Set(), docIds: new Set() };
    stats.set(key, s);
  }
  s.surfaces.set(surface, (s.surfaces.get(surface) ?? 0) + 1);
  s.passageIds.add(passage.id);
  s.docIds.add(passage.docId);
}

/** Surface n-grams (1..3) with their normalized keys, per passage. */
function passageTerms(text: string): Map<string, string> {
  const words = contentWords(text);
  const raw = normalize(text).split(/\s+/).filter(Boolean);
  const out = new Map<string, string>(); // key -> a surface form
  for (const w of words) {
    if (w.length < 3 || GENERIC.has(w)) continue;
    if (!out.has(w)) out.set(w, w);
  }
  // n-grams over the raw normalized token stream (keeps phrase order intact)
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i + n <= raw.length; i++) {
      const gram = raw.slice(i, i + n);
      if (gram.some((w) => w.length < 3 || GENERIC.has(w))) continue;
      const content = gram.filter((w) => contentWords(w).length > 0);
      if (content.length < n) continue; // any stopword breaks the phrase
      const key = gram.join(' ');
      if (!out.has(key)) out.set(key, key);
    }
  }
  return out;
}

const DEFINITIONAL = (label: string) =>
  new RegExp(`(?:^|[.!?]\\s+)(?:an?\\s+|the\\s+)?${escapeRegExp(label)}s?\\s+(?:is|are|was|were|refers? to|means|describes?|denotes?)\\b`, 'i');

/** Find a passage whose text defines the term, if any. */
function findDefiner(label: string, passages: Passage[], ids: Set<string>): string | undefined {
  const re = DEFINITIONAL(label);
  for (const p of passages) {
    if (!ids.has(p.id)) continue;
    for (const s of sentences(p.text)) {
      if (re.test(` . ${s}`)) return p.id;
    }
  }
  return undefined;
}

export interface CorpusOptions {
  /** Keep at most this many concepts (by weight). */
  maxConcepts?: number;
  /** Connections kept per passage. */
  maxConnectionsPerPassage?: number;
}

export function analyzeCorpus(
  topic: string,
  docs: SourceDoc[],
  passages: Passage[],
  opts: CorpusOptions = {},
): Corpus {
  const maxConcepts = opts.maxConcepts ?? 120;
  const maxConn = opts.maxConnectionsPerPassage ?? 6;

  const stats = new Map<string, TermStat>();
  const perPassage = new Map<string, Set<string>>(); // passage id -> term keys
  for (const p of passages) {
    const terms = passageTerms(p.text);
    perPassage.set(p.id, new Set(terms.keys()));
    for (const [key, surface] of terms) addTerm(stats, key, surface, p);
  }

  const totalDocs = Math.max(1, docs.length);
  const candidates: Concept[] = [];
  for (const s of stats.values()) {
    const df = s.passageIds.size;
    const docDf = s.docIds.size;
    if (df < 2) continue; // must recur at all
    const isPhrase = s.key.includes(' ');
    // Structure = cross-source recurrence. Single-doc terms only survive as phrases.
    if (docDf < 2 && !isPhrase) continue;
    // idf-style weight: recurrence across docs beats raw frequency; phrases get a nudge.
    const weight =
      (docDf / totalDocs) * Math.log(1 + df) * (isPhrase ? 1.6 : 1) * (1 + Math.min(s.key.length, 24) / 48);
    const surface = [...s.surfaces.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    candidates.push({
      id: s.key,
      label: surface,
      df,
      weight,
      passageIds: [...s.passageIds],
      important: false,
    });
  }

  candidates.sort((a, b) => b.weight - a.weight);
  // Drop unigrams wholly contained in a stronger phrase (the phrase is the concept).
  const kept: Concept[] = [];
  for (const c of candidates) {
    if (!c.id.includes(' ')) {
      const swallowed = kept.some(
        (k) => k.id.includes(' ') && k.id.split(' ').includes(c.id) && k.weight >= c.weight * 0.8,
      );
      if (swallowed) continue;
    }
    kept.push(c);
    if (kept.length >= maxConcepts) break;
  }

  // Importance: enough cross-source recurrence to anchor practice.
  const weights = kept.map((c) => c.weight);
  const cutoff = weights.length > 0 ? weights[Math.floor(weights.length * 0.5)]! : 0;
  const topicKey = normalize(topic);
  for (const c of kept) {
    const docSpread = stats.get(c.id)!.docIds.size;
    c.important = (docSpread >= 2 && c.weight >= cutoff) || c.id === topicKey;
    const definer = findDefiner(c.label, passages, new Set(c.passageIds));
    if (definer) c.definedByPassage = definer;
  }

  // Connections: passages sharing important concepts. Accumulate via inverted
  // index; generic high-df terms are excluded so they cannot carry connections.
  const important = kept.filter((c) => c.important && c.df <= Math.max(6, passages.length * 0.4));
  const pairScore = new Map<string, { a: string; b: string; via: Set<string>; strength: number }>();
  for (const c of important) {
    const ids = c.passageIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        let e = pairScore.get(key);
        if (!e) {
          e = { a: a < b ? a : b, b: a < b ? b : a, via: new Set(), strength: 0 };
          pairScore.set(key, e);
        }
        e.via.add(c.id);
        e.strength += c.weight;
      }
    }
  }

  const byPassage = new Map<string, Connection[]>();
  for (const e of pairScore.values()) {
    const conn: Connection = { a: e.a, b: e.b, via: [...e.via], strength: e.strength };
    for (const id of [e.a, e.b]) {
      const list = byPassage.get(id) ?? [];
      list.push(conn);
      byPassage.set(id, list);
    }
  }
  for (const [id, list] of byPassage) {
    list.sort((x, y) => y.strength - x.strength);
    byPassage.set(id, list.slice(0, maxConn));
  }

  return {
    topic,
    docs: new Map(docs.map((d) => [d.id, d])),
    passages,
    concepts: kept,
    connections: byPassage,
  };
}

/** The corpus concept that best matches the session topic, if any. */
export function resolveTopicConcept(corpus: Corpus): Concept | undefined {
  const key = normalize(corpus.topic);
  const exact = corpus.concepts.find((c) => c.id === key);
  if (exact) return exact;
  const words = new Set(key.split(' '));
  let best: Concept | undefined;
  let bestScore = 0;
  for (const c of corpus.concepts) {
    const overlap = c.id.split(' ').filter((w) => words.has(w)).length;
    const score = overlap * c.weight;
    if (overlap > 0 && score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
