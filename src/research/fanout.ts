// Research fan-out: query all providers in parallel, best-effort, and report
// progress. Then branch out — a learner asking about X also needs what X
// presupposes, how it works, and what it should not be confused with — and
// research the branches with the same real providers.
//
// AI-off behavior (G1): the study map here is heuristic (template branches).
// A configured model may propose a better map (src/ai) — the shape is the same.

import type { Corpus, Passage, ProviderProgress, SourceDoc, StudyBranch, StudyMap } from '../core/types';
import { searchWiki } from './wiki';
import { searchCrossref } from './crossref';
import { searchOpenAlex } from './openalex';
import { searchSemanticScholar } from './semanticscholar';
import { searchEuropePmc } from './europepmc';
import { searchDoaj } from './doaj';
import { searchArchive } from './archive';
import { searchStackExchange } from './stackexchange';
import { searchHN } from './hn';
import { searchOpenLibrary } from './openlibrary';
import { searchChronicling } from './chronicling';

export interface ResearchResult {
  docs: SourceDoc[];
  passages: Passage[];
  progress: ProviderProgress[];
}

type Provider = {
  name: string;
  run: (query: string) => Promise<{ docs: SourceDoc[]; passages: Passage[] }>;
};

export interface FanoutOptions {
  /** Passed to OpenAlex for the polite pool; never required. */
  politeEmail?: string;
  /** Topic looks historical → include slow primary/newspaper providers. */
  historical?: boolean;
  /** Technical topic → include Stack Exchange accepted answers. */
  technical?: boolean;
  /** Current-events topic → include Wikinews. */
  current?: boolean;
}

/** The provider set for a query, shaped by options. */
export function seedProviders(opts: FanoutOptions = {}): Provider[] {
  const providers: Provider[] = [
    { name: 'Wikipedia', run: (q) => searchWiki(q, 'en.wikipedia.org', 'encyclopedia', 'Wikipedia', 3, 8) },
    { name: 'Wikibooks', run: (q) => searchWiki(q, 'en.wikibooks.org', 'textbook', 'Wikibooks', 2, 5) },
    { name: 'OpenAlex', run: (q) => searchOpenAlex(q, 5, opts.politeEmail) },
    { name: 'Semantic Scholar', run: (q) => searchSemanticScholar(q) },
    { name: 'Europe PMC', run: (q) => searchEuropePmc(q) },
    { name: 'DOAJ', run: (q) => searchDoaj(q) },
    { name: 'Crossref', run: (q) => searchCrossref(q) },
    { name: 'Hacker News', run: (q) => searchHN(q) },
    { name: 'Open Library', run: (q) => searchOpenLibrary(q) },
    { name: 'Wikiversity', run: (q) => searchWiki(q, 'en.wikiversity.org', 'textbook', 'Wikiversity', 1, 4) },
  ];
  if (opts.technical) {
    providers.push({ name: 'Stack Exchange', run: (q) => searchStackExchange(q) });
  }
  if (opts.current) {
    providers.push({ name: 'Wikinews', run: (q) => searchWiki(q, 'en.wikinews.org', 'news', 'Wikinews', 2, 3) });
  }
  if (opts.historical) {
    // Primary documents and period newspapers earn their slowness only when
    // the topic is actually historical.
    providers.push(
      { name: 'Wikisource', run: (q) => searchWiki(q, 'en.wikisource.org', 'primary', 'Wikisource', 2, 3) },
      { name: 'Wikiquote', run: (q) => searchWiki(q, 'en.wikiquote.org', 'primary', 'Wikiquote', 1, 3) },
      { name: 'Internet Archive', run: (q) => searchArchive(q) },
      { name: 'Chronicling America', run: (q) => searchChronicling(q) },
    );
  }
  return providers;
}

export async function researchQuery(
  query: string,
  onProgress?: (progress: ProviderProgress[]) => void,
  providers: Provider[] = seedProviders(),
): Promise<ResearchResult> {
  const progress: ProviderProgress[] = providers.map((p) => ({ name: p.name, status: 'pending', passages: 0 }));
  const report = () => onProgress?.(progress.map((p) => ({ ...p })));
  report();

  const results = await Promise.all(
    providers.map(async (p, i) => {
      try {
        const r = await p.run(query);
        progress[i]! = { name: p.name, status: 'ok', passages: r.passages.length };
        report();
        return r;
      } catch {
        progress[i]! = { name: p.name, status: 'fail', passages: 0 };
        report();
        return { docs: [], passages: [] };
      }
    }),
  );

  return {
    docs: results.flatMap((r) => r.docs),
    passages: results.flatMap((r) => r.passages),
    progress,
  };
}

/**
 * Heuristic study map: the branch kinds a layered understanding needs, as
 * literal search queries. Reach ∈ [0,1] gates how far the map wanders.
 */
export function heuristicStudyMap(topic: string, reach = 0.5): StudyMap {
  const branches: StudyBranch[] = [
    {
      kind: 'mechanism',
      concept: `how ${topic} works`,
      query: `how ${topic} works mechanism`,
      why: `Comprising layer: what ${topic} is made of and how the parts move.`,
    },
    {
      kind: 'prerequisite',
      concept: `foundations of ${topic}`,
      query: `${topic} fundamentals introduction`,
      why: `What ${topic} presupposes — the units and gradients underneath it.`,
    },
  ];
  if (reach >= 0.35) {
    branches.push({
      kind: 'context',
      concept: `history of ${topic}`,
      query: `history of ${topic}`,
      why: `The time layer: where ${topic} came from and how it changed.`,
    });
  }
  if (reach >= 0.55) {
    branches.push({
      kind: 'application',
      concept: `${topic} in practice`,
      query: `${topic} applications examples`,
      why: `Embodiment: where ${topic} actually bites, in concrete cases.`,
    });
  }
  if (reach >= 0.75) {
    branches.push({
      kind: 'frontier',
      concept: `debates about ${topic}`,
      query: `${topic} criticism limitations debate`,
      why: `The contested edge: where sources disagree about ${topic}.`,
    });
  }
  return { idea: topic, branches, builtBy: 'heuristic' };
}

/**
 * Full session research: seed query plus study-map branches (branch docs are
 * tagged with why they were gathered). Returns raw docs/passages for the
 * engine's corpus analysis.
 */
const HISTORICAL = /\b(history|historical|war|revolution|empire|century|ancient|medieval|dynasty|colonial|reformation|\d{4}s?)\b/i;

export function looksHistorical(topic: string): boolean {
  return HISTORICAL.test(topic);
}

const TECHNICAL = /\b(programming|code|software|algorithm|api|database|compiler|framework|network|linux|python|javascript|rust|machine learning|neural|regex|encryption|server)\b/i;

export function looksTechnical(topic: string): boolean {
  return TECHNICAL.test(topic);
}

const CURRENT = /\b(current|recent|today|this year|202\d|latest|ongoing|crisis|election)\b/i;

export function looksCurrent(topic: string): boolean {
  return CURRENT.test(topic);
}

export async function researchTopic(
  topic: string,
  opts: {
    reach?: number;
    studyMap?: StudyMap;
    politeEmail?: string;
    onProgress?: (p: ProviderProgress[]) => void;
  } = {},
): Promise<{ docs: SourceDoc[]; passages: Passage[]; progress: ProviderProgress[]; studyMap: StudyMap }> {
  const historical = looksHistorical(topic) || (opts.reach ?? 0.5) >= 0.75;
  const providers = seedProviders({
    ...(opts.politeEmail ? { politeEmail: opts.politeEmail } : {}),
    historical,
    technical: looksTechnical(topic),
    current: looksCurrent(topic),
  });
  const seed = await researchQuery(topic, opts.onProgress, providers);
  const studyMap = opts.studyMap ?? heuristicStudyMap(topic, opts.reach ?? 0.5);

  // Branches use the encyclopedia only — breadth without drowning the seed.
  const branchResults = await Promise.all(
    studyMap.branches.map(async (b) => {
      try {
        const r = await searchWiki(b.query, 'en.wikipedia.org', 'encyclopedia', 'Wikipedia', 1, 4);
        for (const d of r.docs) d.branch = { kind: b.kind, concept: b.concept, why: b.why };
        return r;
      } catch {
        return { docs: [], passages: [] };
      }
    }),
  );

  // De-duplicate: a branch may re-find a seed page (same URL).
  const seen = new Set(seed.docs.map((d) => d.url));
  const branchDocs: SourceDoc[] = [];
  const branchDocIds = new Set<string>();
  for (const r of branchResults) {
    for (const d of r.docs) {
      if (seen.has(d.url)) continue;
      seen.add(d.url);
      branchDocs.push(d);
      branchDocIds.add(d.id);
    }
  }
  const branchPassages = branchResults.flatMap((r) => r.passages.filter((p) => branchDocIds.has(p.docId)));

  return {
    docs: [...seed.docs, ...branchDocs],
    passages: [...seed.passages, ...branchPassages],
    progress: seed.progress,
    studyMap,
  };
}

/** Attach the study map to an analyzed corpus (kept separate for testability). */
export function withStudyMap(corpus: Corpus, studyMap: StudyMap): Corpus {
  return { ...corpus, studyMap };
}
