// Socratic mode: one pointed question at a time, aimed at the weakest layer.
// The learner writes, then sees what a strong answer engages (the lookFor,
// grounded in the profile) and grades themselves against it. No coddling:
// the reveal comes only after they've committed words.

import { useMemo, useState } from 'react';
import type { DimensionalProfile, DomainFamily, EvidenceKind, Layer, MasteryVector, Outcome } from '../core/types';
import { nextSocraticTurn, type SocraticTurn } from '../engine';
import { LAYER_INFO } from '../engine/layers';

const KIND_FOR_LAYER: Record<Layer, EvidenceKind> = {
  0: 'potential',
  1: 'identify',
  2: 'gradient',
  3: 'boundary',
  4: 'instantiate',
  5: 'sequence',
  6: 'feynman',
  7: 'map-repair',
  8: 'transfer',
};

export function SocraticView({
  profile,
  mastery,
  family,
  onEvidence,
  onExit,
}: {
  profile: DimensionalProfile;
  mastery: MasteryVector;
  family: DomainFamily;
  onEvidence: (layer: Layer, kind: EvidenceKind, outcome: Outcome) => void;
  onExit: () => void;
}) {
  const [asked, setAsked] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [committed, setCommitted] = useState(false);

  const turn: SocraticTurn | null = useMemo(
    () => nextSocraticTurn(profile, mastery, family, Date.now(), asked),
    [profile, mastery, family, asked],
  );

  if (!turn) {
    return (
      <article className="card">
        <p className="practice-prompt">The questions are spent for this profile — the rest is yours to ask.</p>
        <div className="card-actions">
          <button type="button" onClick={onExit}>
            Back to cards
          </button>
        </div>
      </article>
    );
  }

  const grade = (outcome: Outcome) => {
    onEvidence(turn.layer, KIND_FOR_LAYER[turn.layer], outcome);
    setAsked((a) => [...a, turn.question]);
    setAnswer('');
    setCommitted(false);
  };

  return (
    <article className="card">
      <header className="card-head">
        <span className="layer-chip">{LAYER_INFO[turn.layer].name}</span>
        <span className="move-chip">socratic</span>
      </header>
      <p className="card-question">{turn.question}</p>
      {!committed ? (
        <>
          <textarea
            autoFocus
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Commit to an answer before you see what it's measured against."
          />
          <div className="card-actions">
            <button type="button" className="btn-skip" onClick={() => grade('skipped')}>
              Skip for now
            </button>
            <button type="button" disabled={answer.trim().length < 10} onClick={() => setCommitted(true)}>
              Commit
            </button>
          </div>
        </>
      ) : (
        <>
          <blockquote className="own-answer">{answer}</blockquote>
          <div className="feedback">
            <p className="feedback-label">What a strong answer engages</p>
            <p className="feedback-note">{turn.lookFor}</p>
          </div>
          <div className="self-grade">
            <span>Read yours against that. Did it get there?</span>
            <button type="button" onClick={() => grade('pass')}>
              Yes — I engaged that
            </button>
            <button type="button" onClick={() => grade('partial')}>
              Partly
            </button>
            <button type="button" onClick={() => grade('miss')}>
              No — I missed it
            </button>
          </div>
        </>
      )}
      <p className="card-reason">One question at a time, aimed at your weakest layer. Your self-grades feed the same mastery ledger as practice.</p>
    </article>
  );
}
