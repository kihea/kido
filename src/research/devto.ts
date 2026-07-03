// DEV Community provider: practitioner blog explainers, keyless and CORS-open.
// A working engineer explaining a topic in their own words fills the register
// between encyclopedia prose and paper abstracts. The excerpt is the author's
// own description; the card is a doorway to the full post.

import type { Passage, SourceDoc } from '../core/types';
import { clampAtSentence, freshId, getJSON, queryTokens, relevanceOk, stripHtml } from './net';

interface DevtoSearchHit {
  title?: string;
  path?: string;
  user?: { name?: string };
  readable_publish_date?: string;
  body_text?: string;
  description?: string;
}
interface DevtoArticle {
  title?: string;
  url?: string;
  description?: string;
  user?: { name?: string };
  published_at?: string;
  positive_reactions_count?: number;
}

export async function searchDevto(query: string, max = 3): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const tokens = queryTokens(query);
  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];

  const push = (title: string, url: string, text: string, author?: string, date?: string) => {
    if (docs.length >= max || text.length < 160 || !relevanceOk(`${title} ${text}`, tokens)) return;
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider: 'DEV Community',
      sourceType: 'blog',
      title,
      url,
      ...(author ? { author } : {}),
      ...(date ? { date } : {}),
    };
    docs.push(doc);
    passages.push({
      id: freshId('p'),
      docId: doc.id,
      text: clampAtSentence(text, 700, 1100),
      anchor: 'From the post',
      anchorUrl: url,
      index: 0,
    });
  };

  // Primary: the site's own search feed.
  const search = (await getJSON(
    `https://dev.to/search/feed_content?per_page=10&class_name=Article&search_fields=${encodeURIComponent(query)}`,
    9000,
  )) as { result?: DevtoSearchHit[] } | null;
  for (const hit of search?.result ?? []) {
    if (!hit.title || !hit.path) continue;
    const text = stripHtml(hit.body_text ?? hit.description ?? '');
    push(hit.title, `https://dev.to${hit.path}`, text, hit.user?.name, hit.readable_publish_date);
  }

  // Fallback: tag listing on the query's strongest token, reaction-ranked.
  if (docs.length === 0 && tokens[0]) {
    const tag = tokens[0].replace(/[^a-z0-9]/g, '');
    const arts = (await getJSON(`https://dev.to/api/articles?per_page=20&tag=${tag}`, 9000)) as
      | DevtoArticle[]
      | null;
    const ranked = (arts ?? []).sort(
      (a, b) => (b.positive_reactions_count ?? 0) - (a.positive_reactions_count ?? 0),
    );
    for (const a of ranked) {
      if (!a.title || !a.url) continue;
      push(a.title, a.url, stripHtml(a.description ?? ''), a.user?.name, a.published_at?.slice(0, 10));
    }
  }
  return { docs, passages };
}
