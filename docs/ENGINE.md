# KIDO — engine specification

Distilled from the Dimensional Thinking Framework (paper workspace: manuscript,
framework spec, implementation appendix, domain pedagogy matrix, glossary). This is
the contract the `engine/` module implements. Code vocabulary matches this document.

## 1. The layer stack

| Layer | Name | Question it answers | Output |
|---|---|---|---|
| L0 | potential | What could be, prior to distinction? | possibility field |
| L1 | existence | What unit is being distinguished? | entity, primitive, node |
| L2 | extent | Along what gradients does it vary? | attribute, magnitude, direction |
| L3 | boundary | What makes it this and not that? | edge, category, inside/outside |
| L4 | embodiment | What concrete instance shows it? | object, case, mechanism |
| L5 | time | How does it persist, change, emerge, decay? | sequence, process, history |
| L6 | concept | What abstraction averages its instances? | identity over variation |
| L7 | structure | What system organizes it? | network, theory, institution |
| L8 | principle | What invariant governs the structure? | law, axiom, constraint |

Pairings: L0/L1 and L7/L8 are analytically distinct but operationally inseparable.
The **working stack for interface and navigation** is seven positions:
`[L0·L1] L2 L3 L4 L5 L6 [L7·L8]`. The engine stores all nine; the UI may compress.

## 2. Operators

- **Averaging** `A(S, purpose) → r`: compress instances/claims into a representation
  that preserves what the next operation needs. In KIDO: the profile builder averaging
  source passages into per-layer claims. Must preserve disagreement — if sources
  conflict, the claim records both sides, never a fake consensus.
- **Exertion** `E(r, context) → V`: expand a representation into variations —
  examples, contrasts, applications, edge cases, questions. In KIDO: the practice
  generators.
- **Definition** `D(x) = center(x) + boundary(x)`: a definition without a boundary
  test against neighbors is not accepted as complete by the profile builder.

## 3. Layer annotation cues (heuristic baseline)

A passage may carry multiple tags. Baseline heuristic signals (a configured model may
refine, never replace, these):

- L1 existence — definitional openings: "X is a/an…", "X refers to…", naming of units.
- L2 extent — measures, comparatives, gradients: "rate", "degree", "more/less",
  numbers with units, "controls", "varies".
- L3 boundary — contrast markers: "unlike", "as opposed to", "not to be confused",
  "whereas", "rather than", negated class membership.
- L4 embodiment — concrete instance markers: "for example", "such as", "in this
  case", specific named instances, dates+places attached to a single event.
- L5 time — sequence/history: "then", "after", "during", "evolved", "originally",
  years/eras, step enumerations, iterative verbs.
- L6 concept — abstraction statements: "in general", "the idea of", "is a form of",
  category-of-categories phrasing.
- L7 structure — system relations: "consists of", "is part of", "framework",
  "system", "architecture", enumeration of interacting parts.
- L8 principle — invariants: "always", "law of", "in principle", "must", "conservation",
  "theorem", normative/regulative statements.
- L0 potential — possibility space: "could", "possible approaches", "one might" —
  rarely surfaced to learners; used for frontier material.

## 4. Dimensional profile

For a topic `x`, the profile is:

```
P(x) = { layer entries: L0..L8 → claims[] (each with supporting passage ids and
                        an uncertainty note when sources disagree),
         comprising: edges to concepts x is made from (requires / part-of / mechanism),
         neighboring: edges to concepts x must be discriminated from
                      (contrasts-with + a boundary test question),
         gaps: layers with no evidence — stated, not hidden }
```

A profile is **mature** when it can answer: what is it, what is it made from, how
does it vary, where does it stop being itself, what instance shows it, how does it
change, what concept averages it, what contains it, what governs it.

## 5. Learner model

```
M(learner, x) = [m0..m8], each mᵢ ∈ [0,1], evidence-based only.
```

Evidence events: retrieval hit/miss, boundary discrimination pass/fail, sequence
reconstruction, Feynman rating, transfer success, hint requests. Each event updates
exactly the layers it exercised (EWMA toward evidence, decay toward stale). Confidence
in `mᵢ` scales with evidence count — an untested layer is *unknown* (shown as such),
not 0.5.

## 6. Move selection

```
target = argmin over high-value layers of M(learner, x)
```

"High-value" comes from the domain pedagogy matrix: each domain family (math/theory,
AI/ML, programming, systems, design, history, language) weights layers differently and
prescribes an entry sequence. Then:

| weak layer | move |
|---|---|
| L1 | direct explanation + concrete identification |
| L2 | gradient/comparison prompt |
| L3 | boundary test (example vs near non-example) |
| L4 | worked/embodied example |
| L5 | sequence reconstruction |
| L6 | Feynman reconstruction |
| L7 | concept-map repair |
| L8 | principle inference / transfer task |

Protocol constraints: diagnose before teaching (an opening gauge of quick probes,
not self-report); move one layer at a time; direct explanation is legitimate when the
learner lacks footing — return agency immediately after; end with reconstruction, not
recognition.

## 6a. Directional competence (canonical doc Ch 13–14)

Understanding is a vector, not a scalar, and navigable in *both* directions. Alongside
the per-layer mastery vector the engine keeps a `DirectionVector` — pooled `up`
(averaging / consolidation: name it, state it, relate it) and `down` (exertion /
application: instantiate, decide, run, predict) competence. `KIND_DIRECTION` maps each
`EvidenceKind` to a direction; one graded response feeds both ledgers. Past an evidence
gate (both directions ≥ 3 events, gap ≥ 0.25), `detectImbalance` names the failure —
*stuck ascending* (can average, can't exert) or *stuck descending* (can exert, can't
re-average) — and `chooseTargetLayer` biases toward layers whose practice exercises the
weak direction. Untested direction is unknown, never weak.

## 6b. Collapse (canonical doc Ch 8, 14)

A collapsed abstraction recites perfectly and fails only under exertion. `detectCollapse`
flags fluent, evidenced upper layers (L6–L8) sitting over a weak-or-untested L4
embodiment anchor; the tutor routes straight to L4 ("demand the instance") via a priority
interrupt. The flag is evidence-gated (no all-untested false positives), staleness-aware,
and self-clearing: one anchor pass dissolves it, a miss hardens it from *possible* to
*demonstrated*.

## 6c. L0 potential and the nine-question survey (canonical doc Ch 13)

L0 is background for ordinary teaching. The complete Ch-13 survey (`nineQuestionSurvey`)
asks one question per layer, L0 last: *what else could have been the case, from which this
was selected?* The L0 probe surfaces only for advanced learners — `l0Unlocked` requires
demonstrated L3 + L6 competence and profile material — or via an opt-in deep gauge. It is
grounded strictly in the profile's known neighbors, never invented.

## 6d. The torus (canonical doc Ch 10–12, 22)

The stack is a loop, not a ladder: L8 closes onto L0, so the spiral has no summit and
mastery is circulation, never completion. The nine layers form mirror pairs about
embodiment — L0↔L8, L1↔L7, L2↔L6, L3↔L5, L4 the axis. This is framing and visualization
(the folded rail; the "one turn deeper" summary); mirror partnership never feeds mastery
math (§5's vector discipline holds).

## 7. Review

Spaced scheduling over `(topic, layer, item)` with an SM-2-family scheduler
(deterministic, clock injected). Weak layers and stale layers surface first.
A passed lesson is never "done" — it has a next due date.

## 8. Evaluation hooks

The engine exposes counters that make its quality measurable (per PROCESS G5):
annotation coverage per layer, profile maturity score, share of cards with stated
reasons (must be 100%), diagnosis-to-move consistency, review debt.
