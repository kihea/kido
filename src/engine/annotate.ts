// Layer annotation (docs/ENGINE.md §3). Heuristic, cue-based, explainable:
// every tag records the textual cue that produced it. A configured model may
// REFINE these tags (adjust confidence, add missed layers) via the injected
// refiner in the app glue — it never replaces the heuristic floor.

import type { Layer, LayerTag, Passage } from '../core/types';

interface Cue {
  layer: Layer;
  re: RegExp;
  confidence: number;
  label: string;
}

// Order matters only for reporting; all cues run against every passage.
const CUES: Cue[] = [
  // L1 existence — definitional openings, naming of units
  { layer: 1, re: /\b(?:is|are)\s+(?:a|an|the)\b/i, confidence: 0.45, label: 'definitional copula' },
  { layer: 1, re: /\brefers? to\b|\bis defined as\b|\bmeans\b|\bdenotes?\b/i, confidence: 0.7, label: 'explicit definition' },
  { layer: 1, re: /\bconsists? of\b|\bcomposed of\b|\bmade (?:up )?of\b/i, confidence: 0.4, label: 'unit composition' },
  // L2 extent — measures, gradients, comparatives
  { layer: 2, re: /\b(?:rate|degree|magnitude|amount|level|scale|frequency|intensity|proportion|percentage)s?\b/i, confidence: 0.5, label: 'measure noun' },
  { layer: 2, re: /\b(?:more|less|higher|lower|greater|smaller|faster|slower|stronger|weaker)\b.*\bthan\b/i, confidence: 0.6, label: 'comparative' },
  { layer: 2, re: /\b(?:increases?|decreases?|varies|ranging|ranges?|controls?|depends? on|proportional)\b/i, confidence: 0.55, label: 'variation verb' },
  { layer: 2, re: /\b\d+(?:\.\d+)?\s?(?:%|percent|km|m|cm|kg|g|hz|mhz|ghz|years?|seconds?|minutes?|hours?|°)/i, confidence: 0.5, label: 'quantity with unit' },
  // L3 boundary — contrast markers
  { layer: 3, re: /\bunlike\b|\bas opposed to\b|\bin contrast\b|\bwhereas\b|\brather than\b|\bnot to be confused\b/i, confidence: 0.75, label: 'contrast marker' },
  { layer: 3, re: /\bdiffers? from\b|\bdistinct from\b|\bdistinguish(?:ed|es)?\b|\bversus\b|\bvs\.?\b/i, confidence: 0.7, label: 'discrimination verb' },
  { layer: 3, re: /\bis not\b|\bare not\b|\bdoes not (?:include|count|apply)\b|\bexcludes?\b/i, confidence: 0.5, label: 'negated membership' },
  { layer: 3, re: /\bboundary\b|\bthreshold\b|\bcriteri(?:on|a)\b|\bqualif(?:y|ies)\b/i, confidence: 0.55, label: 'boundary noun' },
  // L4 embodiment — concrete instances
  { layer: 4, re: /\bfor (?:example|instance)\b|\bsuch as\b|\be\.g\./i, confidence: 0.7, label: 'example marker' },
  { layer: 4, re: /\bin (?:this|one) (?:case|instance|example)\b|\bconsider\b|\bimagine\b/i, confidence: 0.55, label: 'case invitation' },
  { layer: 4, re: /\bin \d{4}\b.*\b(?:at|in)\b/i, confidence: 0.4, label: 'dated concrete event' },
  // L5 time — sequence, history, process
  { layer: 5, re: /\b(?:then|after|before|during|until|eventually|subsequently|later|earlier|originally|initially)\b/i, confidence: 0.45, label: 'temporal connective' },
  { layer: 5, re: /\b(?:evolved|emerged|developed|became|grew|declined|spread|arose|originated|transformed)\b/i, confidence: 0.6, label: 'development verb' },
  { layer: 5, re: /\b(?:stage|phase|cycle|iterat\w+|sequence|process|step by step)\b/i, confidence: 0.5, label: 'process noun' },
  { layer: 5, re: /\b(?:1[0-9]|20)\d{2}s?\b.*\b(?:1[0-9]|20)\d{2}s?\b/, confidence: 0.5, label: 'year span' },
  // L6 concept — abstraction statements
  { layer: 6, re: /\bin general\b|\bgenerally\b|\bthe (?:idea|notion|concept) of\b|\bis a (?:form|kind|type) of\b/i, confidence: 0.6, label: 'abstraction marker' },
  { layer: 6, re: /\babstract\w*\b|\bcategor\w+\b|\bclassif\w+\b/i, confidence: 0.45, label: 'category vocabulary' },
  // L7 structure — system relations
  { layer: 7, re: /\b(?:system|framework|architecture|network|hierarchy|infrastructure|institution|ecosystem)s?\b/i, confidence: 0.55, label: 'system noun' },
  { layer: 7, re: /\bis (?:part|a component|a member) of\b|\bbelongs to\b|\bwithin the\b|\borganiz\w+\b/i, confidence: 0.5, label: 'part-of relation' },
  { layer: 7, re: /\binteract\w*\b|\brelation(?:ship)?s? (?:between|among)\b|\bconnect\w+ to\b/i, confidence: 0.45, label: 'interaction language' },
  // L8 principle — invariants, laws, norms
  { layer: 8, re: /\blaws? of\b|\btheorem\b|\baxiom\b|\bprinciple\b|\bconservation of\b|\binvariant\b/i, confidence: 0.75, label: 'law vocabulary' },
  { layer: 8, re: /\b(?:always|never|must|cannot|necessarily|in principle|by definition)\b/i, confidence: 0.4, label: 'invariance modal' },
  { layer: 8, re: /\bgoverns?\b|\bconstrains?\b|\bunderl(?:ies|ying)\b|\bfundamental\b/i, confidence: 0.5, label: 'governing verb' },
  // L0 potential — possibility space (rarely surfaced; feeds frontier material)
  { layer: 0, re: /\b(?:could|might|possible|possibly|potential(?:ly)?|open question|unresolved|remains unclear|debated?)\b/i, confidence: 0.4, label: 'possibility marker' },
];

/** Heuristic layer tags for a text. Multiple layers per passage are normal. */
export function heuristicTags(text: string): LayerTag[] {
  const byLayer = new Map<Layer, LayerTag>();
  for (const cue of CUES) {
    const m = cue.re.exec(text);
    if (!m) continue;
    const existing = byLayer.get(cue.layer);
    if (!existing) {
      byLayer.set(cue.layer, {
        layer: cue.layer,
        confidence: cue.confidence,
        cue: `${cue.label}: “${truncate(m[0], 40)}”`,
        by: 'heuristic',
      });
    } else {
      // Multiple distinct cues for the same layer reinforce it.
      existing.confidence = Math.min(0.95, Math.max(existing.confidence, cue.confidence) + 0.15);
      if (cue.confidence > existing.confidence - 0.15) {
        existing.cue = `${cue.label}: “${truncate(m[0], 40)}”`;
      }
    }
  }
  return [...byLayer.values()].sort((a, b) => b.confidence - a.confidence);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/** Annotate all passages in place (returns the same array for convenience). */
export function annotatePassages(passages: Passage[]): Passage[] {
  for (const p of passages) p.layers = heuristicTags(p.text);
  return passages;
}

/** Dominant layer of a passage — used for feed targeting. Defaults to L6. */
export function dominantLayer(p: Passage): Layer {
  const tags = p.layers ?? [];
  const top = tags[0];
  return top && top.confidence >= 0.4 ? top.layer : 6;
}

/** Share of passages carrying at least one tag ≥ minConfidence, per layer. */
export function annotationCoverage(passages: Passage[], minConfidence = 0.4): Record<Layer, number> {
  const counts: Record<Layer, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  for (const p of passages) {
    for (const t of p.layers ?? []) {
      if (t.confidence >= minConfidence) counts[t.layer] += 1;
    }
  }
  const n = Math.max(1, passages.length);
  for (const k of Object.keys(counts)) counts[Number(k) as Layer] /= n;
  return counts;
}
