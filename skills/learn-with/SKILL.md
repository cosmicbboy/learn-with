---
name: learn-with
description: 'Entry point for everything built on the learn-with framework: bespoke adaptive learning interfaces that compile a declarative course into a static site or a dynamic app that really runs code. Covers what learn-with is, the repo layout, the two compile targets, the adaptive + agentic layers, and routes to the sibling skills (learn-with-author, learn-with-build, learn-with-adaptive, learn-with-ui). Use when creating, editing, running, deploying, or debugging a learn-with course (or the framework itself). Trigger words: "learn-with", "build a course", "adaptive learning site", "rust hlock course", "compile course to static/dynamic".'
---

# learn-with — the autodidact's course framework

`learn-with` is a framework for building **bespoke adaptive learning interfaces**. You
author a course once, as Markdown + `::: directive` blocks, and compile it to **two
targets** from a single source:

- **static site** — a self-contained `dist/` any static host can serve. `predict`/`mcq`
  exercises work offline; real `code` compilation is honest about needing the dynamic
  backend or the WASM-rustc adapter.
- **dynamic app** — the same UI plus a real execution API: a local Express server (or a
  serverless/Vercel adapter) that serves it with **live `rustc`** compiling and running
  code typed in a browser editor.

The framework lives at **`/Users/nielsbantilan/git/learn-with`**.

The pedagogy is grounded in Khan Academy (mastery tree/ladder, scaffolded hints),
Codecademy (split-screen editor + real execution), Coursera (module/objective structure),
Exercism/Rustlings (concept exercises with failing code), Duolingo (adaptive challenge
zone), and the Rust Playground. Full rationale: `DESIGN.md` in the repo.

## The mental model in one paragraph

A **course** is a graph, not a page-list. Concepts are the atoms the learner is tracked
on. A **module** has objectives, lessons, and an optional capstone. A **lesson** is prose
plus interactive **exercises** (code you run) and **quizzes** (MCQ), each mapped to one or
more **concepts**. The **adaptive engine** maintains a per-concept user model (mastery
ladder, spaced review, difficulty, render-layer) and runs in BOTH browser and server. The
**agentic layer** fabricates fresh practice on the fly when you're stuck.

## The repo layout (know before touching anything)

```
bin/learn-with.js      CLI: compile | build | serve | run
lib/content.js         lesson .md + ::: directive parser
lib/compile.js         course source -> course.json manifest
lib/model.js           schema + validation + concept defaults
lib/emit-static.js     static emitter (dist/), asset cache-buster
lib/server.js          Express app: UI + /api/course /api/run /api/adapt /api/user
lib/adaptive/rules.js  deterministic engine (UMD: browser + Node)
lib/adaptive/agent.js  agentic on-the-fly practice (synthetic default + LLM hook)
lib/runner/            subprocess.js (real rustc) · docker.js · index.js · wasm.js
ui/                    index.html, app.js (SPA), styles.css, wasm-runner.js, logo.svg
courses/rust-hlock/course.hl.yml + content/*.md   <- the first course
serverless/vercel.js   serverless adapter for the dynamic target
test/                  verify-exercises.js, run-tests.js (npm test)
```

## Quickstart commands

```bash
cd /Users/nielsbantilan/git/learn-with
npm install
npm run serve    # dynamic server, live rustc, http://localhost:4000
npm run build    # static dist/ (cache-busting ?v baked in)
npm test         # compile + run every exercise & solution against real rustc + adaptive tests
node bin/learn-with.js compile courses/rust-hlock   # validate & summarize a course
node bin/learn-with.js run courses/rust-hlock --code -   # pipe rust to real rustc
```

Requires Node ≥ 18 and a `rustc` on PATH. Explicit runner: `node bin/learn-with.js serve
courses/rust-hlock --backend docker` for a sandboxed cargo runner.

## The two targets — what "compiling" means

| Target | What you get | How code runs |
|---|---|---|
| static | `dist/` (single-page app + course.json) | `predict`/`mcq` offline; `code` uses `ui/wasm-runner.js` (either a bunded WASM `rustc` or an honest "needs dynamic mode" message) |
| dynamic | Express (local or serverless) serving the same UI + API | `POST /api/run` → `lib/runner/subprocess.js` shells to real `rustc`/`cargo` in a temp dir; `docker.js` for sandboxed |

The runner interface is uniform: `run(code, item) -> { ok, stdout, stderr, exit, phase,
verdict }`. Failing to compile is NOT a harness failure — the error text is the
pedagogical output.

## Core conventions every learn-with skill shares

1. **The renderer has to handle authoring edge cases explicitly** — see
   `learn-with-author` (tables, markers, `:::Notice` aliases) and `learn-with-ui`
   (renderMD gotchas). These were the source of most formatting bugs this project hit.
2. **Content edits require a server restart.** `/api/course` is compiled once at server
   startup and cached in memory — a restart (or recompile-per-request) is needed to pick
   up content changes. Rebuild `dist/` after any `ui/` change.
3. **Verify, don't trust.** Every exercise and its solution must be validated against
   *real* rustc before shipping — that's what `npm test` does (see `learn-with-build`).
4. **A browser may serve stale CSS/JS.** The static emitter appends a `?v=<build-time>`
   cache-buster precisely so fresh builds are picked up; force a hard refresh when QA'ing.

## Routing — pick the right sibling skill

- **Authoring a course or editing lesson content** (directives, exercises, quizzes,
  output checks, intentional-error exercises, persona callouts) → `learn-with-author`.
- **Building, running, deploying, or verifying exercises** (static vs dynamic, rustc
  subprocess/docker, WASM fallback, serverless, cache-buster, `npm test`) →
  `learn-with-build`.
- **Tuning or debugging the adaptive/agentic layer** (user model, mastery ladder, spaced
  review, challenge zone, render-layer, `/api/adapt`, user persistence) →
  `learn-with-adaptive`.
- **Iterating on the UI, templates, editor, or theming** (markdown rendering, the
  code editor overlay + line-number gutter, light/dark mode, logo) → `learn-with-ui`.
