// AI configuration. `none` is the first-class default: every KIDO feature
// works without a model (docs/CHARTER.md, hard constraints). Keys are the
// user's own, stored locally, sent only to the provider the user chose.

export type ModelConfig =
  | { kind: 'none' }
  | { kind: 'ollama'; baseUrl: string; model: string }
  | { kind: 'openai-compatible'; baseUrl: string; apiKey?: string; model: string }
  | { kind: 'anthropic'; apiKey: string; model: string };

export const NO_MODEL: ModelConfig = { kind: 'none' };

export function modelLabel(config: ModelConfig): string {
  switch (config.kind) {
    case 'none':
      return 'No model — heuristics only';
    case 'ollama':
      return `Ollama · ${config.model}`;
    case 'openai-compatible':
      return `OpenAI-compatible · ${config.model}`;
    case 'anthropic':
      return `Anthropic · ${config.model}`;
  }
}
