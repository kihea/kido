// Renders one session card — the single thing the learner is looking at.
// Every card shows its reason; excerpts show full attribution; synthesis is
// visibly labeled as synthesis.

import type { SessionCard } from '../core/types';
import type { Feedback, PracticeResponse } from '../engine';
import { LAYER_INFO } from '../engine/layers';
import { PracticeView } from './PracticeView';
import { LayerRail } from './LayerRail';
import { ConceptMap } from './ConceptMap';

export function CardView({
  card,
  profile,
  feedback,
  judgedBy,
  hasModel,
  onSubmit,
  onAdvance,
  onClip,
  onFinishTopic,
}: {
  card: SessionCard;
  profile: import('../core/types').DimensionalProfile;
  feedback: Feedback | null;
  judgedBy: 'heuristic' | 'model';
  hasModel: boolean;
  onSubmit: (item: import('../core/types').PracticeItem, r: PracticeResponse) => void;
  onAdvance: () => void;
  onClip: (markdown: string) => void;
  onFinishTopic: () => void;
}) {
  switch (card.kind) {
    case 'diagnostic':
      // The self-report diagnostic was replaced by the opening gauge; the
      // card type survives for compatibility but is never emitted.
      return null;

    case 'excerpt': {
      const { passage, doc } = card;
      const cite = `> ${passage.text.replace(/\n/g, ' ')}\n>\n> — [${doc.title}](${passage.anchorUrl ?? doc.url})${doc.author ? `, ${doc.author}` : ''}\n\n`;
      return (
        <article className="card">
          <header className="card-head">
            <span className="layer-chip">{LAYER_INFO[card.layer].name}</span>
            {doc.branch && <span className="branch-chip" title={doc.branch.why}>{doc.branch.kind}</span>}
          </header>
          <blockquote className="excerpt-text">{passage.text}</blockquote>
          <p className="attribution">
            <a href={passage.anchorUrl ?? doc.url} target="_blank" rel="noreferrer">
              {doc.title}
            </a>
            {passage.anchor && passage.anchor !== 'Overview' ? ` · ${passage.anchor}` : ''}
            {doc.author ? ` · ${doc.author}` : ''}
            {doc.date ? ` · ${doc.date}` : ''}
            {doc.license ? ` · ${doc.license}` : ''} · {doc.provider}
          </p>
          {card.threads.length > 0 && (
            <p className="threads">
              ties back through {card.threads[0]!.viaLabels.slice(0, 3).join(', ')}
            </p>
          )}
          <p className="card-reason">{card.reason}</p>
          <div className="card-actions">
            <button type="button" className="btn-secondary" onClick={() => onClip(cite)}>
              Clip to notes
            </button>
            <button type="button" autoFocus onClick={onAdvance}>
              Continue ⏎
            </button>
          </div>
        </article>
      );
    }

    case 'explanation':
      return (
        <article className="card card-synthesis">
          <header className="card-head">
            <span className="layer-chip">{LAYER_INFO[card.layer].name}</span>
            <span className="synth-tag">{card.by === 'model' ? 'model synthesis' : 'KIDO signpost'} — not a source</span>
          </header>
          <p className="explanation-text">{card.text}</p>
          <p className="card-reason">{card.reason}</p>
          <div className="card-actions">
            <button type="button" autoFocus onClick={onAdvance}>
              Continue ⏎
            </button>
          </div>
        </article>
      );

    case 'practice':
      return (
        <article className="card">
          <header className="card-head">
            <span className="layer-chip">{LAYER_INFO[card.item.layer].name}</span>
            <span className="move-chip">{card.move.replace(/-/g, ' ')}</span>
          </header>
          <PracticeView item={card.item} feedback={feedback} judgedBy={judgedBy} hasModel={hasModel} onSubmit={(r) => onSubmit(card.item, r)} />
          {feedback === null && <p className="card-reason">{card.reason}</p>}
          {feedback !== null && (
            <div className="card-actions">
              <button type="button" autoFocus onClick={onAdvance}>
                Continue ⏎
              </button>
            </div>
          )}
        </article>
      );

    case 'summary': {
      const now = Date.now();
      return (
        <article className="card">
          <h2>Where you stand</h2>
          <ConceptMap profile={profile} />
          <LayerRail mastery={card.mastery} now={now} />
          {card.next && (
            <p className="summary-next">
              Next: the <strong>{LAYER_INFO[card.next.layer].name}</strong> layer. {card.next.why}
            </p>
          )}
          <p className="summary-note">
            What you exercised today enters spaced review — it comes back before it fades.
          </p>
          <div className="card-actions">
            <button type="button" autoFocus onClick={onFinishTopic}>
              Done
            </button>
          </div>
        </article>
      );
    }
  }
}

