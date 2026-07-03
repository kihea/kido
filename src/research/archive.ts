// Internet Archive: keyless, CORS-open. Full-text books and documents in the
// public domain. We search the catalog, then stream the head of a work's plain
// text and take a verbatim window around the query terms. Slow (full-text
// fetch), so this is gated to historical/literary sessions in the fan-out.

import type { Passage, SourceDoc } from '../core/types';
import {
  clampAtSentence,
  cleanOcr,
  fetchTextHead,
  freshId,
  getJSON,
  ocrQualityOk,
  queryTokens,
  relevanceOk,
} from './net';

interface IaDoc {
  identifier?: string;
  title?: string;
  creator?: string | string[];
  year?: string;
}

export async function searchArchive(query: string, max = 2): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const search = (await getJSON(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}+AND+mediatype:texts` +
      `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&rows=8&output=json`,
    10000,
  )) as { response?: { docs?: IaDoc[] } } | null;
  const found = (search?.response?.docs ?? []).filter((d) => d.identifier && d.title);
  const tokens = queryTokens(query);

  const fetched = await Promise.all(
    found.slice(0, max + 3).map(async (d) => {
      // The djvu.txt derivative is the OCR/plain text of most IA text items.
      const text = await fetchTextHead(
        `https://archive.org/download/${d.identifier}/${d.identifier}_djvu.txt`,
        300000,
        12000,
      );
      if (!text) return null;
      const clean = cleanOcr(text);
      const lower = clean.toLowerCase();
      let best: { excerpt: string; score: number } | null = null;
      for (const t of tokens) {
        const at = lower.indexOf(t);
        if (at < 0) continue;
        const windowRaw = clean.slice(Math.max(0, at - 450), at + 750).trim();
        const startAdj = windowRaw.search(/[A-Z]/);
        const excerpt = clampAtSentence(windowRaw.slice(Math.max(0, startAdj)), 600, 950);
        if (!ocrQualityOk(excerpt) || !relevanceOk(excerpt, tokens)) continue;
        const exLower = excerpt.toLowerCase();
        const score = tokens.filter((tk) => exLower.includes(tk)).length;
        if (!best || score > best.score) best = { excerpt, score };
      }
      return best ? { d, excerpt: best.excerpt } : null;
    }),
  );

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const hit of fetched) {
    if (!hit || docs.length >= max) continue;
    const { d, excerpt } = hit;
    const creator = Array.isArray(d.creator) ? d.creator[0] : d.creator;
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider: 'Internet Archive',
      sourceType: 'book',
      title: d.title!,
      url: `https://archive.org/details/${d.identifier}`,
      ...(creator ? { author: creator } : {}),
      ...(d.year ? { date: d.year } : {}),
    };
    docs.push(doc);
    passages.push({
      id: freshId('p'),
      docId: doc.id,
      text: excerpt,
      anchor: 'Full text (scanned)',
      anchorUrl: doc.url,
      index: 0,
    });
  }
  return { docs, passages };
}
