# KIDO — project charter

KIDO is a research-and-teaching application: you give it a topic, it researches real
sources, computes a layered understanding of the topic, and then teaches that
understanding by diagnosing what you're missing and targeting it — one move at a time.

This is v1.0. The v0.1 alpha (`kihea/tessera`) proved the source-first feed: verbatim
excerpts from live research, woven by shared concepts. Its confirmed limit is that the
weave was lexical, not conceptual — the feed *resembled* understanding without computing
it. v1.0 keeps the alpha's virtues (real sources, inspectability, local-first, AI-optional)
and replaces its heart with the **dimensional learning engine**.

## Product thesis

A topic is teachable when the system can represent it in relation to:

- its **comprising** concepts — parts, primitives, mechanisms, prerequisites;
- its **neighboring** concepts — contrasts, near non-examples, misconceptions;
- its **temporal** development — origin, process, change;
- its **governing principles** — invariants and constraints.

The theoretical foundation is the Dimensional Thinking Framework (see
`docs/ENGINE.md` and the paper workspace it derives from): nine layers of constraint
(L0 potential, L1 existence, L2 extent, L3 boundary, L4 embodiment, L5 time,
L6 concept, L7 structure, L8 principle) and two operators — **averaging** (compress
sources/instances into representation) and **exertion** (expand representation into
examples, contrasts, tests, transfer). Understanding is bidirectional competence
across layers; teaching is diagnosing the weakest high-value layer and moving there.

## Priorities (ordered)

1. **The learning engine.** Layer-profiled topic models, layer-specific mastery,
   diagnosis, targeted teaching moves, spaced review. This is the product.
2. **Source fidelity.** Excerpts stay verbatim and attributed. Synthesis, when it
   appears, is visually and structurally separate from source text. Disagreement
   between sources is preserved, not averaged away.
3. **User experience.** Desktop-first: mouse + keyboard, two eyes on one target at a
   time — a single focused card/prompt, not a wall. Phone: scroll or listen. Calm,
   typographic, no decorative gamification.

## Hard constraints

- **AI-optional.** Every feature works with no model configured, via honest heuristics.
  Users who opt out are told (once, plainly) that they trade speed and synthesis
  quality — not access. A configured model (Ollama / OpenAI-compatible / Anthropic /
  in-browser) improves annotation, diagnosis phrasing, and feedback; it never becomes
  load-bearing for correctness and it never fabricates "source" content.
- **Local-first.** No backend, no accounts. Learner state lives on the device. API keys
  are the user's own and never leave their machine except to the provider they chose.
- **Don't coddle.** Direct language, real difficulty (desirable difficulty is a design
  principle), no mastery theater. Progress is evidence-based per layer, never a
  completion percentage.

## v1.0 scope (MVP per the framework's implementation appendix, §9)

1. User enters a topic (optional notes / own sources later).
2. System researches real sources and builds a **layer map** (dimensional profile:
   comprising + neighboring concepts, per-layer claims, uncertainty preserved).
3. System asks **one diagnostic question** to locate the learner's entry layer.
4. System teaches through a tutor loop: one scaffold, one focused learner action,
   feedback, next-layer decision. Sources remain inspectable throughout.
5. System produces a **layer-specific mastery summary** (not a score).
6. System schedules retrieval prompts and boundary tests for spaced review.

**Success criteria** — after a session the learner can:
- explain the topic in plain language;
- give one example and one near non-example;
- name one larger structure and one governing principle;
- say which layer they still don't understand.

## Non-goals for v1.0

- Multi-user, sync, cloud storage, telemetry.
- Full-document ingestion of arbitrary PDFs (post-1.0).
- Mobile-native apps (responsive web serves the phone posture).
- A visible nine-layer theory lesson: the learner experiences the framework through
  useful actions; the stack stays mostly internal until they ask for it.

## Naming

Product name: **KIDO**. The engine module is `engine/` and its public vocabulary uses
the framework's terms (layer, profile, mastery, move, averaging, exertion) verbatim,
so the code stays legible against the paper.
