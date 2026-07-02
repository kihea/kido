// The seven-position working stack with evidence-based mastery per layer.
// Unknown is rendered as unknown — never as a half-full bar.

import type { Layer, MasteryVector } from '../core/types';
import { LAYER_INFO, WORKING_STACK } from '../engine/layers';
import { effectiveMastery, masteryConfidence } from '../engine/mastery';

export function LayerRail({
  mastery,
  target,
  now,
}: {
  mastery: MasteryVector;
  target?: Layer | undefined;
  now: number;
}) {
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
