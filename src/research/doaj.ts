// DOAJ (Directory of Open Access Journals): keyless, CORS-open. Peer-reviewed
// open-access article abstracts — the authors' verbatim words, every one
// freely readable at the link (no paywall doorway, unlike some Crossref hits).

import type { Passage, SourceDoc } from '../core/types';
import { clampAtSentence, dropLeadingMeta, freshId, getJSON, stripHtml } from './net';

interface DoajArticle {
  bibjson?: {
    title?: string;
    abstract?: string;
    year?: string;
    author?: { name?: string }[];
    link?: { url?: string; type?: string }[];
    journal?: { title?: string };
  };
}

export async function searchDoaj(query: string, max = 3): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const data = (await getJSON(
    `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=8`,
    10000,
  )) as { results?: DoajArticle[] } | null;
  const results = data?.results ?? [];

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const r of results) {
    if (docs.length >= max) break;
    const b = r.bibjson;
    if (!b?.title || !b.abstract) continue;
    const raw = stripHtml(b.abstract).trim();
    if (raw.length < 200) continue;
    const abstract = dropLeadingMeta(raw, 240) || raw;
    const link = b.link?.find((l) => l.type === 'fulltext')?.url ?? b.link?.[0]?.url;
    if (!link) continue;
    const first = b.author?.[0]?.name;
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider: 'DOAJ',
      sourceType: 'paper',
      title: stripHtml(b.title),
      url: link,
      ...(first ? { author: first + ((b.author?.length ?? 0) > 1 ? ' et al.' : '') } : {}),
      ...(b.year ? { date: b.year } : {}),
      license: 'Open access',
    };
    docs.push(doc);
    passages.push({
      id: freshId('p'),
      docId: doc.id,
      text: clampAtSentence(abstract, 950, 1500),
      anchor: b.journal?.title ? `Abstract — ${b.journal.title}` : 'Abstract',
      anchorUrl: link,
      index: 0,
    });
  }
  return { docs, passages };
}
