// The topic's structure, seen not read: comprising concepts pull inward,
// neighbors sit outside a boundary ring. Deterministic radial layout (no
// physics, no deps) so it renders identically every time. Hovering a node
// shows why it's there.

import { useMemo, useState } from 'react';
import type { DimensionalProfile } from '../core/types';
import { LAYER_INFO } from '../engine/layers';

interface Node {
  id: string;
  label: string;
  kind: 'topic' | 'comprising' | 'neighbor';
  detail: string;
  x: number;
  y: number;
}

const W = 520;
const H = 380;
const CX = W / 2;
const CY = H / 2;

export function ConceptMap({ profile }: { profile: DimensionalProfile }) {
  const [hover, setHover] = useState<string | null>(null);

  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = [
      { id: '__topic', label: profile.topic, kind: 'topic', detail: 'the topic', x: CX, y: CY },
    ];
    const comp = profile.comprising.slice(0, 6);
    comp.forEach((e, i) => {
      const a = (i / Math.max(1, comp.length)) * Math.PI * 2 - Math.PI / 2;
      out.push({
        id: `c${i}`,
        label: e.label,
        kind: 'comprising',
        detail: `${e.relation.replace('-', ' ')} · ${LAYER_INFO[e.layer].name}`,
        x: CX + Math.cos(a) * 92,
        y: CY + Math.sin(a) * 78,
      });
    });
    const nb = profile.neighboring.slice(0, 6);
    nb.forEach((n, i) => {
      const a = (i / Math.max(1, nb.length)) * Math.PI * 2 - Math.PI / 2 + 0.4;
      out.push({
        id: `n${i}`,
        label: n.label,
        kind: 'neighbor',
        detail: n.contrast ? 'contrast — not part of the topic' : 'a neighbor, not part of it',
        x: CX + Math.cos(a) * 210,
        y: CY + Math.sin(a) * 158,
      });
    });
    return out;
  }, [profile]);

  const topic = nodes[0]!;
  const active = nodes.find((n) => n.id === hover);

  return (
    <figure className="concept-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Concept map for ${profile.topic}`}>
        {/* boundary ring: inside = part of the topic, outside = neighbors */}
        <ellipse cx={CX} cy={CY} rx={150} ry={118} className="cm-boundary" />
        {nodes
          .filter((n) => n.kind === 'comprising')
          .map((n) => (
            <line key={`e${n.id}`} x1={topic.x} y1={topic.y} x2={n.x} y2={n.y} className="cm-edge" />
          ))}
        {nodes.map((n) => (
          <g
            key={n.id}
            className={`cm-node cm-${n.kind}${hover === n.id ? ' is-hover' : ''}`}
            transform={`translate(${n.x} ${n.y})`}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            tabIndex={0}
            onFocus={() => setHover(n.id)}
            onBlur={() => setHover(null)}
          >
            <circle r={n.kind === 'topic' ? 8 : 5} />
            <text x={0} y={n.kind === 'topic' ? -14 : -10} textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        {active ? (
          <span>
            <strong>{active.label}</strong> — {active.detail}
          </span>
        ) : (
          <span>Inside the ring is part of {profile.topic}; outside sits near it. Hover a node.</span>
        )}
      </figcaption>
    </figure>
  );
}
