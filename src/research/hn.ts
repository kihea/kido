// Hacker News (Algolia) provider: real discussion — practitioners arguing,
// qualifying, pushing back. Quoted verbatim, linked to the thread. This is
// where boundary contrasts and disagreement live.

import type { Passage, SourceDoc } from '../core/types';
import { clampAtSentence, freshId, getJSON, queryTokens, relevanceOk, stripHtml } from './net';

interface HnHit {
  objectID: string;
  comment_text?: string;
  story_title?: string;
  author?: string;
  created_at?: string;
}

export async function searchHN(query: string, max = 5): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const data = (await getJSON(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=24`,
  )) as { hits?: HnHit[] } | null;
  const hits = data?.hits ?? [];
  const tokens = queryTokens(query);

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const hit of hits) {
    if (docs.length >= max) break;
    if (!hit.comment_text || !hit.story_title) continue;
    const text = stripHtml(hit.comment_text);
    if (text.length < 220 || text.length > 1600) continue;
    if (/^\s*>/.test(hit.comment_text)) continue; // skip pure quote-replies
    if (!relevanceOk(text, tokens)) continue; // passing mentions teach nothing
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider: 'Hacker News',
      sourceType: 'discussion',
      title: `Comment on “${hit.story_title}”`,
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      ...(hit.author ? { author: hit.author } : {}),
      ...(hit.created_at ? { date: hit.created_at.slice(0, 10) } : {}),
    };
    docs.push(doc);
    passages.push({
      id: freshId('p'),
      docId: doc.id,
      text: clampAtSentence(text, 600, 900),
      anchor: 'Discussion thread',
      anchorUrl: doc.url,
      index: 0,
    });
  }
  return { docs, passages };
}
