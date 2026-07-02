// ---------------------------------------------------------------------------
// KIDO domain types — the shared vocabulary (see docs/ENGINE.md).
//
// Two commitments live in these types:
//  1. Source-first: excerpts are verbatim and attributed. Anything the system
//     wrote itself is marked `synthesis` and carries its provenance.
//  2. Layer discipline: understanding, evidence, and practice are all located
//     on the L0–L8 stack, never as one flat score.
// ---------------------------------------------------------------------------

// -- sources -----------------------------------------------------------------

export type SourceType =
  | 'encyclopedia' // Wikipedia
  | 'textbook' // Wikibooks
  | 'paper' // Crossref / OpenAlex scholarly abstracts (the authors' own words)
  | 'discussion' // Hacker News comments (where pushback lives)
  | 'book' // Open Library pointers
  | 'news' // Chronicling America historic newspapers (the topic in its own time)
  | 'primary' // Wikisource original documents and texts
  | 'reference'; // Wiktionary definitions

export interface SourceDoc {
  id: string;
  provider: string; // human label: "Wikipedia", "Crossref", ...
  sourceType: SourceType;
  title: string;
  url: string;
  author?: string;
  date?: string;
  license?: string; // attribution note, e.g. CC BY-SA for wiki content
  /** Set when this doc was gathered for a study-map branch, not the seed query. */
  branch?: { kind: BranchKind; concept: string; why: string };
}

/** A verbatim excerpt. Never paraphrased, never summarized. */
export interface Passage {
  id: string;
  docId: string;
  text: string;
  /** Section heading / anchor within the source, when known. */
  anchor?: string;
  anchorUrl?: string;
  index: number; // position within its document
  /** Layer tags assigned by engine/annotate.ts. */
  layers?: LayerTag[];
}

// -- the layer stack ----------------------------------------------------------

/** L0 potential … L8 principle. See docs/ENGINE.md §1. */
export type Layer = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const LAYERS: readonly Layer[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export interface LayerInfo {
  layer: Layer;
  name: string;
  /** The question this layer answers about a topic. */
  question: string;
  /** Short learner-facing gloss. */
  gloss: string;
}

export interface LayerTag {
  layer: Layer;
  /** 0..1 heuristic (or model) confidence. */
  confidence: number;
  /** The textual cue that triggered the tag — every tag is explainable. */
  cue: string;
  by: 'heuristic' | 'model';
}

// -- corpus (research output, engine input) -----------------------------------

/**
 * How a study-map branch relates to the main idea: the lead-up it sits
 * downstream of, what it presupposes, how it works, what goes into it, where
 * it bites, where it came from, what is contested, what sits beside it.
 */
export type BranchKind =
  | 'context'
  | 'prerequisite'
  | 'mechanism'
  | 'component'
  | 'application'
  | 'foundation'
  | 'frontier'
  | 'adjacent';

export interface StudyBranch {
  kind: BranchKind;
  concept: string;
  /** Literal search phrase used against the real providers. */
  query: string;
  /** What this thread unlocks about the main idea (shown to the learner). */
  why: string;
}

export interface StudyMap {
  idea: string;
  branches: StudyBranch[];
  builtBy: 'model' | 'heuristic';
}

/** A term that recurs across independent sources — a node in the topic's structure. */
export interface Concept {
  id: string; // normalized key
  label: string; // most common surface form
  df: number; // how many passages mention it
  weight: number; // idf-style importance
  passageIds: string[];
  /** Meaningful enough to anchor practice; generic recurring words are not. */
  important: boolean;
  /** Passage that defines this term inside the corpus, if any. */
  definedByPassage?: string;
}

/** A connection between two passages, carried by shared concepts. */
export interface Connection {
  a: string; // passage id
  b: string; // passage id
  via: string[]; // shared concept ids
  strength: number;
}

export interface Corpus {
  topic: string;
  docs: Map<string, SourceDoc>;
  passages: Passage[];
  concepts: Concept[];
  /** passage id -> its strongest connections */
  connections: Map<string, Connection[]>;
  studyMap?: StudyMap;
}

// -- dimensional profile (averaging output) -----------------------------------

/**
 * One claim in a layer entry. `excerpt` claims are verbatim source text
 * (extractive averaging — the AI-off path). `synthesis` claims were written by
 * a configured model and are labeled as such in the UI.
 */
export interface Claim {
  id: string;
  layer: Layer;
  kind: 'excerpt' | 'synthesis';
  text: string;
  /** Supporting verbatim passages (≥1 for excerpt; ≥1 grounding for synthesis). */
  passageIds: string[];
  /** Present when sources disagree — the disagreement is the content. */
  tension?: string;
}

export type ComprisingRelation = 'requires' | 'part-of' | 'mechanism-of' | 'example-of';

export interface ComprisingEdge {
  concept: string; // concept id
  label: string;
  relation: ComprisingRelation;
  /** Layer at which this dependency operates. */
  layer: Layer;
  passageIds: string[];
}

export interface NeighborEdge {
  concept: string; // concept id (may be outside the corpus)
  label: string;
  /** What separates the topic from this neighbor, when known. */
  contrast?: string;
  /** The discrimination question a boundary test builds on. */
  boundaryQuestion: string;
  passageIds: string[];
}

export interface LayerEntry {
  layer: Layer;
  claims: Claim[];
  /** 0..1 — how much source evidence this layer has. */
  coverage: number;
}

export interface DimensionalProfile {
  topic: string;
  /** Concept id of the topic inside the corpus, when resolved. */
  conceptId?: string;
  layers: Record<Layer, LayerEntry>;
  comprising: ComprisingEdge[];
  neighboring: NeighborEdge[];
  /** Layers with no usable evidence — stated, not hidden. */
  gaps: Layer[];
  /** 0..1 across the maturity questions (docs/ENGINE.md §4). */
  maturity: number;
}

// -- learner model -------------------------------------------------------------

export type EvidenceKind =
  | 'identify' // L1: pick out the unit
  | 'gradient' // L2: reason along an attribute axis
  | 'boundary' // L3: example vs near non-example
  | 'instantiate' // L4: produce/recognize a concrete instance
  | 'sequence' // L5: reconstruct order/process
  | 'retrieval' // L6: recall the concept from a cue
  | 'feynman' // L6/L7: plain-language reconstruction
  | 'map-repair' // L7: place a missing relation
  | 'transfer'; // L8: apply the principle in a new case

export type Outcome = 'pass' | 'partial' | 'miss' | 'skipped';

export interface EvidenceEvent {
  at: number; // epoch ms (injected clock)
  layer: Layer;
  kind: EvidenceKind;
  outcome: Outcome;
  itemId?: string;
  /** True when the learner needed a hint — weakens the pass. */
  hinted?: boolean;
}

export interface LayerMastery {
  /** 0..1 evidence-weighted estimate. Meaningless when evidence === 0. */
  value: number;
  /** Number of evidence events that touched this layer. */
  evidence: number;
  lastAt?: number;
}

export type MasteryVector = Record<Layer, LayerMastery>;

// -- teaching moves -------------------------------------------------------------

export type MoveKind =
  | 'diagnostic'
  | 'direct-explanation'
  | 'gradient-prompt'
  | 'boundary-test'
  | 'worked-example'
  | 'sequence-reconstruction'
  | 'feynman'
  | 'map-repair'
  | 'principle-transfer'
  | 'retrieval-review';

/** Domain families from the pedagogy matrix — they weight layers differently. */
export type DomainFamily =
  | 'math'
  | 'ml'
  | 'programming'
  | 'systems'
  | 'design'
  | 'history'
  | 'language'
  | 'general';

// -- practice items (exertion output) -------------------------------------------

interface PracticeBase {
  id: string;
  layer: Layer;
  kind: EvidenceKind;
  /** Why the engine generated this item — always stated. */
  reason: string;
  /** Verbatim grounding. */
  passageIds: string[];
}

/** Retrieval: a source sentence with the key term blanked. */
export interface ClozeItem extends PracticeBase {
  type: 'cloze';
  prompt: string; // sentence with blank
  answer: string;
  accept: string[]; // lowercased acceptable inputs
  conceptId: string;
  sourceTitle: string;
}

/** Boundary: is this an example of the topic, or a near non-example — and why? */
export interface BoundaryItem extends PracticeBase {
  type: 'boundary';
  topicLabel: string;
  neighborLabel: string;
  question: string;
  /** What a good discrimination mentions. */
  keyContrast?: string;
}

/** Sequence: put the steps/events back in order. */
export interface SequenceItem extends PracticeBase {
  type: 'sequence';
  instruction: string;
  /** Steps in correct order; UI shuffles for display. */
  steps: string[];
}

/** Feynman: explain it plainly; self- or model-evaluated against must-mention points. */
export interface FeynmanItem extends PracticeBase {
  type: 'feynman';
  prompt: string;
  mustMention: string[]; // concept labels a complete explanation touches
}

/** Map repair: which relation belongs on this edge? */
export interface MapRepairItem extends PracticeBase {
  type: 'map-repair';
  fromLabel: string;
  toLabel: string;
  options: ComprisingRelation[];
  answer: ComprisingRelation;
}

/** Transfer: changed condition — what follows? */
export interface TransferItem extends PracticeBase {
  type: 'transfer';
  scenario: string;
  question: string;
}

/**
 * Grouping (Connections-style): sort a shuffled set of concepts into the two
 * groups they belong to — the topic's comprising concepts vs. its neighbors.
 * Trains L3 boundary discrimination through interaction, not prose.
 */
export interface GroupingItem extends PracticeBase {
  type: 'grouping';
  instruction: string;
  groupA: { label: string; members: string[] };
  groupB: { label: string; members: string[] };
}

/** Flashcard: a concept cue on the front, its source-grounded answer on flip. */
export interface FlashcardItem extends PracticeBase {
  type: 'flashcard';
  front: string;
  back: string;
  sourceTitle: string;
  sourceUrl: string;
}

export type PracticeItem =
  | ClozeItem
  | BoundaryItem
  | SequenceItem
  | FeynmanItem
  | MapRepairItem
  | TransferItem
  | GroupingItem
  | FlashcardItem;

// -- session cards ----------------------------------------------------------------

/** A verbatim excerpt shown as reading material, with its threads and reason. */
export interface ExcerptCard {
  kind: 'excerpt';
  id: string;
  passage: Passage;
  doc: SourceDoc;
  /** Concept ids this card introduces for the first time in the session. */
  newConcepts: string[];
  /** Ties back to earlier cards (shared concepts). */
  threads: { toCardId: string; via: string[]; viaLabels: string[] }[];
  layer: Layer;
  reason: string;
}

/** A practice card. Gates: boundary/sequence/cloze lock the feed until answered. */
export interface PracticeCard {
  kind: 'practice';
  id: string;
  item: PracticeItem;
  move: MoveKind;
  gate: boolean;
  reason: string;
}

/** The single opening question that locates the learner's entry layer. */
export interface DiagnosticCard {
  kind: 'diagnostic';
  id: string;
  question: string;
  /** Each option names the layer it indicates. */
  options: { label: string; layer: Layer }[];
  reason: string;
}

/** Synthesis written by the system (model or template) — always labeled. */
export interface ExplanationCard {
  kind: 'explanation';
  id: string;
  layer: Layer;
  text: string;
  by: 'model' | 'template';
  passageIds: string[];
  reason: string;
}

export interface SummaryCard {
  kind: 'summary';
  id: string;
  mastery: MasteryVector;
  /** The layer the learner should visit next, with why. */
  next: { layer: Layer; why: string } | null;
}

export type SessionCard =
  | ExcerptCard
  | PracticeCard
  | DiagnosticCard
  | ExplanationCard
  | SummaryCard;

// -- review ---------------------------------------------------------------------

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewItem {
  id: string; // stable per (topic, layer, item)
  topicId: string;
  layer: Layer;
  /** Practice item id this review replays. */
  itemId: string;
  due: number; // epoch ms
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
}

// -- provider progress (UI) -------------------------------------------------------

export interface ProviderProgress {
  name: string;
  status: 'pending' | 'ok' | 'fail';
  passages: number;
}
