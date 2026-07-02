// Shared helpers for the research providers. Everything is best-effort: a
// provider that times out or errors contributes nothing (docs/ARCHITECTURE.md,
// error posture). Adapted from the tessera v0.1 providers (MIT, same author).

export async function getJSON(url: string, timeoutMs = 9000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Strip HTML tags and decode the handful of entities these APIs emit. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let idCounter = 0;
/** Session-scoped ids for research artifacts (engine ids are content-derived). */
export function freshId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Rough sentence split, good enough for trimming quotes at boundaries. */
export function roughSentences(text: string): string[] {
  return text.match(/[^.!?]+(?:[.!?]+["')\]]?|\s*$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

const META_VERB =
  /\b(delves?|examin\w*|explor\w*|discuss\w*|introduc\w*|present\w*|describ\w*|focus\w*|review\w*|consider\w*|address\w*|investigat\w*|analy[sz]\w*|outlin\w*|summari[sz]\w*|cover\w*|deal\w*\s+with|aim\w*\s+to|seek\w*\s+to|attempt\w*\s+to|look\w*\s+at)\b/i;

/**
 * Does this sentence describe the DOCUMENT rather than the subject? e.g.
 * "Chapter 2 delves into the historical development of inflation." Cards must
 * carry the material itself, so we trim these away (drop, never rewrite).
 */
export function isMetaSentence(s: string): boolean {
  const h = s.trim();
  if (/^chapter\s+\d+/i.test(h)) return true;
  if (/^(?:sub)?section\s+\d+/i.test(h)) return true;
  if (/^part\s+(?:\d+|one|two|three|i{1,3}v?)\b/i.test(h)) return true;
  if (/^(?:in\s+)?this\s+(paper|chapter|section|article|study|book|essay|work|review|entry)\b/i.test(h) && META_VERB.test(h))
    return true;
  if (/^the\s+(present|current|following|next)\s+(paper|chapter|section|study|work|article)\b/i.test(h)) return true;
  if (/^here\s+we\s+(present|propose|describe|review|introduce|report|show)\b/i.test(h)) return true;
  if (/\bmay refer to\b/i.test(h)) return true;
  if (/^this\s+(article|page|disambiguation)\s+is\s+about\b/i.test(h)) return true;
  return false;
}

/**
 * Strip leading document-describing sentences. If little substance remains,
 * return '' so the passage is dropped — a summary-of-a-summary teaches nothing.
 */
export function dropLeadingMeta(text: string, minKeep = 200): string {
  const parts = roughSentences(text);
  let i = 0;
  while (i < parts.length && isMetaSentence(parts[i]!)) i++;
  if (i === 0) return text;
  const kept = parts.slice(i).join(' ').trim();
  return kept.length >= minKeep ? kept : '';
}

/**
 * Cut an over-long verbatim run at a sentence boundary near `target` chars.
 * We trim, we never rewrite — the result is still a contiguous quote.
 */
export function clampAtSentence(text: string, target = 700, max = 1100): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  let cut = -1;
  const re = /[.!?]["')\]]?\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    if (m.index >= target * 0.55) {
      cut = m.index + 1;
      if (m.index >= target) break;
    }
  }
  return cut > 0 ? slice.slice(0, cut).trim() : slice.trim() + '…';
}

/** Meaningful lowercase tokens of a query, for relevance checks. */
export function queryTokens(query: string): string[] {
  return [
    ...new Set(
      (query.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter(
        (w) => !/^(the|and|how|why|what|with|from|into|does|that|this|their|about|between|history)$/.test(w),
      ),
    ),
  ];
}

/**
 * Is an excerpt genuinely ABOUT the query, not a passing mention? Either two
 * different query terms appear, or one term recurs.
 */
export function relevanceOk(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lower = text.toLowerCase();
  let distinct = 0;
  let repeated = false;
  for (const t of tokens) {
    let count = 0;
    let i = lower.indexOf(t);
    while (i >= 0 && count < 2) {
      count++;
      i = lower.indexOf(t, i + t.length);
    }
    if (count > 0) distinct++;
    if (count >= 2) repeated = true;
  }
  return distinct >= 2 || repeated;
}
