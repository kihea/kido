// One practice item, one focused action (docs/CHARTER.md: one target at a
// time). Each item type gets exactly the interaction it needs — nothing more.

import { useMemo, useState } from 'react';
import type { PracticeItem } from '../core/types';
import type { Feedback, PracticeResponse } from '../engine';
import { hashId } from '../core/ids';
import { seededRng, shuffled } from '../core/runtime';

export function PracticeView({
  item,
  feedback,
  judgedBy,
  hasModel,
  onSubmit,
}: {
  item: PracticeItem;
  feedback: Feedback | null;
  judgedBy: 'heuristic' | 'model';
  hasModel: boolean;
  onSubmit: (response: PracticeResponse) => void;
}) {
  const answered = feedback !== null;
  return (
    <div className="practice">
      {item.type === 'cloze' && <Cloze item={item} answered={answered} onSubmit={onSubmit} />}
      {item.type === 'boundary' && (
        <FreeText
          prompt={item.question}
          placeholder={`Where exactly is the line between ${item.topicLabel} and ${item.neighborLabel}?`}
          answered={answered}
          onSubmit={(text) => onSubmit({ type: 'boundary', text })}
        />
      )}
      {item.type === 'sequence' && <Sequence item={item} answered={answered} onSubmit={onSubmit} />}
      {item.type === 'feynman' && (
        <FreeText
          prompt={item.prompt}
          placeholder="Plain words. One example. One thing it is not."
          rows={7}
          answered={answered}
          onSubmit={(text) => onSubmit({ type: 'feynman', text })}
        />
      )}
      {item.type === 'map-repair' && <MapRepair item={item} answered={answered} onSubmit={onSubmit} />}
      {item.type === 'grouping' && <Grouping item={item} answered={answered} onSubmit={onSubmit} />}
      {item.type === 'flashcard' && <Flashcard item={item} answered={answered} onSubmit={onSubmit} />}
      {item.type === 'transfer' && (
        <Transfer item={item} answered={answered} hasModel={hasModel} onSubmit={onSubmit} />
      )}
      {item.type === 'potential' && (
        <Potential item={item} answered={answered} hasModel={hasModel} onSubmit={onSubmit} />
      )}

      {!answered && (
        <button type="button" className="btn-skip" onClick={() => onSubmit({ type: 'skip' })}>
          Skip for now
        </button>
      )}

      {feedback && (
        <div className={`feedback feedback-${feedback.outcome}`}>
          <p className="feedback-note">
            {feedback.note}
            {judgedBy === 'model' && <span className="synth-tag"> · model judgment</span>}
          </p>
          {feedback.reveal && <pre className="feedback-reveal">{feedback.reveal}</pre>}
        </div>
      )}
    </div>
  );
}

function Cloze({
  item,
  answered,
  onSubmit,
}: {
  item: Extract<PracticeItem, { type: 'cloze' }>;
  answered: boolean;
  onSubmit: (r: PracticeResponse) => void;
}) {
  const [text, setText] = useState('');
  return (
    <form
      className="practice-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit({ type: 'cloze', text });
      }}
    >
      <blockquote className="excerpt-text">{item.prompt}</blockquote>
      <p className="practice-source">— {item.sourceTitle}</p>
      {!answered && (
        <div className="input-row">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="The missing term"
            aria-label="Fill the blank"
          />
          <button type="submit" disabled={!text.trim()}>
            Check
          </button>
        </div>
      )}
    </form>
  );
}

function FreeText({
  prompt,
  placeholder,
  rows = 5,
  answered,
  onSubmit,
}: {
  prompt: string;
  placeholder: string;
  rows?: number;
  answered: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="practice-form">
      <p className="practice-prompt">{prompt}</p>
      {!answered && (
        <>
          <textarea
            autoFocus
            rows={rows}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
          />
          <button type="button" disabled={text.trim().length === 0} onClick={() => onSubmit(text)}>
            Submit
          </button>
        </>
      )}
      {answered && text && <blockquote className="own-answer">{text}</blockquote>}
    </div>
  );
}

function Sequence({
  item,
  answered,
  onSubmit,
}: {
  item: Extract<PracticeItem, { type: 'sequence' }>;
  answered: boolean;
  onSubmit: (r: PracticeResponse) => void;
}) {
  // Deterministic shuffle from the item id — same item always shows the same
  // scramble, so a review replay is a real retest, not a new puzzle.
  const initial = useMemo(() => {
    const seed = parseInt(hashId('s', item.id).split('_')[1] ?? '1', 36);
    const idx = item.steps.map((_, i) => i);
    const mixed = shuffled(idx, seededRng(seed));
    // Ensure it's actually scrambled.
    return mixed.every((v, i) => v === i) ? [...mixed].reverse() : mixed;
  }, [item]);
  const [order, setOrder] = useState<number[]>(initial);

  const move = (pos: number, dir: -1 | 1) => {
    setOrder((o) => {
      const next = [...o];
      const j = pos + dir;
      if (j < 0 || j >= next.length) return o;
      [next[pos], next[j]] = [next[j]!, next[pos]!];
      return next;
    });
  };

  return (
    <div className="practice-form">
      <p className="practice-prompt">{item.instruction}</p>
      <p className="sequence-direction">Arrange top → bottom, earliest first. Use the arrows.</p>
      <ol className="sequence-list">
        {order.map((stepIdx, pos) => (
          <li key={stepIdx} className="sequence-step">
            <span className="sequence-text">{item.steps[stepIdx]}</span>
            {!answered && (
              <span className="sequence-controls">
                <button type="button" aria-label="Move up" disabled={pos === 0} onClick={() => move(pos, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={pos === order.length - 1}
                  onClick={() => move(pos, 1)}
                >
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!answered && (
        <button type="button" onClick={() => onSubmit({ type: 'sequence', order })}>
          This is the order
        </button>
      )}
    </div>
  );
}

function MapRepair({
  item,
  answered,
  onSubmit,
}: {
  item: Extract<PracticeItem, { type: 'map-repair' }>;
  answered: boolean;
  onSubmit: (r: PracticeResponse) => void;
}) {
  // Read as "{from} __ {to}" — phrased so each option is a natural claim, not
  // a stiff relation label ("making → the printing press" reads as "goes into").
  const gloss: Record<string, string> = {
    requires: 'is needed for',
    'part-of': 'goes into',
    'mechanism-of': 'is how it works',
    'example-of': 'is an example of',
  };
  return (
    <div className="practice-form">
      <p className="practice-prompt">
        <strong>{item.fromLabel}</strong> ␣␣?␣␣ <strong>{item.toLabel}</strong> — which relation holds?
      </p>
      {!answered && (
        <div className="option-grid">
          {item.options.map((o, i) => (
            <button key={o} type="button" onClick={() => onSubmit({ type: 'map-repair', choice: o })}>
              <kbd>{i + 1}</kbd> {gloss[o]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Grouping({
  item,
  answered,
  onSubmit,
}: {
  item: Extract<PracticeItem, { type: 'grouping' }>;
  answered: boolean;
  onSubmit: (r: PracticeResponse) => void;
}) {
  // Shuffle deterministically from the item id so a review replay is identical.
  const all = useMemo(() => {
    const seed = parseInt(hashId('g', item.id).split('_')[1] ?? '1', 36);
    return shuffled([...item.groupA.members, ...item.groupB.members], seededRng(seed));
  }, [item]);
  // null = unplaced, 'a' | 'b' = which bin.
  const [bins, setBins] = useState<Record<string, 'a' | 'b' | null>>(() =>
    Object.fromEntries(all.map((m) => [m, null])),
  );

  const cycle = (m: string) =>
    setBins((b) => ({ ...b, [m]: b[m] === null ? 'a' : b[m] === 'a' ? 'b' : null }));

  const allPlaced = all.every((m) => bins[m] !== null);

  return (
    <div className="practice-form">
      <p className="practice-prompt">{item.instruction}</p>
      <div className="grouping-legend">
        <span><span className="bin-dot bin-a" /> {item.groupA.label}</span>
        <span><span className="bin-dot bin-b" /> {item.groupB.label}</span>
        <span className="bin-hint">tap to move</span>
      </div>
      <div className="grouping-grid">
        {all.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip chip-${bins[m] ?? 'none'}`}
            disabled={answered}
            onClick={() => cycle(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {!answered && (
        <button
          type="button"
          disabled={!allPlaced}
          onClick={() =>
            onSubmit({ type: 'grouping', placedInA: all.filter((m) => bins[m] === 'a') })
          }
        >
          Lock it in
        </button>
      )}
    </div>
  );
}

function Flashcard({
  item,
  answered,
  onSubmit,
}: {
  item: Extract<PracticeItem, { type: 'flashcard' }>;
  answered: boolean;
  onSubmit: (r: PracticeResponse) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="practice-form">
      <button
        type="button"
        className={`flashcard${flipped ? ' is-flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Show cue' : 'Reveal answer'}
      >
        {!flipped ? (
          <span className="flashcard-front">{item.front}</span>
        ) : (
          <span className="flashcard-back">
            {item.back}
            <span className="flashcard-source">— {item.sourceTitle}</span>
          </span>
        )}
      </button>
      {!flipped && !answered && <p className="practice-source">Recall it, then flip.</p>}
      {flipped && !answered && (
        <div className="self-grade">
          <span>Did you have it?</span>
          <button type="button" onClick={() => onSubmit({ type: 'flashcard', recalled: 'pass' })}>
            Yes
          </button>
          <button type="button" onClick={() => onSubmit({ type: 'flashcard', recalled: 'partial' })}>
            Roughly
          </button>
          <button type="button" onClick={() => onSubmit({ type: 'flashcard', recalled: 'miss' })}>
            No
          </button>
        </div>
      )}
    </div>
  );
}

function Transfer({
  item,
  answered,
  hasModel,
  onSubmit,
}: {
  item: Extract<PracticeItem, { type: 'transfer' }>;
  answered: boolean;
  hasModel: boolean;
  onSubmit: (r: PracticeResponse) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="practice-form">
      <p className="practice-scenario">{item.scenario}</p>
      <p className="practice-prompt">{item.question}</p>
      {!answered && (
        <>
          <textarea
            autoFocus
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Run it. Name what survives, what breaks, and why."
          />
          {hasModel ? (
            <button type="button" disabled={text.trim().length === 0} onClick={() => onSubmit({ type: 'transfer', text })}>
              Submit for evaluation
            </button>
          ) : (
            <div className="self-grade">
              <span>Then grade yourself — harshly:</span>
              <button type="button" disabled={!text.trim()} onClick={() => onSubmit({ type: 'transfer', text, selfGrade: 'pass' })}>
                Held up
              </button>
              <button type="button" disabled={!text.trim()} onClick={() => onSubmit({ type: 'transfer', text, selfGrade: 'partial' })}>
                Partly
              </button>
              <button type="button" disabled={!text.trim()} onClick={() => onSubmit({ type: 'transfer', text, selfGrade: 'miss' })}>
                It broke
              </button>
            </div>
          )}
        </>
      )}
      {answered && text && <blockquote className="own-answer">{text}</blockquote>}
    </div>
  );
}

function Potential({
  item,
  answered,
  hasModel,
  onSubmit,
}: {
  item: Extract<PracticeItem, { type: 'potential' }>;
  answered: boolean;
  hasModel: boolean;
  onSubmit: (r: PracticeResponse) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="practice-form">
      <p className="practice-prompt">{item.prompt}</p>
      {!answered && (
        <>
          <textarea
            autoFocus
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name one live alternative — and what selecting it away gave up."
          />
          {hasModel ? (
            <button type="button" disabled={!text.trim()} onClick={() => onSubmit({ type: 'potential', text })}>
              Submit
            </button>
          ) : (
            <div className="self-grade">
              <span>Did you name a real alternative?</span>
              <button type="button" disabled={!text.trim()} onClick={() => onSubmit({ type: 'potential', text, selfGrade: 'pass' })}>
                Yes
              </button>
              <button type="button" disabled={!text.trim()} onClick={() => onSubmit({ type: 'potential', text, selfGrade: 'partial' })}>
                Roughly
              </button>
              <button type="button" disabled={!text.trim()} onClick={() => onSubmit({ type: 'potential', text, selfGrade: 'miss' })}>
                No
              </button>
            </div>
          )}
        </>
      )}
      {answered && text && <blockquote className="own-answer">{text}</blockquote>}
    </div>
  );
}
