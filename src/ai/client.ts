// One completion function over all providers. Plain fetch, no SDKs — the
// request shape is small and stable, and this keeps keys out of dependencies.
// Best-effort: any failure returns null and the caller falls back to heuristics.

import type { ModelConfig } from './types';

const TIMEOUT_MS = 30_000;

export async function complete(
  config: ModelConfig,
  system: string,
  user: string,
  maxTokens = 800,
): Promise<string | null> {
  if (config.kind === 'none') return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    switch (config.kind) {
      case 'ollama': {
        const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: config.model,
            stream: false,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            options: { num_predict: maxTokens },
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { message?: { content?: string } };
        return data.message?.content ?? null;
      }
      case 'openai-compatible': {
        const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return data.choices?.[0]?.message?.content ?? null;
      }
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            // Required for direct browser calls; the key is the user's own,
            // entered locally, and never touches any server of ours.
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { content?: { type: string; text?: string }[] };
        return data.content?.find((c) => c.type === 'text')?.text ?? null;
      }
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the first JSON object/array out of a model reply (fenced or bare). */
export function extractJson<T>(text: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text;
  const start = fenced.search(/[[{]/);
  if (start === -1) return null;
  // Walk to the matching close bracket so trailing prose doesn't break parsing.
  const open = fenced[start]!;
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = start; i < fenced.length; i++) {
    const ch = fenced[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(fenced.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
