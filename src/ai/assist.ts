// Model duties (docs/ARCHITECTURE.md, AI boundary): refine the study map,
// evaluate Feynman explanations. Models never author "source" content and
// nothing here is load-bearing — every function returns null on any failure
// and the caller's heuristic path takes over.

import type { Outcome, StudyBranch, StudyMap } from '../core/types';
import type { FeynmanItem, BoundaryItem, TransferItem } from '../core/types';
import type { ModelConfig } from './types';
import { complete, extractJson } from './client';

const BRANCH_KINDS = new Set([
  'context',
  'prerequisite',
  'mechanism',
  'component',
  'application',
  'foundation',
  'frontier',
  'adjacent',
]);

/**
 * Ask the model for a better study map from real seed excerpts. The model
 * plans which real material to gather — it writes nothing the learner studies.
 */
export async function modelStudyMap(
  config: ModelConfig,
  topic: string,
  sampleExcerpts: string[],
  maxBranches = 5,
): Promise<StudyMap | null> {
  if (config.kind === 'none') return null;
  const system =
    'You plan research for a layered learning session. Given a topic and verbatim excerpts already gathered, ' +
    'propose neighboring threads worth researching with real sources. Reply with ONLY a JSON array of objects: ' +
    '{"kind": one of context|prerequisite|mechanism|component|application|foundation|frontier|adjacent, ' +
    '"concept": short name, "query": literal search phrase, "why": one sentence on what this unlocks about the topic}.';
  const user = `Topic: ${topic}\n\nExcerpts already gathered:\n${sampleExcerpts
    .slice(0, 6)
    .map((e, i) => `${i + 1}. ${e.slice(0, 300)}`)
    .join('\n')}\n\nPropose up to ${maxBranches} branches.`;
  const reply = await complete(config, system, user, 900);
  if (!reply) return null;
  const parsed = extractJson<unknown[]>(reply);
  if (!Array.isArray(parsed)) return null;
  const branches: StudyBranch[] = [];
  for (const raw of parsed) {
    const b = raw as Partial<StudyBranch>;
    if (
      typeof b.kind === 'string' &&
      BRANCH_KINDS.has(b.kind) &&
      typeof b.concept === 'string' &&
      typeof b.query === 'string' &&
      typeof b.why === 'string'
    ) {
      branches.push({ kind: b.kind, concept: b.concept, query: b.query, why: b.why });
    }
    if (branches.length >= maxBranches) break;
  }
  return branches.length > 0 ? { idea: topic, branches, builtBy: 'model' } : null;
}

export interface ModelJudgment {
  outcome: Outcome;
  note: string;
  by: 'model';
}

/**
 * Evaluate a free-text answer (Feynman / boundary / transfer) against the
 * item's expectations. Output is labeled synthesis in the UI.
 */
export async function modelEvaluate(
  config: ModelConfig,
  item: FeynmanItem | BoundaryItem | TransferItem,
  learnerText: string,
): Promise<ModelJudgment | null> {
  if (config.kind === 'none') return null;
  const expectation =
    item.type === 'feynman'
      ? `A complete explanation touches: ${item.mustMention.join(', ')}. It must include one example and one thing the topic is NOT.`
      : item.type === 'boundary'
        ? `A good answer names the exact property separating the topic from ${item.neighborLabel}.${item.keyContrast ? ` The source's own contrast: ${item.keyContrast}` : ''}`
        : `A good answer runs the scenario concretely: what survives, what breaks, and why.`;
  const system =
    'You are a strict but fair tutor grading one learner response. Judge substance, not style; do not coddle. ' +
    'Reply with ONLY a JSON object: {"outcome": "pass"|"partial"|"miss", "note": one or two sentences of pointed, ' +
    'specific feedback naming what is missing or what was done well}.';
  const user = `Task: ${item.type === 'feynman' ? item.prompt : item.type === 'boundary' ? item.question : `${item.scenario} ${item.question}`}\n\nWhat a strong answer needs: ${expectation}\n\nLearner's answer:\n${learnerText}`;
  const reply = await complete(config, system, user, 300);
  if (!reply) return null;
  const parsed = extractJson<{ outcome?: string; note?: string }>(reply);
  if (!parsed || !parsed.note) return null;
  const outcome = parsed.outcome === 'pass' || parsed.outcome === 'partial' || parsed.outcome === 'miss' ? parsed.outcome : null;
  return outcome ? { outcome, note: parsed.note, by: 'model' } : null;
}
