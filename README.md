# learn-with

An autodidact's framework for building **bespoke adaptive learning interfaces**.
You author a course once, as Markdown + directives, and compile it to two targets:

- **static website** — a self-contained `dist/` any static host serves; interactive
  `predict`/`mcq` exercises work offline, and code exercises fall back honestly until
  an in-browser WASM rustc is bundled.
- **dynamic app** — the same interface plus a real execution API. A local dev server or
  a serverless host (Vercel/Cloudflare) serves it with **live `rustc`** compiling and
  running your code in a browser editor.

The course is **beginner-biased but adapts fast**: an embedded adaptive engine tracks
per-concept mastery (spaced review, difficulty "challenge zone", per-learner explanation
depth), and an **agentic layer** generates fresh practice material on the fly when the
deterministic rules can't fully serve you. See [DESIGN.md](DESIGN.md) for the full
rationale (what we took from Khan Academy, Codecademy, Coursera, Exercism, Duolingo, and
the Rust ecosystem, and why).

---

## The included first course: *Go AI Splunking to Learn Rust — `hlock` edition*

Teaches **Rust** to someone with a Python/JS background, by mining a *real* production
codebase: [`unionai-oss/hlock`](https://github.com/unionai-oss/hlock), a Rust project
that makes agent harnesses portable. Every concept is anchored in actual hlock source
(`manifest.rs`, `hash.rs`, `error.rs`, `worker.rs`, …) and reinforced with hands-on
exercises you **type in a browser editor and really run**.

12 modules · 16 lessons · 44 exercises — from `fn main` and the borrow checker, through
structs/derives, enums/`match`, ownership, errors/`?`, iterators, traits, the workspace,
concurrency, testing, to a capstone where you build your own mini-hlock.

## Quick start — run it with real rustc (dynamic mode)

Requires Node ≥ 18 and `rustc` on PATH (any recent toolchain).

```bash
npm install
npm run serve                 # starts dynamic server on http://localhost:4000
# open http://localhost:4000
```

You can pass `--port` and `--backend`:

```bash
node bin/learn-with.js serve courses/rust-hlock --port 5000 --backend subprocess
node bin/learn-with.js serve courses/rust-hlock --backend docker   # sandboxed cargo
```

The `DYNAMIC · LIVE RUSTC` badge means every Run button compiles with real `rustc` and
shows real output or real compiler diagnostics (try `E0382`/`E0506` examples — the 
compiler is the teacher).

## Build the static site

```bash
npm run build                 # writes a self-contained ./dist
npx serve dist                # or any static host
```

## Commands

| command | what it does |
|---|---|
| `npm run build` | compile `courses/rust-hlock` → `dist/` (static) |
| `npm run serve` | build + dynamic server with live rustc |
| `npm test` | validate course + run every exercise/solution through real rustc + adaptive tests |
| `node bin/learn-with.js compile courses/rust-hlock` | validate & summarize a course |
| `node bin/learn-with.js run courses/rust-hlock --code -` | one-shot: pipe Rust to real rustc |

## Project layout

```
lib/
  content.js        lesson .md + `::: directive` parser
  compile.js        course source -> course.json manifest
  emit-static.js    static emitter (dist/)
  server.js         Express app: UI + /api/course /api/run /api/adapt /api/user
  model.js          schema + validation
  adaptive/
    rules.js        deterministic engine (runs in browser AND server; UMD)
    agent.js        agentic on-the-fly practice (synthetic default + LLM hook)
  runner/
    subprocess.js   real rustc/cargo runner        (local dynamic)
    docker.js       sandboxed rustc runner         (hosted dynamic)
    index.js        runner registry + output checks
ui/
  index.html        app shell (mode-agnostic)
  app.js            SPA: syllabus, split-view editor, mastery, adapt, agent
  styles.css        Codecademy/Khan-inspired styling
  wasm-runner.js    static-mode runner (predict/mcq + WASM-rustc slot)
courses/rust-hlock/
  course.hl.yml     course manifest (modules/objectives/concepts/persona)
  content/…         16 lesson files (Markdown + exercises)
serverless/
  vercel.js         serverless adapter for the dynamic target
```

## Authoring a course

1. **Manifest** — `course.hl.yml`: `id`, `title`, `persona` (so the adaptive engine
   knows the learner's starting language), `modules[]` → `lessons[]` (each pointing at a
   content file and declaring `concepts`).
2. **Lessons** — Markdown files with three extra building blocks:

   - `::: callout type="contrast" lang="python"` → a persona-aware sidebar (`type`
     drives the colour; the adaptive engine can route `base|contrast|deep|remedial`
     layers). `::: notice`, `::: warning`, `::: tip`, `::: info`, … are aliases that
     render as the matching callout tone automatically.
   - `::: exercise kind="code" concepts="ownership" difficulty="2" check="contains:ok"` →
     the split-view interactive exercise. The first fenced `rust` block is the starter
     code; a second fenced block under a `<solution>` marker (or labeled
     `rust:solution`) is the solution. `kind` is `code|fill|predict|output|mcq`.
   - `::: exercise kind="mcq" options="A|B|C" answer="1"` → a check-your-understanding
     quiz (also writable as `::: quiz`).

3. **Run** it with `serve`; each exercise's output check is graded against real stdout.

## How the adaptation works

There's a **light/dark theme toggle** in the header (persisted in `localStorage`, and it
respects your OS `prefers-color-scheme` by default).

The **rules engine** (pure JS, ships to the browser) keeps a per-concept user model:
every correct/incorrect answer and hint moves a concept up/down a mastery ladder
`unknown → learning → practiced → mastered`, with a forgetting-curve that schedules
spaced review and re-surfaces weak concepts. It chooses the explanation layer, the
difficulty ("challenge zone"), and the next item. The **agentic layer** runs server-side
in dynamic mode: if you're stuck, "✨ Generate more practice" calls `/api/adapt` to
fabricate a fresh exercise scoped to the concept + your profile (a dependency-free
synthetic generator by default; set `LEARN_WITH_AGENT_URL` / `LEARN_WITH_AGENT_KEY` for
an LLM-backed generator).

Progress persists per browser (localStorage) and, in dynamic mode, to a small server-side
JSON store behind `/api/user` — swap that for a KV/DB store in production.

## Roadmap
- Bundle host `rustc` → WASM into the static `wasm` runner so static mode compiles code
  fully offline (the adapter slot is ready).
- Durable-object / KV user store for the Vercel/Cloudflare adapters.
- Richer template library + more `:::directive` building blocks.

License: Apache-2.0
