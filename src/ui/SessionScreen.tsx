// The session: one focused card center-stage (two eyes, one target), the
// layer rail and notebook alongside on wide screens, stacked on phones.
// Keyboard: Enter advances; 1–9 picks options.

import { useEffect, useState } from 'react';
import type { SessionApi } from './useSession';
import { CardView } from './CardView';
import { LayerRail } from './LayerRail';
import { Notebook } from './Notebook';
import { SocraticView } from './SocraticView';
import { LAYER_INFO } from '../engine/layers';

export function SessionScreen({
  session,
  hasModel,
  onExit,
}: {
  session: SessionApi;
  hasModel: boolean;
  onExit: () => void;
}) {
  const { phase, tutor } = session;
  const [clipSignal, setClipSignal] = useState({ count: 0, text: '' });
  const [mode, setMode] = useState<'cards' | 'socratic'>('cards');

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
            {tutor.cardsRemaining > 0 && phase.name !== 'done' ? `${tutor.cardsRemaining} cards left` : ''}
          </span>
        </div>
      </header>
      <div className="session-body">
        <aside className="session-rail">
          <span className="pane-title">Layers</span>
          <LayerRail mastery={tutor.mastery} target={tutor.target} now={Date.now()} />
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
