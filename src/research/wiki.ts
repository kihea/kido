// Wikipedia + Wikibooks provider (same MediaWiki API, different host).
// Full plain-text extracts sliced into verbatim section passages, each
// deep-linked to its section anchor. CC BY-SA attribution.
//
// Passages are sampled across the WHOLE document (lead, body, late sections):
// boundary contrasts and principles tend to live late in an article, and the
// layer stack needs all of them present.

import type { Passage, SourceDoc, SourceType } from '../core/types';
import { clampAtSentence, dropLeadingMeta, freshId, getJSON, isMetaSentence } from './net';

const SKIP_SECTIONS =
  /^(references|external links|see also|further reading|notes|footnotes|bibliography|sources|citations|gallery|works cited)$/i;

export interface SectionChunk {
  section: string;
  text: string;
}

/** Split a MediaWiki plaintext extract into titled sections. Exported for tests. */
export function splitSections(extract: string): SectionChunk[] {
  const out: SectionChunk[] = [];
  let current = 'Overview';
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text && !SKIP_SECTIONS.test(current)) out.push({ section: current, text });
    buf = [];
  };
  for (const line of extract.split('\n')) {
    const m = line.match(/^=+\s*(.+?)\s*=+\s*$/);
    if (m) {
      flush();
      current = m[1]!;
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 180 && !/^\|/.test(p) && !isMetaSentence(p));
}

/** Rendered HTML → plain text, keeping paragraph boundaries. Exported for tests. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<(sup|table)[\s\S]*?<\/\1>/gi, ' ') // footnote markers, layout tables
    .replace(/<\/(p|div|h\d|li|tr|blockquote)>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wikisource renders most works by transcluding proofread scan pages, which
 * the TextExtracts API cannot expand (it returns ''). action=parse renders
 * the real text, so primary sources actually contribute passages.
 */
async function parsePlainText(api: string, pageid: number): Promise<string | null> {
  const data = (await getJSON(
    `${api}?action=parse&pageid=${pageid}&prop=text&format=json&origin=*`,
    12000,
  )) as { parse?: { text?: { '*'?: string } } } | null;
  const html = data?.parse?.text?.['*'];
  return html ? htmlToText(html) : null;
}

type WikiHost = 'en.wikipedia.org' | 'en.wikibooks.org' | 'en.wikisource.org' | 'en.wikinews.org';

function licenseFor(host: WikiHost): string {
  switch (host) {
    case 'en.wikisource.org':
      return 'Public domain (Wikisource)';
    case 'en.wikinews.org':
      return 'CC BY 2.5 (Wikinews)';
    default:
      return 'CC BY-SA 4.0';
  }
}

/** Spread candidate paragraphs across early/middle/late sections. Exported for tests. */
export function spreadPick<T extends { sectionOrdinal: number }>(
  candidates: T[],
  sectionCount: number,
  max: number,
): T[] {
  const third = Math.max(1, Math.ceil(sectionCount / 3));
  const buckets = [
    candidates.filter((c) => c.sectionOrdinal < third),
    candidates.filter((c) => c.sectionOrdinal >= third && c.sectionOrdinal < 2 * third),
    candidates.filter((c) => c.sectionOrdinal >= 2 * third),
  ];
  const picked: T[] = [];
  for (let round = 0; picked.length < max; round++) {
    let took = false;
    for (const bucket of buckets) {
      if (picked.length >= max) break;
      const item = bucket[round];
      if (item) {
        picked.push(item);
        took = true;
      }
    }
    if (!took) break;
  }
  picked.sort((a, b) => a.sectionOrdinal - b.sectionOrdinal);
  return picked;
}

export async function searchWiki(
  query: string,
  host: WikiHost,
  sourceType: SourceType,
  provider: string,
  maxPages: number,
  maxPassagesPerPage: number,
): Promise<{ docs: SourceDoc[]; passages: Passage[] }> {
  const api = `https://${host}/w/api.php`;
  const search = (await getJSON(
    `${api}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${maxPages + 2}&format=json&origin=*`,
  )) as { query?: { search?: { pageid: number; title: string }[] } } | null;
  const hits = search?.query?.search ?? [];
  if (hits.length === 0) return { docs: [], passages: [] };

  const ids = hits.slice(0, maxPages).map((h) => h.pageid);
  const pages = (await getJSON(
    `${api}?action=query&prop=extracts|info&explaintext=1&exlimit=max&inprop=url&pageids=${ids.join('|')}&format=json&origin=*`,
  )) as {
    query?: { pages?: Record<string, { pageid: number; title: string; extract?: string; fullurl?: string }> };
  } | null;
  const pageMap = pages?.query?.pages ?? {};

  const docs: SourceDoc[] = [];
  const passages: Passage[] = [];
  for (const id of ids) {
    const page = pageMap[String(id)];
    if (!page) continue;
    // Wikisource works are transcluded from scans, so extracts come back
    // empty — render the page instead. Other hosts always have extracts.
    let extract = page.extract;
    if (!extract && host === 'en.wikisource.org') {
      extract = (await parsePlainText(api, page.pageid)) ?? undefined;
    }
    if (!extract) continue;
    const url = page.fullurl ?? `https://${host}/?curid=${page.pageid}`;
    const doc: SourceDoc = {
      id: freshId('doc'),
      provider,
      sourceType,
      title: page.title,
      url,
      license: licenseFor(host),
    };
    const sections = splitSections(extract.slice(0, 48000));
    const candidates: { section: string; para: string; sectionOrdinal: number }[] = [];
    sections.forEach((chunk, ordinal) => {
      for (const raw of paragraphs(chunk.text).slice(0, 4)) {
        const para = dropLeadingMeta(raw);
        if (para) candidates.push({ section: chunk.section, para, sectionOrdinal: ordinal });
      }
    });
    const picked = spreadPick(candidates, sections.length, maxPassagesPerPage);
    let pIndex = 0;
    for (const c of picked) {
      passages.push({
        id: freshId('p'),
        docId: doc.id,
        text: clampAtSentence(c.para, 920, 1500),
        anchor: c.section,
        anchorUrl:
          c.section === 'Overview' ? url : `${url}#${encodeURIComponent(c.section.replace(/ /g, '_'))}`,
        index: pIndex++,
      });
    }
    if (picked.length > 0) docs.push(doc);
  }
  return { docs, passages };
}
