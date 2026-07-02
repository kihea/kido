// Semantic Scholar Graph API: scholarly abstracts with citation counts and
// fields of study. Keyless and CORS-open (shared public rate limit — one
// call per session query). Complements OpenAlex/Crossref: its corpus leans
// CS/biomed and it often has abstracts the others lack.

import type { Passage, SourceDoc } from '../core/types';
import { clampAtSentence, dropLeadingMeta, freshId, getJSON } from './net';

interface S2Paper {
  title?: string;
  abstract?: string | null;
  url?: string;
  year?: number;
  citationCount?: number;
  authors?: { name?: string }[];
  externalIds?: { DOI?: string };
}

export async function searchSemanticScholar(
  query: string,
  max = 4,
): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const data = (await getJSON(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}` +
      `&limit=10&fields=title,abstract,url,year,citationCount,authors,externalIds`,
    10000,
  )) as { data?: S2Paper[] } | null;
  const papers = (data?.data ?? [])
    // Citation-tempered, like OpenAlex: landmark work beats bare title match.
    .map((p, i) => ({ p, score: Math.log10(1 + (p.citationCount ?? 0)) - 0.35 * i }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const p of papers) {
    if (docs.length >= max) break;
    if (!p.title || !p.abstract) continue;
    const raw = p.abstract.trim();
    if (raw.length < 200) continue;
    const abstract = dropLeadingMeta(raw, 240) || raw;
    const url = p.url ?? (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : undefined);
    if (!url) continue;
    const first = p.authors?.[0]?.name;
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider: 'Semantic Scholar',
      sourceType: 'paper',
      title: p.title,
      url,
      ...(first ? { author: first + ((p.authors?.length ?? 0) > 1 ? ' et al.' : '') } : {}),
      ...(p.year ? { date: String(p.year) } : {}),
    };
    docs.push(doc);
    passages.push({
      id: freshId('p'),
      docId: doc.id,
      text: clampAtSentence(abstract, 950, 1500),
      anchor: 'Abstract',
      anchorUrl: url,
      index: 0,
    });
  }
  return { docs, passages };
}
