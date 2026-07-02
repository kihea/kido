// Wiktionary provider: definitions, used ONLY for recurring terms no corpus
// passage defines — the corpus grounds its own vocabulary first.

import type { Passage, SourceDoc } from '../core/types';
import { freshId, getJSON, stripHtml } from './net';

interface WiktSense {
  definition?: string;
}
interface WiktEntry {
  partOfSpeech?: string;
  definitions?: WiktSense[];
}

export async function lookupDefinition(
  term: string,
): Promise<{ doc: SourceDoc; passage: Passage } | null> {
  const data = (await getJSON(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term.replace(/ /g, '_'))}`,
    7000,
  )) as Record<string, WiktEntry[]> | null;
  const entries = data?.['en'] ?? [];
  for (const entry of entries) {
    for (const sense of entry.definitions ?? []) {
      const def = sense.definition ? stripHtml(sense.definition) : '';
      if (def.length < 30) continue;
      const url = `https://en.wiktionary.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}`;
      const doc: SourceDoc = {
        id: freshId('doc'),
        provider: 'Wiktionary',
        sourceType: 'reference',
        title: term,
        url,
        license: 'CC BY-SA 4.0',
      };
      return {
        doc,
        passage: {
          id: freshId('p'),
          docId: doc.id,
          text: `${term}${entry.partOfSpeech ? ` (${entry.partOfSpeech})` : ''}: ${def}`,
          anchor: 'Definition',
          anchorUrl: url,
          index: 0,
        },
      };
    }
  }
  return null;
}
