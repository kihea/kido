// Stack Exchange provider: accepted/top answers as verbatim discussion —
// practitioners explaining, qualifying, and disagreeing in their own words.
// Keyless (shared quota), CORS-open, gzip-required API.

import type { Passage, SourceDoc } from '../core/types';
import { clampAtSentence, freshId, getJSON, queryTokens, relevanceOk, stripHtml } from './net';

interface SeAnswer {
  body?: string;
  score?: number;
  link?: string;
  owner?: { display_name?: string };
}
interface SeQuestion {
  title?: string;
  link?: string;
  is_answered?: boolean;
  question_id?: number;
  accepted_answer_id?: number;
}

export async function searchStackExchange(
  query: string,
  max = 3,
  site = 'stackoverflow',
): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const qs = (await getJSON(
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}` +
      `&accepted=True&site=${site}&pagesize=6&filter=default`,
    10000,
  )) as { items?: SeQuestion[] } | null;
  const questions = (qs?.items ?? []).filter((q) => q.title && q.accepted_answer_id);
  if (questions.length === 0) return { docs: [], passages: [] };

  const ids = questions.slice(0, max + 2).map((q) => q.accepted_answer_id).join(';');
  const ans = (await getJSON(
    `https://api.stackexchange.com/2.3/answers/${ids}?order=desc&sort=votes&site=${site}&filter=withbody`,
    10000,
  )) as { items?: (SeAnswer & { answer_id?: number })[] } | null;
  const byId = new Map((ans?.items ?? []).map((a) => [a.answer_id, a]));
  const tokens = queryTokens(query);

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const q of questions) {
    if (docs.length >= max) break;
    const a = byId.get(q.accepted_answer_id);
    if (!a?.body) continue;
    const text = stripHtml(a.body);
    if (text.length < 250 || !relevanceOk(text, tokens)) continue;
    const title = stripHtml(q.title!);
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider: 'Stack Exchange',
      sourceType: 'discussion',
      title: `Accepted answer: “${title}”`,
      url: a.link ?? q.link ?? `https://${site}.com/q/${q.question_id}`,
      ...(a.owner?.display_name ? { author: a.owner.display_name } : {}),
      license: 'CC BY-SA 4.0',
    };
    docs.push(doc);
    passages.push({
      id: freshId('p'),
      docId: doc.id,
      text: clampAtSentence(text, 700, 1100),
      anchor: 'Accepted answer',
      anchorUrl: doc.url,
      index: 0,
    });
  }
  return { docs, passages };
}
