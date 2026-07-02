# KIDO — feature process

Every feature ships through the same gate sequence. The point is not ceremony; it is
that a learning product fails quietly — a feed can look fine while teaching nothing —
so each feature must state what it does for the learner and how we'd know it doesn't.

## Gates

**G1 — Spec.** One paragraph in the feature's header comment or `docs/` entry:
- What learner problem this solves, in framework terms (which layer(s), which operator).
- What the feature must NOT do (scope fence).
- The AI-off behavior. If the feature only works with a model, it doesn't ship.

**G2 — Design.** Before code: where it lives in the module map (`docs/ARCHITECTURE.md`),
what types cross its boundary, what it persists. Engine logic must be pure and
UI-free; UI must contain no engine logic. A feature that needs a new module boundary
updates ARCHITECTURE.md in the same change.

**G3 — Implementation.** TypeScript strict. Engine code: pure functions over explicit
state, no `Date.now()`/`Math.random()` inside logic (pass clock/rng in) so everything
is testable and replayable. No new runtime dependency without a stated reason.

**G4 — Tests.** Engine modules ship with unit tests in the same change — behavior
tests, not mirrors of the implementation. Research providers ship with parsers tested
against captured fixtures (network stays out of tests). UI is verified by build +
manual pass until a component-test harness earns its keep.

**G5 — Verification.** `npm run check` (typecheck + tests) green before commit.
For learner-facing changes: a manual pass against the charter's success criteria —
does this change help a learner explain / instantiate / discriminate / connect?
If a change is pedagogically neutral or negative, it doesn't ship regardless of polish.

## Review heuristics (what "classy" means here)

- Every generated prompt or card carries its **reason** — why the engine chose it now.
  If we can't state the reason, the engine doesn't understand its own move.
- Every claim shown to the learner is **attributable**: a source excerpt, a computed
  relation over excerpts, or clearly-marked synthesis.
- Copy is direct. No exclamation-point encouragement, no infantilizing streaks.
- Prefer deleting a weak feature over decorating it.

## Versioning & commits

- `main` holds working states only (`npm run check` green).
- Commits are scoped to one gate-complete change with a message stating the learner-facing
  effect, not just the code change.
