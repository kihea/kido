// Wikidata structured relations: the topic's actual ontology — what it has as
// parts, what it uses, what it must not be confused with — from a curated
// knowledge base rather than sentence patterns. Keyless, CORS-open.
//
// Property mapping (kept small and honest):
//   P527 has-part        → comprising 'part-of'   (the part comprises the topic)
//   P2283 uses           → comprising 'requires'
//   P1889 different-from → neighboring (a curated near non-example)

import type { ComprisingRelation } from '../core/types';
import { getJSON } from './net';

const API = 'https://www.wikidata.org/w/api.php';

export interface StructuredRelations {
  comprising: { label: string; relation: ComprisingRelation }[];
  neighboring: { label: string }[];
}

interface Claim {
  mainsnak?: { datavalue?: { value?: { id?: string } } };
}
type Claims = Record<string, Claim[]>;

/** QIDs referenced by the properties we care about. Exported for tests. */
export function relationTargets(claims: Claims): { comprising: { id: string; relation: ComprisingRelation }[]; neighboring: string[] } {
  const ids = (prop: string) =>
    (claims[prop] ?? [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter((id): id is string => typeof id === 'string');
  return {
    comprising: [
      ...ids('P527').map((id) => ({ id, relation: 'part-of' as const })),
      ...ids('P2283').map((id) => ({ id, relation: 'requires' as const })),
    ].slice(0, 8),
    neighboring: ids('P1889').slice(0, 6),
  };
}

export async function wikidataRelations(topic: string): Promise<StructuredRelations | null> {
  const search = (await getJSON(
    `${API}?action=wbsearchentities&search=${encodeURIComponent(topic)}&language=en&format=json&origin=*&limit=1`,
    8000,
  )) as { search?: { id?: string }[] } | null;
  const qid = search?.search?.[0]?.id;
  if (!qid) return null;

  const entity = (await getJSON(
    `${API}?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`,
    8000,
  )) as { entities?: Record<string, { claims?: Claims }> } | null;
  const claims = entity?.entities?.[qid]?.claims;
  if (!claims) return null;

  const targets = relationTargets(claims);
  const allIds = [...targets.comprising.map((c) => c.id), ...targets.neighboring];
  if (allIds.length === 0) return null;

  const labelsRes = (await getJSON(
    `${API}?action=wbgetentities&ids=${allIds.join('|')}&props=labels&languages=en&format=json&origin=*`,
    8000,
  )) as { entities?: Record<string, { labels?: { en?: { value?: string } } }> } | null;
  const label = (id: string) => labelsRes?.entities?.[id]?.labels?.en?.value;

  return {
    comprising: targets.comprising
      .map((c) => ({ label: label(c.id) ?? '', relation: c.relation }))
      .filter((c) => c.label.length > 0),
    neighboring: targets.neighboring
      .map((id) => ({ label: label(id) ?? '' }))
      .filter((n) => n.label.length > 0),
  };
}
