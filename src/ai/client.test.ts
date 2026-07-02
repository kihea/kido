import { describe, expect, it } from 'vitest';
import { extractJson } from './client';
import { complete } from './client';
import { NO_MODEL } from './types';

describe('extractJson', () => {
  it('parses bare JSON', () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON with surrounding prose', () => {
    const reply = 'Sure! Here is the plan:\n```json\n[{"kind":"mechanism"}]\n```\nHope that helps.';
    expect(extractJson<unknown[]>(reply)).toEqual([{ kind: 'mechanism' }]);
  });

  it('stops at the matching bracket despite trailing prose', () => {
    expect(extractJson<{ a: string }>('{"a":"b"} and some trailing words {')).toEqual({ a: 'b' });
  });

  it('returns null for junk', () => {
    expect(extractJson('no json here at all')).toBeNull();
  });
});

describe('complete with no model', () => {
  it('returns null immediately — the heuristic path is the default', async () => {
    expect(await complete(NO_MODEL, 'sys', 'user')).toBeNull();
  });
});
