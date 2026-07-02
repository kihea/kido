// Europe PMC: keyless, CORS-open REST over life-science + general scholarly
// literature (mirrors PubMed and more), with verbatim abstracts.

import type { Passage, SourceDoc } from '../core/types';
import { clampAtSentence, dropLeadingMeta, freshId, getJSON } from './net';

interface EpmcResult {
  title?: string;
  abstractText?: string;
  authorString?: string;
  pubYear?: string;
  doi?: string;
  fullTextUrlList?: { fullTextUrl?: { url?: string }[] };
  citedByCount?: number;
}

export async function searchEuropePmc(query: string, max = 3): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const data = (await getJSON(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}` +
      `&format=json&pageSize=10&resultType=core`,
    10000,
  )) as { resultList?: { result?: EpmcResult[] } } | null;
  const results = (data?.resultList?.result ?? [])
    .map((r, i) => ({ r, score: Math.log10(1 + (r.citedByCount ?? 0)) - 0.35 * i }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const r of results) {
    if (docs.length >= max) break;
    if (!r.title || !r.abstractText) continue;
    const raw = r.abstractText.trim();
    if (raw.length < 200) continue;
    const abstract = dropLeadingMeta(raw, 240) || raw;
    const url = r.doi
      ? `https://doi.org/${r.doi}`
      : r.fullTextUrlList?.fullTextUrl?.[0]?.url;
    if (!url) continue;
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider: 'Europe PMC',
      sourceType: 'paper',
      title: r.title.replace(/\.$/, ''),
      url,
      ...(r.authorString ? { author: r.authorString.split(',')[0]!.trim() + (r.authorString.includes(',') ? ' et al.' : '') } : {}),
      ...(r.pubYear ? { date: r.pubYear } : {}),
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
