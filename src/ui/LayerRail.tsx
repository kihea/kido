// The seven-position working stack with evidence-based mastery per layer.
// Unknown is rendered as unknown — never as a half-full bar. The 'mirror' view
// folds the full nine-layer stack about embodiment (framework Ch 10), showing
// each polarity as a pair growing outward from the L4 axis — framing only,
// each bar still reads its own layer's evidence.

import type { Layer, MasteryVector } from '../core/types';
import { LAYER_INFO, MIRROR_PAIRS, WORKING_STACK } from '../engine/layers';
import { effectiveMastery, masteryConfidence } from '../engine/mastery';

export function LayerRail({
  mastery,
  target,
  now,
  view = 'stack',
}: {
  mastery: MasteryVector;
  target?: Layer | undefined;
  now: number;
  view?: 'stack' | 'mirror';
}) {
  if (view === 'mirror') {
    return (
      <div className="layer-rail layer-rail-mirror" role="list" aria-label="Layer mastery, folded about embodiment">
        {MIRROR_PAIRS.map((pair) => {
          const isTarget = target !== undefined && (target === pair.lower || target === pair.upper);
          const isAxis = pair.lower === pair.upper;
          return (
            <div
              key={pair.lower}
              role="listitem"
              className={`mirror-row${isAxis ? ' is-axis' : ''}${isTarget ? ' is-target' : ''}`}
              title={`${pair.name} — ${pair.gloss}`}
            >
              {isAxis ? (
                <>
                  <span className="layer-name">{LAYER_INFO[4].name}</span>
                  <MirrorBar layer={4} mastery={mastery} now={now} side="right" />
                  <span className="layer-name layer-name-right mirror-axis-tag">axis</span>
                </>
              ) : (
                <>
                  <span className="layer-name">{LAYER_INFO[pair.lower].name}</span>
                  <MirrorBar layer={pair.lower} mastery={mastery} now={now} side="left" />
                  <span className="mirror-axis" aria-hidden="true">·</span>
                  <MirrorBar layer={pair.upper} mastery={mastery} now={now} side="right" />
                  <span className="layer-name layer-name-right">{LAYER_INFO[pair.upper].name}</span>
                </>
              )}
            </div>
          );
        })}
        <p className="mirror-legend">Folded at embodiment — each row is one polarity; up and down meet.</p>
      </div>
    );
  }
  return (
    <div className="layer-rail" role="list" aria-label="Layer mastery">
      {WORKING_STACK.map((group) => {
        const primary = group.length === 1 ? group[0]! : group[1]!; // L0·L1 → L1, L7·L8 → L8
        const name = group.map((l) => LAYER_INFO[l].name).join(' · ');
        const values = group
          .map((l) => effectiveMastery(mastery[l], now))
          .filter((v): v is number => v !== null);
        const value = values.length > 0 ? Math.max(...values) : null;
        const evidence = group.map((l) => mastery[l].evidence).reduce((s, e) => s + e, 0);
        const confidence = Math.max(...group.map((l) => masteryConfidence(mastery[l])));
        const isTarget = target !== undefined && group.includes(target);
        return (
          <div
            key={primary}
            role="listitem"
            className={`layer-row${isTarget ? ' is-target' : ''}`}
            title={LAYER_INFO[primary].question}
          >
            <span className="layer-name">{name}</span>
            <span className="layer-bar" aria-hidden="true">
              {value === null ? (
                <span className="layer-bar-unknown" />
              ) : (
                <span
                  className="layer-bar-fill"
                  style={{ width: `${Math.round(value * 100)}%`, opacity: 0.45 + confidence * 0.55 }}
                />
              )}
            </span>
            <span className="layer-meta">
              {value === null ? 'untested' : `${Math.round(value * 100)}%${evidence > 0 ? ` · ${evidence}` : ''}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MirrorBar({
  layer,
  mastery,
  now,
  side,
}: {
  layer: Layer;
  mastery: MasteryVector;
  now: number;
  side: 'left' | 'right';
}) {
  const value = effectiveMastery(mastery[layer], now);
  const confidence = masteryConfidence(mastery[layer]);
  return (
    <span
      className={`layer-bar mirror-bar-${side}`}
      role="img"
      aria-label={`${LAYER_INFO[layer].name}: ${value === null ? 'untested' : `${Math.round(value * 100)}%`}`}
      title={LAYER_INFO[layer].question}
    >
      {value === null ? (
        <span className="layer-bar-unknown" />
      ) : (
        <span
          className="layer-bar-fill"
          style={{ width: `${Math.round(value * 100)}%`, opacity: 0.45 + confidence * 0.55 }}
        />
      )}
    </span>
  );
}
