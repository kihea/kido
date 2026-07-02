import { describe, expect, it } from 'vitest';
import { dueItems, newReviewItem, reviewDebt, schedule } from './review';

const T0 = 1_750_000_000_000;
const DAY = 86_400_000;

describe('review scheduling', () => {
  it('a new item comes due tomorrow', () => {
    const item = newReviewItem('topic', 3, 'item1', T0);
    expect(item.due).toBe(T0 + DAY);
    expect(item.reps).toBe(0);
  });

  it('good answers stretch the interval; the ladder grows', () => {
    let item = newReviewItem('t', 6, 'i', T0);
    item = schedule(item, 'good', T0 + DAY);
    const first = item.intervalDays;
    item = schedule(item, 'good', item.due);
    const second = item.intervalDays;
    item = schedule(item, 'good', item.due);
    expect(first).toBe(1);
    expect(second).toBe(3);
    expect(item.intervalDays).toBeGreaterThan(second);
  });

  it('again resets reps, lapses, and brings the item back within the hour', () => {
    let item = newReviewItem('t', 6, 'i', T0);
    item = schedule(item, 'good', T0 + DAY);
    item = schedule(item, 'again', item.due);
    expect(item.reps).toBe(0);
    expect(item.lapses).toBe(1);
    expect(item.due - (T0 + DAY + item.intervalDays * 0)).toBeLessThanOrEqual(T0 + 2 * DAY);
    expect(item.intervalDays).toBeLessThan(0.05);
  });

  it('ease never drops below the floor', () => {
    let item = newReviewItem('t', 2, 'i', T0);
    for (let i = 0; i < 10; i++) item = schedule(item, 'again', T0 + i);
    expect(item.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('intervals cap at a year', () => {
    let item = newReviewItem('t', 8, 'i', T0);
    for (let i = 0; i < 20; i++) item = schedule(item, 'easy', item.due);
    expect(item.intervalDays).toBeLessThanOrEqual(365);
  });

  it('dueItems returns overdue items oldest-first; reviewDebt counts them', () => {
    const a = newReviewItem('t', 1, 'a', T0); // due T0+1d
    const b = { ...newReviewItem('t', 2, 'b', T0), due: T0 + 3 * DAY };
    const now = T0 + 2 * DAY;
    const due = dueItems([b, a], now);
    expect(due.map((i) => i.itemId)).toEqual(['a']);
    expect(reviewDebt([b, a], now).count).toBe(1);
    expect(reviewDebt([b, a], now).oldestDays).toBe(1);
  });
});
