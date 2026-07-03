// The session: one focused card center-stage (two eyes, one target), the
// layer rail and notebook alongside on wide screens, stacked on phones.
// Keyboard: Enter advances; 1–9 picks options.

import { useEffect, useRef, useState } from 'react';
import type { SessionApi } from './useSession';
import type { Settings } from '../state/store';
import type { ModelConfig } from '../ai';
import { modelLabel } from '../ai';
import { CardView } from './CardView';
import { LayerRail } from './LayerRail';
import { Notebook } from './Notebook';
import { SocraticView } from './SocraticView';
import { LAYER_INFO } from '../engine/layers';

export function SessionScreen({
  session,
  hasModel,
  settings,
  onSettings,
  onExit,
}: {
  session: SessionApi;
  hasModel: boolean;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onExit: () => void;
}) {
  const { phase, tutor } = session;
  const [clipSignal, setClipSignal] = useState({ count: 0, text: '' });
  const [mode, setMode] = useState<'cards' | 'socratic'>('cards');
  const [railView, setRailView] = useState<'stack' | 'mirror'>('stack');
  const [showMap, setShowMap] = useState(false);
  const [showTune, setShowTune] = useState(false);
  const priorModel = useRef<ModelConfig | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (phase.name !== 'active') return;
      if (e.key === 'Enter') {
        const { card, feedback } = phase;
        if (card.kind === 'excerpt' || card.kind === 'explanation' || (card.kind === 'practice' && feedback !== null)) {
          e.preventDefault();
          session.advance();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, session]);

  if (phase.name === 'researching') {
    return (
      <div className="screen screen-research">
        <h2 className="research-title">Researching {phase.topic}</h2>
        <ul className="provider-list">
          {phase.progress.map((p) => (
            <li key={p.name} className={`provider provider-${p.status}`}>
              <span>{p.name}</span>
              <span>{p.status === 'pending' ? '…' : p.status === 'ok' ? `${p.passages} excerpts` : 'no answer'}</span>
            </li>
          ))}
        </ul>
        <p className="research-note">Real sources only. Whatever answers becomes your corpus.</p>
      </div>
    );
  }

  if (phase.name === 'empty') {
    return (
      <div className="screen screen-research">
        <h2>Not enough source material for “{phase.topic}”</h2>
        <p>
          The providers returned too little to teach from honestly. Try a more specific phrasing, or the
          established name of the idea.
        </p>
        <button type="button" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  if (phase.name === 'idle' || tutor === null) return null;

  const card = phase.name === 'done' ? phase.summary : phase.card;
  const feedback = phase.name === 'active' ? phase.feedback : null;
  const judgedBy = phase.name === 'active' ? phase.judgedBy : 'heuristic';

  return (
    <div className="screen session">
      <header className="session-head">
        <button type="button" className="btn-quiet" onClick={onExit} aria-label="Leave session">
          ← {tutor.profile.topic}
        </button>
        <div className="session-controls">
          <button type="button" className="btn-quiet" onClick={() => setShowTune((s) => !s)}>
            Tune
          </button>
          {tutor.corpus.studyMap && (
            <button type="button" className="btn-quiet" onClick={() => setShowMap((s) => !s)}>
              Study map
            </button>
          )}
          {phase.name !== 'done' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMode((m) => (m === 'cards' ? 'socratic' : 'cards'))}
            >
              {mode === 'cards' ? 'Talk it through' : 'Back to cards'}
            </button>
          )}
          <span className="session-meta">
            {mode === 'cards' && tutor.cardsRemaining > 0 && phase.name !== 'done'
              ? `${tutor.cardsRemaining} cards left`
              : ''}
          </span>
        </div>
      </header>
      {showTune && (
        <section className="study-map tune-panel" aria-label="Session tuning">
          <label className="tune-row">
            Branch-out reach
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.reach}
              onChange={(e) => onSettings({ ...settings, reach: Number(e.target.value) })}
            />
            <span className="settings-value">{Math.round(settings.reach * 100)}%</span>
          </label>
          <label className="tune-row">
            <input
              type="checkbox"
              checked={settings.deepGauge ?? false}
              onChange={(e) => onSettings({ ...settings, deepGauge: e.target.checked })}
            />
            Deep gauge (adds the potential probe)
          </label>
          <div className="tune-row">
            <span>{modelLabel(settings.model)}</span>
            {settings.model.kind !== 'none' || priorModel.current ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (settings.model.kind !== 'none') {
                    priorModel.current = settings.model;
                    onSettings({ ...settings, model: { kind: 'none' } });
                  } else if (priorModel.current) {
                    onSettings({ ...settings, model: priorModel.current });
                    priorModel.current = null;
                  }
                }}
              >
                {settings.model.kind !== 'none' ? 'Turn model off' : 'Turn model on'}
              </button>
            ) : null}
          </div>
          <p className="study-map-why">Reach and gauge apply to the next research; the model applies immediately.</p>
        </section>
      )}
      {showMap && tutor.corpus.studyMap && (
        <section className="study-map" aria-label="Study map">
          <p className="study-map-idea">
            {tutor.corpus.studyMap.idea}
            <span className="synth-tag"> · {tutor.corpus.studyMap.builtBy === 'model' ? 'model-planned' : 'heuristic'}</span>
          </p>
          <ul>
            {tutor.corpus.studyMap.branches.map((b) => (
              <li key={b.query}>
                <span className="branch-chip">{b.kind}</span> <strong>{b.concept}</strong>
                <span className="study-map-why"> — {b.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="session-body">
        <aside className="session-rail">
          <div className="rail-head">
            <span className="pane-title">Layers</span>
            <button
              type="button"
              className="btn-quiet rail-fold"
              title="The stack is symmetric about embodiment: L0↔L8, L1↔L7, L2↔L6, L3↔L5. Fold it to see the pairs."
              onClick={() => setRailView((v) => (v === 'stack' ? 'mirror' : 'stack'))}
            >
              {railView === 'stack' ? 'fold' : 'unfold'}
            </button>
          </div>
          <LayerRail
            mastery={tutor.mastery}
            target={mode === 'cards' ? tutor.target : undefined}
            now={Date.now()}
            view={railView}
          />
          {tutor.profile.gaps.length > 0 && (
            <p className="rail-gaps">
              No source evidence yet for: {tutor.profile.gaps.map((g) => LAYER_INFO[g].name).join(', ')} — KIDO
              won't fake those layers.
            </p>
          )}
        </aside>
        <main className="session-main">
          {mode === 'socratic' && phase.name !== 'done' ? (
            <SocraticView
              profile={tutor.profile}
              mastery={tutor.mastery}
              direction={tutor.direction}
              family={tutor.family}
              onEvidence={session.recordSocratic}
              onExit={() => setMode('cards')}
            />
          ) : (
          <CardView
            card={card}
            profile={tutor.profile}
            feedback={feedback}
            judgedBy={judgedBy}
            hasModel={hasModel}
            onSubmit={(item, r) => void session.submit(item, r)}
            onAdvance={session.advance}
            onClip={(text) => setClipSignal((s) => ({ count: s.count + 1, text }))}
            onFinishTopic={onExit}
          />
          )}
        </main>
        <aside className="session-notes">
          <Notebook initial={session.notebook()} clipSignal={clipSignal} onChange={session.updateNotebook} />
        </aside>
      </div>
    </div>
  );
}
