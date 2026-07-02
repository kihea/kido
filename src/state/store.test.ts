import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryKV, setKV } from './kv';
import {
  DEFAULT_SETTINGS,
  allDueReviews,
  deleteTopic,
  listTopics,
  loadSettings,
  loadTopic,
  saveSettings,
  saveTopic,
  topicId,
  type TopicRecord,
} from './store';
import { initMastery } from '../engine/mastery';
import { newReviewItem } from '../engine/review';

const T0 = 1_750_000_000_000;
const DAY = 86_400_000;

function record(topic: string, updatedAt = T0): TopicRecord {
  return {
    id: topicId(topic),
    topic,
    family: 'general',
    mastery: initMastery(),
    events: [],
    reviews: [],
    pool: [],
    notebook: '',
    updatedAt,
  };
}

beforeEach(() => setKV(memoryKV()));
afterEach(() => setKV(null));

describe('settings', () => {
  it('defaults to no model, dark, mid reach', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips and merges over defaults', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, reach: 0.8 });
    expect((await loadSettings()).reach).toBe(0.8);
    expect((await loadSettings()).model.kind).toBe('none');
  });
});

describe('topics', () => {
  it('round-trips a topic record by normalized id', async () => {
    await saveTopic(record('Gradient Descent'));
    const loaded = await loadTopic('gradient descent');
    expect(loaded?.topic).toBe('Gradient Descent');
  });

  it('lists topics most recently touched first', async () => {
    await saveTopic(record('alpha', T0));
    await saveTopic(record('beta', T0 + 1000));
    const list = await listTopics();
    expect(list.map((r) => r.topic)).toEqual(['beta', 'alpha']);
  });

  it('caps the evidence ledger', async () => {
    const r = record('big');
    r.events = Array.from({ length: 700 }, (_, i) => ({
      at: T0 + i,
      layer: 6 as const,
      kind: 'retrieval' as const,
      outcome: 'pass' as const,
    }));
    await saveTopic(r);
    const loaded = await loadTopic('big');
    expect(loaded?.events.length).toBe(500);
    expect(loaded?.events[499]?.at).toBe(T0 + 699); // newest kept
  });

  it('deletes', async () => {
    await saveTopic(record('gone'));
    await deleteTopic('gone');
    expect(await loadTopic('gone')).toBeNull();
  });
});

describe('allDueReviews', () => {
  it('collects due items across topics, oldest first', async () => {
    const a = record('a');
    a.reviews = [newReviewItem(a.id, 3, 'item1', T0)]; // due T0+1d
    const b = record('b');
    b.reviews = [newReviewItem(b.id, 6, 'item2', T0 - DAY)]; // due T0
    await saveTopic(a);
    await saveTopic(b);
    const due = await allDueReviews(T0 + 2 * DAY);
    expect(due.map((d) => d.item.itemId)).toEqual(['item2', 'item1']);
    const none = await allDueReviews(T0 - 2 * DAY);
    expect(none).toHaveLength(0);
  });
});
