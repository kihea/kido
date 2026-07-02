# KIDO

Research a topic. Understand it in layers. Keep it.

KIDO researches a topic across real sources (verbatim excerpts, always attributed),
computes a **dimensional profile** of it — what it's made from, how it varies, where
it stops being itself, what instance shows it, how it changes, what contains it, what
governs it — then teaches by diagnosing which layer you're missing and targeting it,
one move at a time. Mastery is tracked per layer, from evidence, and reviewed on a
spaced schedule.

- **Source-first.** KIDO never passes off synthesis as source. Every excerpt is
  verbatim and linked; every generated prompt states why it was chosen.
- **AI-optional.** Everything works with no model. Plug in Ollama, any
  OpenAI-compatible server, or your own Anthropic/OpenAI key to sharpen annotation
  and feedback — keys stay on your machine, all state stays local.
- **Local-first.** No backend, no accounts, no telemetry.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + tests
npm run build    # production build
```

## Docs

- [Charter](docs/CHARTER.md) — what v1.0 is and isn't.
- [Architecture](docs/ARCHITECTURE.md) — module map and boundaries.
- [Engine spec](docs/ENGINE.md) — the dimensional learning engine contract.
- [Process](docs/PROCESS.md) — the gate every feature passes through.

## Lineage

v0.1 was [tessera](https://github.com/kihea/tessera) — the source-first feed
prototype. KIDO keeps its research providers and its ethics (verbatim, inspectable,
local) and replaces the lexical weave with a learning engine grounded in the
Dimensional Thinking Framework.

## License

[MIT](LICENSE) © Kihea
