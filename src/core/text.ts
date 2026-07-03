// Text utilities shared by corpus extraction, annotation, and exertion.
// Deliberately simple and inspectable — no NLP dependency.

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could did do does for from had has have he her him his how i if in into is it its ' +
    'may might more most much must no nor not of on or our shall she should so some such than that the their them then there ' +
    'these they this those to too was we were what when where which while who whom why will with would you your also very just ' +
    'each other both any all only own same over under again further once here out up down about between through during before ' +
    'after above below off because until being having doing many few such'
  ).split(/\s+/),
);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

export function normalize(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Light stemming for matching only (never for display): plural/possessive. */
export function stemLight(word: string): string {
  let w = word;
  if (w.endsWith("'s")) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((w) => w.length > 1);
}

/** Content words: tokens minus stopwords, light-stemmed. */
export function contentWords(text: string): string[] {
  return tokenize(text)
    .filter((w) => !isStopword(w))
    .map(stemLight);
}

const ABBREV = /\b(e\.g|i\.e|etc|vs|cf|Dr|Mr|Mrs|Ms|St|no|al|Fig|fig|ca|approx)\.$/;

/** Split prose into sentences. Handles common abbreviations; good enough for excerpts. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  for (const part of parts) {
    buf = buf ? `${buf} ${part}` : part;
    if (ABBREV.test(buf.trimEnd())) continue; // false split — keep accumulating
    const t = buf.trim();
    if (t.length > 0) out.push(t);
    buf = '';
  }
  const rest = buf.trim();
  if (rest.length > 0) out.push(rest);
  return out;
}

/** Word count, cheap. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Title-case-insensitive equality of surface forms. */
export function sameTerm(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

/**
 * Escape a string for literal use inside a RegExp.
 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Truncate at a word boundary with an ellipsis — never mid-word. */
export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > n * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}
