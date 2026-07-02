// Settings: model connection (none is the default and a respectable choice),
// branch-out reach, theme. Honest copy about the AI-off tradeoff.

import { useState } from 'react';
import type { Settings } from '../state/store';
import type { ModelConfig } from '../ai';

export function SettingsScreen({
  settings,
  storageBackend,
  onSave,
  onExit,
}: {
  settings: Settings;
  storageBackend: string;
  onSave: (s: Settings) => void;
  onExit: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  const model = draft.model;

  const setModel = (m: ModelConfig) => setDraft((d) => ({ ...d, model: m }));

  return (
    <div className="screen settings">
      <header className="session-head">
        <button type="button" className="btn-quiet" onClick={onExit}>
          ← Settings
        </button>
      </header>
      <main className="settings-main">
        <section className="settings-section">
          <h2>Model</h2>
          <p className="settings-copy">
            KIDO works fully without a model — research, layer profiles, practice, and review are all
            heuristic and local. Plugging one in sharpens study-map planning and free-text grading; opting
            out trades that speed and judgment quality, nothing else. Keys stay on this device and are sent
            only to the provider you choose.
          </p>
          <div className="option-list">
            {(
              [
                ['none', 'No model (default)'],
                ['ollama', 'Ollama — local weights'],
                ['openai-compatible', 'OpenAI-compatible server / key'],
                ['anthropic', 'Anthropic API key'],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={`option${model.kind === kind ? ' is-selected' : ''}`}
                onClick={() =>
                  setModel(
                    kind === 'none'
                      ? { kind: 'none' }
                      : kind === 'ollama'
                        ? { kind: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3.2' }
                        : kind === 'openai-compatible'
                          ? { kind: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: '' }
                          : { kind: 'anthropic', apiKey: '', model: 'claude-sonnet-5' },
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>

          {model.kind === 'ollama' && (
            <div className="settings-fields">
              <label>
                Server <input value={model.baseUrl} onChange={(e) => setModel({ ...model, baseUrl: e.target.value })} />
              </label>
              <label>
                Model <input value={model.model} onChange={(e) => setModel({ ...model, model: e.target.value })} />
              </label>
            </div>
          )}
          {model.kind === 'openai-compatible' && (
            <div className="settings-fields">
              <label>
                Base URL <input value={model.baseUrl} onChange={(e) => setModel({ ...model, baseUrl: e.target.value })} />
              </label>
              <label>
                Model <input value={model.model} onChange={(e) => setModel({ ...model, model: e.target.value })} />
              </label>
              <label>
                API key (optional)
                <input
                  type="password"
                  value={model.apiKey ?? ''}
                  onChange={(e) => {
                    const { apiKey: _drop, ...rest } = model;
                    setModel(e.target.value ? { ...rest, apiKey: e.target.value } : rest);
                  }}
                />
              </label>
            </div>
          )}
          {model.kind === 'anthropic' && (
            <div className="settings-fields">
              <label>
                API key
                <input type="password" value={model.apiKey} onChange={(e) => setModel({ ...model, apiKey: e.target.value })} />
              </label>
              <label>
                Model <input value={model.model} onChange={(e) => setModel({ ...model, model: e.target.value })} />
              </label>
            </div>
          )}
        </section>

        <section className="settings-section">
          <h2>Branch-out reach</h2>
          <p className="settings-copy">
            How far research wanders from the topic itself: low stays on what the idea presupposes and
            contains; high adds history, applications, and the contested edge.
          </p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.reach}
            onChange={(e) => setDraft((d) => ({ ...d, reach: Number(e.target.value) }))}
            aria-label="Branch-out reach"
          />
          <span className="settings-value">{Math.round(draft.reach * 100)}%</span>
        </section>

        <section className="settings-section">
          <h2>Appearance</h2>
          <div className="option-list">
            <button
              type="button"
              className={`option${draft.theme === 'dark' ? ' is-selected' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, theme: 'dark' }))}
            >
              Dark
            </button>
            <button
              type="button"
              className={`option${draft.theme === 'light' ? ' is-selected' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, theme: 'light' }))}
            >
              Light
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h2>Storage</h2>
          <p className="settings-copy">
            Everything lives on this device ({storageBackend === 'idb' ? 'IndexedDB' : storageBackend === 'local' ? 'localStorage' : 'memory only — saving is off in this browser'}). No account, no server, no telemetry.
          </p>
        </section>

        <div className="card-actions">
          <button type="button" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </main>
    </div>
  );
}
