// OpenAlex provider: scholarly works with verbatim abstracts. CORS-open and
// keyless. Citation counts let a field's landmark papers rise above merely
// title-matching ones. Abstracts are stored as an inverted index; we rebuild
// the authors' own words exactly, never paraphrasing.

import type { Passage, SourceDoc } from '../core/types';
import { clampAtSentence, dropLeadingMeta, freshId, getJSON } from './net';

const API = 'https://api.openalex.org/works';
const FIELDS =
  'id,title,display_name,doi,publication_year,cited_by_count,authorships,abstract_inverted_index,primary_location';

interface OaWork {
  title?: string;
  display_name?: string;
  doi?: string;
  publication_year?: number;
  cited_by_count?: number;
  authorships?: { author?: { display_name?: string } }[];
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: { landing_page_url?: string };
}

/** OpenAlex stores abstracts as word → positions; rebuild the verbatim text. Exported for tests. */
export function reconstructAbstract(inv: Record<string, number[]> | null | undefined): string {
  if (!inv) return '';
  const slots: { pos: number; w: string }[] = [];
  for (const [w, positions] of Object.entries(inv)) {
    for (const pos of positions) slots.push({ pos, w });
  }
  slots.sort((a, b) => a.pos - b.pos);
  return slots.map((s) => s.w).join(' ');
}

function workToSource(work: OaWork): { doc: SourceDoc; passage: Passage } | null {
  const title = work.title ?? work.display_name;
  if (!title) return null;
  const raw = reconstructAbstract(work.abstract_inverted_index);
  if (raw.length < 200) return null;
  const abstract = dropLeadingMeta(raw, 240) || raw;
  const url = work.primary_location?.landing_page_url ?? work.doi;
  if (!url) return null;
  const first = work.authorships?.[0]?.author?.display_name;
  const author = first ? first + ((work.authorships?.length ?? 0) > 1 ? ' et al.' : '') : undefined;
  const doc: SourceDoc = {
    id: freshId('doc'),
    provider: 'OpenAlex',
    sourceType: 'paper',
    title,
    url,
    ...(author ? { author } : {}),
    ...(work.publication_year ? { date: String(work.publication_year) } : {}),
  };
  return {
    doc,
    passage: {
      id: freshId('p'),
      docId: doc.id,
      text: clampAtSentence(abstract, 950, 1500),
      anchor: 'Abstract',
      anchorUrl: url,
      index: 0,
    },
  };
}

/** Citation-tempered ranking: landmark papers beat fresh-but-uncited matches. Exported for tests. */
export function rankWorks(results: OaWork[]): OaWork[] {
  return results
    .map((w, i) => ({ w, score: Math.log10(1 + (w.cited_by_count ?? 0)) - 0.35 * i }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);
}

export async function searchOpenAlex(
  query: string,
  max = 5,
  politeEmail?: string,
): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const mailto = politeEmail ? `&mailto=${encodeURIComponent(politeEmail)}` : '';
  const data = (await getJSON(
    `${API}?search=${encodeURIComponent(query)}&per-page=12&select=${FIELDS}${mailto}`,
  )) as { results?: OaWork[] } | null;

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const w of rankWorks(data?.results ?? [])) {
    if (docs.length >= max) break;
    const made = workToSource(w);
    if (!made) continue;
    docs.push(made.doc);
    passages.push(made.passage);
  }
  return { docs, passages };
}
