// Spaced review: due items replayed one at a time, graded, rescheduled.
// A skip leaves the item due — honest, no penalty, no credit.

import { useCallback, useEffect, useState } from 'react';
import type { PracticeItem, ReviewGrade, ReviewItem } from '../core/types';
import { applyEvidence, gradeResponse, schedule, type PracticeResponse } from '../engine';
import { allDueReviews, saveTopic, type TopicRecord } from '../state/store';
import { PracticeView } from './PracticeView';
import { LAYER_INFO } from '../engine/layers';
import type { Feedback } from '../engine';

interface DueEntry {
  record: TopicRecord;
  item: ReviewItem;
  practice: PracticeItem;
}

function outcomeToGrade(outcome: Feedback['outcome']): ReviewGrade | null {
  switch (outcome) {
    case 'pass':
      return 'good';
    case 'partial':
      return 'hard';
    case 'miss':
      return 'again';
    case 'skipped':
      return null;
  }
}

export function ReviewScreen({ onExit }: { onExit: () => void }) {
  const [queue, setQueue] = useState<DueEntry[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    void allDueReviews(Date.now()).then((due) => {
      const entries: DueEntry[] = [];
      for (const { record, item } of due) {
        const practice = record.pool.find((p) => p.id === item.itemId);
        if (practice) entries.push({ record, item, practice });
      }
      setQueue(entries);
    });
  }, []);

  const current = queue?.[0] ?? null;

  const submit = useCallback(
    (response: PracticeResponse) => {
      if (!current) return;
      const fb = gradeResponse(current.practice, response);
      setFeedback(fb);
      const now = Date.now();
      const grade = outcomeToGrade(fb.outcome);
      if (grade) {
        const updatedItem = schedule(current.item, grade, now);
        const record = current.record;
        const next: TopicRecord = {
          ...record,
          reviews: record.reviews.map((r) => (r.id === updatedItem.id ? updatedItem : r)),
          mastery: applyEvidence(record.mastery, {
            at: now,
            layer: current.practice.layer,
            kind: current.practice.kind,
            outcome: fb.outcome,
            itemId: current.practice.id,
          }),
          updatedAt: now,
        };
        void saveTopic(next);
      }
    },
    [current],
  );

  const advance = useCallback(() => {
    setFeedback(null);
    setQueue((q) => (q ? q.slice(1) : q));
  }, []);

  if (queue === null) return <div className="screen review"><p>Loading review queue…</p></div>;

  if (!current) {
    return (
      <div className="screen review">
        <h2>Nothing due</h2>
        <p>The schedule is ahead of your forgetting curve. Come back when something is due.</p>
        <button type="button" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="screen review">
      <header className="session-head">
        <button type="button" className="btn-quiet" onClick={onExit}>
          ← Review
        </button>
        <span className="session-meta">
          {queue.length} due · {current.record.topic} · {LAYER_INFO[current.practice.layer].name}
        </span>
      </header>
      <main className="session-main">
        <article className="card">
          <PracticeView
            item={current.practice}
            feedback={feedback}
            judgedBy="heuristic"
            hasModel={false}
            onSubmit={submit}
          />
          {feedback !== null && (
            <div className="card-actions">
              <button type="button" autoFocus onClick={advance}>
                Next ⏎
              </button>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
