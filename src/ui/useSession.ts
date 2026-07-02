// Session orchestration (app glue — the one place research, engine, ai and
// state meet; see docs/ARCHITECTURE.md). The engine stays pure; this hook
// feeds it and persists what comes back.

import { useCallback, useRef, useState } from 'react';
import type {
  Layer,
  PracticeItem,
  ProviderProgress,
  SessionCard,
  SummaryCard,
} from '../core/types';
import {
  analyzeCorpus,
  annotatePassages,
  applyEvidence,
  buildProfile,
  inferDomainFamily,
  initMastery,
  newReviewItem,
  reviewSeeds,
  startSession,
  gradeResponse,
  next as nextCard,
  type Feedback,
  type PracticeResponse,
  type TutorState,
} from '../engine';
import { heuristicStudyMap, researchTopic, withStudyMap } from '../research';
import { modelEvaluate, modelStudyMap } from '../ai';
import type { ModelConfig } from '../ai';
import { loadTopic, saveTopic, topicId, type Settings, type TopicRecord } from '../state/store';

export type SessionPhase =
  | { name: 'idle' }
  | { name: 'researching'; topic: string; progress: ProviderProgress[] }
  | { name: 'empty'; topic: string } // research found nothing usable
  | { name: 'active'; card: SessionCard; feedback: Feedback | null; judgedBy: 'heuristic' | 'model' }
  | { name: 'done'; summary: SummaryCard };

export interface SessionApi {
  phase: SessionPhase;
  tutor: TutorState | null;
  begin: (topic: string) => Promise<void>;
  submit: (item: PracticeItem, response: PracticeResponse) => Promise<void>;
  advance: () => void;
  reset: () => void;
  /** Notebook: the learner's visible averaging operation. Autosaved. */
  notebook: () => string;
  updateNotebook: (text: string) => void;
}

const MIN_PASSAGES = 6;

export function useSession(settings: Settings): SessionApi {
  const [phase, setPhase] = useState<SessionPhase>({ name: 'idle' });
  const [tutor, setTutor] = useState<TutorState | null>(null);
  const recordRef = useRef<TopicRecord | null>(null);
  /** Events already on the record when this session started (avoid re-append). */
  const priorEventsRef = useRef(0);

  const persist = useCallback(async (state: TutorState) => {
    const rec = recordRef.current;
    if (!rec) return;
    const now = Date.now();
    const seeds = reviewSeeds(state, rec.id, now, newReviewItem);
    const known = new Set(rec.reviews.map((r) => r.id));
    const updated: TopicRecord = {
      ...rec,
      mastery: state.mastery,
      events: [...rec.events.slice(0, priorEventsRef.current), ...state.events],
      reviews: [...rec.reviews, ...seeds.filter((s) => !known.has(s.id))],
      pool: state.pool,
      updatedAt: now,
    };
    recordRef.current = updated;
    await saveTopic(updated);
  }, []);

  const begin = useCallback(
    async (topic: string) => {
      const trimmed = topic.trim();
      if (!trimmed) return;
      setPhase({ name: 'researching', topic: trimmed, progress: [] });

      const research = await researchTopic(trimmed, {
        reach: settings.reach,
        ...(settings.politeEmail ? { politeEmail: settings.politeEmail } : {}),
        onProgress: (progress) =>
          setPhase((p) => (p.name === 'researching' ? { ...p, progress } : p)),
      });

      // A configured model may propose a sharper study map from the seed
      // excerpts; re-research only its extra branches would add latency, so
      // v1.0 applies the model map only when the heuristic found little.
      let studyMap = research.studyMap;
      if (settings.model.kind !== 'none' && research.passages.length < MIN_PASSAGES * 2) {
        const better = await modelStudyMap(
          settings.model as ModelConfig,
          trimmed,
          research.passages.map((p) => p.text),
        );
        if (better) studyMap = better;
      }

      if (research.passages.length < MIN_PASSAGES) {
        setPhase({ name: 'empty', topic: trimmed });
        return;
      }

      const passages = annotatePassages(research.passages);
      const corpus = withStudyMap(analyzeCorpus(trimmed, research.docs, passages), studyMap);
      const profile = buildProfile(corpus);
      const sample = passages
        .slice(0, 5)
        .map((p) => p.text)
        .join('\n');
      const family = inferDomainFamily(trimmed, sample);

      const existing = await loadTopic(trimmed);
      const record: TopicRecord = existing ?? {
        id: topicId(trimmed),
        topic: trimmed,
        family,
        mastery: initMastery(),
        events: [],
        reviews: [],
        pool: [],
        notebook: '',
        updatedAt: Date.now(),
      };
      recordRef.current = record;
      priorEventsRef.current = record.events.length;

      const { state, card } = startSession(corpus, profile, {
        family: record.family,
        mastery: record.mastery,
        now: Date.now(),
      });
      setTutor(state);
      setPhase(
        card.kind === 'summary'
          ? { name: 'done', summary: card }
          : { name: 'active', card, feedback: null, judgedBy: 'heuristic' },
      );
    },
    [settings],
  );

  const submit = useCallback(
    async (item: PracticeItem, response: PracticeResponse) => {
      const t = tutor;
      if (!t) return;
      const now = Date.now();

      // Free-text items: a configured model gives sharper judgment; the
      // heuristic grade is the floor and the fallback.
      let feedback = gradeResponse(item, response);
      let judgedBy: 'heuristic' | 'model' = 'heuristic';
      const freeText =
        (item.type === 'feynman' || item.type === 'boundary' || item.type === 'transfer') &&
        (response.type === 'feynman' || response.type === 'boundary' || response.type === 'transfer');
      if (freeText && settings.model.kind !== 'none') {
        const text = 'text' in response ? response.text : '';
        if (text.trim().length > 0) {
          const judged = await modelEvaluate(settings.model as ModelConfig, item, text);
          if (judged) {
            feedback = { outcome: judged.outcome, note: judged.note };
            judgedBy = 'model';
          }
        }
      }

      const event = {
        at: now,
        layer: item.layer,
        kind: item.kind,
        outcome: feedback.outcome,
        itemId: item.id,
      };
      const mastery = feedback.outcome === 'skipped' ? t.mastery : applyEvidence(t.mastery, event);
      const updated: TutorState = { ...t, mastery, events: [...t.events, event] };
      setTutor(updated);
      setPhase((p) => (p.name === 'active' ? { ...p, feedback, judgedBy } : p));
      void persist(updated);
    },
    [tutor, settings, persist],
  );

  const advance = useCallback(() => {
    setTutor((t) => {
      if (!t) return t;
      const { state, card } = nextCard(t, Date.now());
      if (card.kind === 'summary') {
        setPhase({ name: 'done', summary: card });
        void persist(state);
      } else {
        setPhase({ name: 'active', card, feedback: null, judgedBy: 'heuristic' });
      }
      return state;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setTutor(null);
    recordRef.current = null;
    setPhase({ name: 'idle' });
  }, []);

  const notebook = useCallback(() => recordRef.current?.notebook ?? '', []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateNotebook = useCallback((text: string) => {
    const rec = recordRef.current;
    if (!rec) return;
    recordRef.current = { ...rec, notebook: text, updatedAt: Date.now() };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const current = recordRef.current;
      if (current) void saveTopic(current);
    }, 600);
  }, []);

  return { phase, tutor, begin, submit, advance, reset, notebook, updateNotebook };
}
