// Spaced review (docs/ENGINE.md §7): SM-2-family scheduling over
// (topic, layer, item). Deterministic — the clock is an argument.
// A passed lesson is never "done"; it has a next due date.

import type { Layer, ReviewGrade, ReviewItem } from '../core/types';
import { hashId } from '../core/ids';

const DAY = 86_400_000;
const MIN_EASE = 1.3;
const START_EASE = 2.3;

export function newReviewItem(topicId: string, layer: Layer, itemId: string, now: number): ReviewItem {
  return {
    id: hashId('rev', `${topicId}|${layer}|${itemId}`),
    topicId,
    layer,
    itemId,
    due: now + DAY, // first return visit: tomorrow
    intervalDays: 1,
    ease: START_EASE,
    reps: 0,
    lapses: 0,
  };
}

/** Apply a grade; returns the next state of the item. */
export function schedule(item: ReviewItem, grade: ReviewGrade, now: number): ReviewItem {
  let { intervalDays, ease, reps, lapses } = item;
  switch (grade) {
    case 'again':
      lapses += 1;
      reps = 0;
      ease = Math.max(MIN_EASE, ease - 0.2);
      intervalDays = 1 / 48; // back in ~30 minutes
      break;
    case 'hard':
      reps += 1;
      ease = Math.max(MIN_EASE, ease - 0.15);
      intervalDays = Math.max(1 / 48, intervalDays * 1.2);
      break;
    case 'good':
      reps += 1;
      intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : intervalDays * ease;
      break;
    case 'easy':
      reps += 1;
      ease += 0.15;
      intervalDays = (reps === 1 ? 2 : reps === 2 ? 5 : intervalDays * ease) * 1.3;
      break;
  }
  intervalDays = Math.min(intervalDays, 365);
  return { ...item, intervalDays, ease, reps, lapses, due: now + intervalDays * DAY };
}

export function dueItems(items: ReviewItem[], now: number): ReviewItem[] {
  return items.filter((i) => i.due <= now).sort((a, b) => a.due - b.due);
}

/** Review debt: how many items are overdue, and the oldest overdue age in days. */
export function reviewDebt(items: ReviewItem[], now: number): { count: number; oldestDays: number } {
  const due = dueItems(items, now);
  const oldest = due[0];
  return {
    count: due.length,
    oldestDays: oldest ? Math.floor((now - oldest.due) / DAY) : 0,
  };
}
