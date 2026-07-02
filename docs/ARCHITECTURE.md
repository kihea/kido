# KIDO — architecture

Single-page local-first web app. React 19 + TypeScript (strict) + Vite, tests with
Vitest. No backend. A Tauri shell can wrap the same UI later (the alpha proved this);
v1.0 targets the browser first.

## Module map

```
src/
  core/       Shared domain types and small pure utilities (ids, clock/rng interfaces).
              Depends on nothing.
  research/   Live source research. Providers fetch verbatim passages + attribution
              from public APIs (Wikipedia, Wikibooks, Crossref, Wiktionary,
              Open Library, Hacker News). Best-effort with timeouts; the corpus is
              whatever returns. Depends on core.
  engine/     THE PRODUCT. Pure TypeScript, UI-free, model-free (accepts an optional
              annotator function — never imports ai/ directly):
                corpus.ts    term extraction + passage connections across sources
                layers.ts    the L0–L8 stack: names, questions, annotation cues
                annotate.ts  layer annotation of passages (heuristic ± injected model)
                profile.ts   averaging pass → DimensionalProfile (per-layer claims,
                             comprising / neighboring maps, preserved uncertainty)
                exertion.ts  practice generators: retrieval, boundary test, sequence,
                             Feynman prompt, transfer, concept-map repair
                mastery.ts   learner model: per-layer mastery vector + evidence log
                diagnose.ts  weakest-high-value-layer selection → teaching move
                tutor.ts     session state machine: plan next card, apply learner
                             response, emit feedback + reason
                review.ts    spaced review scheduler (layer-aware, deterministic)
              Depends on core only.
  ai/         Optional model adapters behind one interface: Ollama, OpenAI-compatible,
              Anthropic (user's own key). Produces the `annotator` / `assistant`
              functions the engine and UI may accept. Absence of a provider is the
              first-class default. Depends on core.
  state/      Persistence: IndexedDB (localStorage fallback) for learner state,
              settings, notebook. Depends on core.
  ui/         React screens and components. Depends on everything above; contains no
              engine logic.
```

Dependency rule: arrows point downward only (`ui → {engine, research, ai, state} → core`).
`engine` never imports `research`, `ai`, `state`, or `ui` — it consumes a `Corpus` and
returns plans; wiring happens in `ui`/app glue.

## Data flow (one session)

```
topic ─→ research fan-out ─→ Corpus (docs, verbatim passages)
      ─→ engine.corpus: recurring concepts + passage connections
      ─→ engine.annotate: layer tags per passage (heuristic; model refines if present)
      ─→ engine.profile: DimensionalProfile — per-layer claims with supporting
             passages, comprising edges, neighboring edges, disagreements
      ─→ engine.tutor: diagnostic question → loop:
             diagnose(mastery) → move → card (with reason) → learner action
             → evidence → mastery update → next
      ─→ engine.review: schedule weak/stale (topic, layer, item) triples
persist: state/ (device only)        display: ui/ (focus card + inspectable sources)
```

## Determinism policy

Engine logic takes `clock` and `rng` as inputs (`core/runtime.ts`). Given the same
corpus, learner state, and seed, a session plan replays identically — this is what
makes the engine testable and its choices explainable.

## AI boundary

Models may: refine layer annotations, phrase diagnostic/Socratic questions, evaluate
Feynman explanations, propose study-map branches. Models may not: author content
presented as source material, override engine gating, or be required for any feature
to function. Every model output is labeled as synthesis in the UI.

## Error posture

Research providers fail soft (a session works from whatever sources answered).
Persistence fails soft (in-memory session still works; the user is told saving is off).
The engine failing is a bug — it is pure and must not throw on valid inputs.
