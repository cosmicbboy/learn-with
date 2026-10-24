---
name: learn-with-build
description: 'Build, run, deploy, and verify learn-with courses. Covers the two compile targets (static dist/ vs dynamic Express/serverless), the code-runner abstraction (real rustc subprocess, docker sandbox, WASM static fallback), output-check grading, the asset cache-buster, the verification workflow (npm test against real rustc), and how to recover when a lesson/server looks stale. Use when building, serving, deploying, or testing a learn-with course. Trigger words: "build course", "deploy course", "serve", "static site", "vercel", "rustc runner", "cache-buster", "npm test", "stale css", "vercel deploy".'
---

# Building, running, and deploying learn-with

`npm run build` emits a **static** `dist/`; `npm run serve` starts the **dynamic** server
with a real execution backend. Both share the same compile step
(`lib/compile.js` → `course.json`) and the same UI.

## The two targets

| Command | Output | Code execution |
|---|---|---|
| `npm run build` | `dist/` (SPA + course.json + `?v=`-cache-busted assets) | predict/mcq offline; code exercises use `ui/wasm-runner.js` (bundled WASM rustc or an honest "needs dynamic mode" notice) |
| `npm run serve` | Express on `:4000` (default) | `lib/runner/subprocess.js` shells to real `rustc` in a temp dir — real compile errors are surfaced to the learner |

Explicit options: `node bin/learn-with.js serve courses/rust-hlock --port 5000 --backend subprocess|docker`.
Docker runner (`--backend docker`, or `LEARN_WITH_BACKEND=docker`) compiles inside an
ephemeral `rust:1.87` container and falls back to subprocess if docker is unavailable.

The runner interface is uniform: `async run(code, item) -> { ok, stdout, stderr, exit,
phase, verdict }`. Output checks (`exact`/`contains`/`auto`) are graded client- and
server-side via `lib/runner/index.js:attachVerdict`.

## Static vs WASM — be honest about the hard limit

Real in-browser compilation requires shipping **host `rustc` compiled to WASM**
(heavy, ~100MB — the Rust Playground approach). The static `wasm.js` / `ui/wasm-runner.js`
adapter slot is ready but a bulky bundle is not shipped by default. `predict`/`mcq`
need no compiler and always work in static mode; for `code` exercises the static runner
surfaces a clear "run in dynamic mode or enable the WASM rustc adapter" message rather
than pretending. Do NOT claim static mode compiles arbitrary Rust unless the WASM bundle
is present.

## Serverless / hosted (Vercel, Cloudflare)

`serverless/vercel.js` exports the same Express app (via `lib/server.js:createApp`) as a
Vercel Node function; see the file for the `vercel.json` wiring. **Caveat:** platform
sandboxes usually lack `rustc`, so `/api/run` needs a real backend — set
`LEARN_WITH_BACKEND=docker` + `LEARN_WITH_IMAGE` (a build/run image) or point it at a
compile service. Local `subprocess` rustc works on self-hosted/managed runners only.

## The verification loop (non-negotiable before shipping a course)

`npm test` → `test/run-tests.js` does all of it:

1. unit-tests the adaptive engine (`lib/adaptive/rules.js`);
2. parses the course and asserts modules/lessons/concepts/objectives;
3. **compiles and runs every runnable exercise AND its solution against real rustc**,
   reporting COMPILE-ERR, RUN-ERR, and CHECK-FAIL per exercise, treating a known list of
   "intentional-error" starters (that teach a compiler error) as expected failures.

There's also `test/verify-exercises.js` for a quick dev pass. Always fix every COMPILE-ERR
and CHECK-FAIL before claiming a course works.

## Common failure modes and how to recover

- **Lesson changed but the site shows old content.** The dynamic server compiles
  `/api/course` once at startup and caches it in memory — **restart the server** after
  content edits. Also rebuild `dist/` after any `ui/` change.
- **Stale CSS/JS in the browser.** `index.html` is emitted with a **build-time
  `?v=<timestamp>` cache-buster** on `styles.css`/`app.js`/`wasm-runner.js`/`logo.svg`
  (`lib/emit-static.js`). If you still see old styles, it's an aggressive proxy/browser
  cache — hard-refresh. When QA'ing with a headless browser, a sticky disk cache can make
  you chase ghosts; open the URL with a cache-busting query
  (`/?bust=<n>#module/lesson`) or a fresh context.
- **New exercise fails to compile.** Usually a check/goal/starter mismatch (see
  `learn-with-author`) or a genuine rust error — read the diagnostic the verifier prints.

## Runtime environment

- Node ≥ 18 (repo uses CommonJS; no build step for the framework itself).
- A `rustc`/`cargo` on PATH for the subprocess runner (this machine has rustc 1.87).
- Optional `Docker` for the sandboxed runner.
- Optional agentic backend: set `LEARN_WITH_AGENT_URL` / `LEARN_WITH_AGENT_KEY` /
  `LEARN_WITH_AGENT_MODEL` to switch `/api/adapt` from the synthetic generator to an LLM
  (see `learn-with-adaptive`).
