// Learner state records. One record per topic: layer mastery, evidence,
// review queue, notebook. Plus one settings record. All on-device.

import type {
  DirectionVector,
  DomainFamily,
  EvidenceEvent,
  MasteryVector,
  PracticeItem,
  ReviewItem,
} from '../core/types';
import type { ModelConfig } from '../ai/types';
import { NO_MODEL } from '../ai/types';
import { normalize } from '../core/text';
import { getKV } from './kv';

export interface TopicRecord {
  id: string; // normalized topic
  topic: string; // display form
  family: DomainFamily;
  mastery: MasteryVector;
  /** Up/down competence (framework Ch 13–14); optional for records saved before it existed. */
  direction?: DirectionVector;
  /** Evidence ledger, newest last, capped. */
  events: EvidenceEvent[];
  reviews: ReviewItem[];
  /** Practice items generated for this topic — reviews replay them by id. */
  pool: PracticeItem[];
  notebook: string;
  updatedAt: number;
}

export interface Settings {
  model: ModelConfig;
  /** Branch-out reach 0..1. */
  reach: number;
  theme: 'dark' | 'light';
  /** Optional: joins OpenAlex's "polite pool" for faster, more reliable results. */
  politeEmail?: string;
  /** Opt-in: append the L0 possibility probe to the opening gauge (advanced). */
  deepGauge?: boolean;
}

export const DEFAULT_SETTINGS: Settings = { model: NO_MODEL, reach: 0.5, theme: 'dark' };

const EVENT_CAP = 500;

export function topicId(topic: string): string {
  return normalize(topic);
}

export async function loadSettings(): Promise<Settings> {
  const kv = await getKV();
  const raw = await kv.get<Partial<Settings>>('settings', 'app');
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<boolean> {
  const kv = await getKV();
  return kv.put('settings', 'app', settings);
}

export async function loadTopic(topic: string): Promise<TopicRecord | null> {
  const kv = await getKV();
  return kv.get<TopicRecord>('topics', topicId(topic));
}

export async function saveTopic(record: TopicRecord): Promise<boolean> {
  const kv = await getKV();
  const capped: TopicRecord = {
    ...record,
    events: record.events.slice(-EVENT_CAP),
  };
  return kv.put('topics', record.id, capped);
}

export async function listTopics(): Promise<TopicRecord[]> {
  const kv = await getKV();
  const keys = await kv.keys('topics');
  const records = await Promise.all(keys.map((k) => kv.get<TopicRecord>('topics', k)));
  return records
    .filter((r): r is TopicRecord => r !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteTopic(topic: string): Promise<boolean> {
  const kv = await getKV();
  return kv.del('topics', topicId(topic));
}

/** All review items across topics that are due at `now`, oldest first. */
export async function allDueReviews(now: number): Promise<{ record: TopicRecord; item: ReviewItem }[]> {
  const topics = await listTopics();
  const due: { record: TopicRecord; item: ReviewItem }[] = [];
  for (const record of topics) {
    for (const item of record.reviews) {
      if (item.due <= now) due.push({ record, item });
    }
  }
  return due.sort((a, b) => a.item.due - b.item.due);
}
