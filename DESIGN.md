# learn-with — Base Layer Design

`learn-with` is an autodidact's tool: a framework + starter layer that lets an
agent author a *bespoke adaptive learning interface* and ship it as either a
**static website** or a **dynamic app** (local dev server, Vercel, Cloudflare),
from a single declarative course source.

This document records the design research (what we borrowed and why) and the
architecture that turns those principles into concrete, working pieces.

---

## 1. Design research — what the proven platforms taught us

Sources studied: **Khan Academy**, **Coursera**, **Codecademy**, plus
**freeCodeCamp**, **Exercism**, **Duolingo**, **Pluralsight**, and the compiler
(c)hicken-around of an in-browser **Rust** course (The Rust Book, Rustlings,
and the Rust Playground's WASM `rustc`).

### 1.1 Khan Academy — mastery + scaffolding
- **Skill tree / mastery map.** Content is a graph of concepts, not a linear
  list. Progress is tracked per-concept, not per-page.
- **Mastery levels (`Practiced` → `Mastered` → `Challenged`).** A concept isn't
  "done" after one correct answer; it needs repeat success, and weak concepts
  get scheduled for review. We mirror this with a four-level mastery ladder.
- **Scaffolded hints.** "Get a hint" gives a progressive nudge, not the answer;
  using a hint acknowledges the learner is stuck and partially discounts the
  next attempt.
- **Exercises framed as tests.** Practice is a small task with *a correct
  answer to check*, giving instant, honest feedback rather than passive reading.

### 1.2 Codecademy — the interactive split view
- **Split-screen lesson.** Left pane = short prose + callouts; right pane = a
  real code editor with a **Run** button, an output/error console, and a
  "Check your work" pass/fail.
- **Bite-sized steps.** Each page is a single idea with a single action, then
  "Next". Progress bar at top gives a clear sense of place and motion.
- **Real execution, real errors.** The defining trait: you *type code and watch
  it compile and run*, producing real output or real error messages. We treat
  this as a hard requirement (see the runner §3.4).
- **Project capstones.** Modules end with an open-ended project that composes
  the concepts instead of another quiz.

### 1.3 Coursera — structure & objectives
- **Module → lesson → item hierarchy** and explicit **learning objectives** at
  the top of each module (the learner knows the destination).
- **Assessments placed after concept groups**, mixing graded quizzes with
  readings. Pacing: a steady, small-unit cadence.

### 1.4 Exercism / Rustlings — concept exercises with failing tests
- **One exercise = one concept**, taught by giving you a program with a failing
  test or a TODO you must make pass. The red→green loop is the pedagogy.
- Concept-first *learning paths* rather than encyclopedic references.

### 1.5 Duolingo — motivation & adaptation
- Streaks, XP, hearts/lives for mistakes, and **adaptive difficulty**: keep the
  learner in a "challenge zone" — hard enough to grow, easy enough to keep
  going. Failures drop difficulty; successes raise it.

### 1.6 freeCodeCamp — immediate check + certification paths
- Small embedded coding challenges with an immediate auto-check and a visible
  path toward a goal (a course map / certificate).

### 1.7 Synthesis — the design principles we encode
1. **Concept-graph mastery, not page-order credit.** Track each concept's
   mastery; advance and review by mastery. (Khan)
2. **Split-screen interactive execution.** Learn-by-running with real
   compile/run output and errors. (Codecademy, rust playground)
3. **Tests-frame-exercises.** Exercises are small, checkable tasks; failing →
   fixing is the loop. (exercism/rustlings)
4. **Mastery ladder + spaced review.** Unknown→Learning→Practiced→Mastered, with
   forgetting-curve scheduling. (Khan/Duolingo)
5. **Adaptive difficulty routing.** A "challenge zone": explanation depth and
   next-material depend on your live performance. (Duolingo)
6. **Agentic on-the-fly material.** When the deterministic engine can't serve
   you (you're stuck on a niche concept, or you want more practice), an *agent*
   generates fresh fabricated-relevant explanation/problems/hints on the fly,
   grounded in the learner's profile and the project being studied. Static mode
   falls back to pre-authored variants + hints.
7. **Bite-sized steps, visible progress, clear objectives.** (Codecademy /
   Coursera)

---

## 2. Persona adaptation ("biased for beginners, adapts fast")

Every lesson is authored with **persona-aware layers**:

- `base` — beginner-friendly default explanation with **Python/JS/R analogies**
  (this learner knows Python > JS > R).
- `contrast` — a "for the Pythonista" / "for the JSer" sidebar spelling the
  mapping from a familiar language to the Rust concept.
- `deep` — a deeper layer for when the user is clearly not a beginner on a
  concept (mastery is already high when they arrive) — skip the analogy, go to
  subtlety.
- `remedial` — a re-explained, simpler variant with an extra worked example when
  the user struggles.

The **adaptive engine** (see §4) picks which layer to *render* and which
material to show *next*.

---

## 3. Architecture

A single declarative **course source** compiles to a **course manifest** (JSON).
One renderer + one runner serve it in every mode.

```
course source (markdown + hl blocks + course.hl.yml)
        │  compile (CLI: `learn-with compile`)
        ▼
course.json (manifest: modules/lessons/concepts/exercises/quizzes/objectives)
        │
        ├──▶ STATIC BUILD:  dist/  (index.html + app.js + styles.css + course.json)
        │         runs in any static host · code runs via WASM/JS runner (offline)
        │
        └──▶ SERVER (dynamic): express serves dist/ + routes:
                  GET  /api/course
                  POST /api/run              (compile+run code via rustc/cargo/docker sandbox)
                  POST /api/adapt            (agent generates on-the-fly material)
                  POST /api/user             (persist mastery progress)
              deploys to Vercel/Cloudflare via the framework's adapter or a local server
```

### 3.1 Course model (`framework/src/model`)
- **Course**: title, blurb, persona hints, module list, mastery ladder.
- **Module** — learning objectives, lessons, an optional capstone project.
- **Lesson** — prose (markdown with directives), one or more **exercises** and
  **quizzes**, mapped to **concepts**.
- **Concept** — the atom the user model tracks (e.g. `ownership`, `enums`,
  `error-`). A lesson can teach and exercise several concepts; a single concept
  is reinforced across modules (spaced review).
- **Exercise[kind]** — `code` (program in the editor, run it), `fill` (blank in
  code), `predict` (predict output, then verify), `output-check` (program whose
  stdout must match expected → auto-graded), `mcq` (concept quiz).
- Every item carries `concepts:[...]`, `difficulty`, `hints[]`, `variants[]`
  (remedial/deep), and code templates.

### 3.2 Content format
Markdown with `:::directive` blocks so authors stay in prose:

````md
## Lessons read like prose, with analogies.

::: callout type="contrast" lang="python"
In Python you write `d["k"] = v`. In Rust you can't index-assign into a
`HashMap` — you call `map.insert("k".to_string(), v)`. Same idea, explicit call.
:::

::: exercise kind="code" concepts="[ownership]" difficulty="2"
  goal: "Fix the borrow error so this compiles and prints 'ok'."
  check: { mode: "exact", stdout: "ok" }
  ::code rust::
  fn main() { let mut s = String::from("rust"); let r = &s; s.push('!'); println!("{r}"); }
  ::::
  hints:
    - "You hold `r = &s` while later mutating `s`. Rust won't allow a shared ref to live across a mutable use."
  solution::
  fn main() { let mut s = String::from("rust"); { let r = &s; println!("{r}"); } s.push('!'); }
::
:::
````

### 3.3 Renderer / templates
A small template library skins a lesson in proven patterns:
`split-view` (editor + console), `callout`, `progress-bar`, `mastery-badge`,
`hint-reveal`, `solution-reveal`, `quiz-card`, `output-console`, `concept-map`.
Templates are chosen per-item by the renderer; the **agent** may also pick a
template when generating on-the-fly material (modularity requirement).

### 3.4 Code runner abstraction (`framework/src/runner`)
One interface, multiple backends — the key to "compile to any target while
still really running code":

| Backend | Target | How it runs |
|---|---|---|
| `subprocess` | local dev / dynamic | shells out to real `rustc`/`cargo` in a temp crate; captures stdout/stderr/exit. Fast, real errors. **Default for the Rust course.** |
| `docker` | dynamic (hosted/sandboxed) | runs `cargo`/`rustc` inside an ephemeral container (resource limits, no host deps). |
| `wasm` | static | in-browser `rustc`→WASM (Rust Playground approach); adapter stub + **pure-JS fallback** for `predict`/`mcq`/small `fill` exercises so static works offline. |

The runner returns `{ ok, stdout, stderr, exit, durationMs }`. Failing to
compile is *not* a failure of the harness — the error text is the pedagogical
output. `output-check` exercises let the harness auto-grade by comparing
stdout.

### 3.5 Adaptive engine (`framework/src/adaptive`)
Two cooperating layers:

1. **Deterministic rules (`rules.js`)** — runs *client-side*, works in every
   mode. Maintains the user model:
   - per-concept score, attempts, consecutive-correct, hint usage, last-seen
   - mastery ladder transitions (Unknown → Learning → Practiced → Mastered)
   - forgetting-curve scheduling: re-surface concepts whose `lastSeen` is old
     and score is below Mastered (spaced review)
   - difficulty in "challenge zone": adjust a per-item difficulty offset so the
     learner faces ~70–85% success, per the mastery signal
   - **render selection**: pick explanation layer (base/contrast/deep/remedial)
     and next item from the concept graph.
2. **Agentic (`agent.js`)** — runs *server-side* in dynamic mode. Given the
   learner's profile, the current concept, and how they're stuck, it invokes a
   model to produce bespoke material *on the fly*: a new explanation, a new
   practice problem (with code + expected output), or a targeted hint —
   returned through the same item/runner shape so it renders identically. In
   static mode the client calls the deterministic `variants[]`/`hints[]` pool.

The engine is **modular** (`choose_render`, `next_item`, `schedule_review`,
`generate_material`) so an agent can swap or extend any piece.

### 3.6 User-model persistence
`POST /api/user` persists the user model (localStorage in static mode; a small
JSON store in dynamic mode), so progress survives refreshes and devices.

---

## 4. Building the course: *Go AI Splunking to Learn Rust — `hlock` edition*

The first course applies the base layer to a real, personal Rust project
([`unionai-oss/hlock`](https://github.com/unionai-oss/hlock)) and a real learner
(Python/JS background). **"Splunking"** = going on an expedition through hlock's
actual source: every concept is taught against a *real* function or struct from
the repo, so reading real production Rust is the method.

**Learner profile (persona):** expert in Python, comfortable with JS, a little R.
Wants hands-on: type Rust in a browser editor, run it, see it compile/run/error.

**Course arc** (each module maps a Rust pillar to an hlock artifact):

| # | Module title | Rust pillar | hlock artifact you Splunk |
|---|---|---|---|
| 0 | Meet your quarry | mental model, cargo, toolchain | `Cargo.toml` / workspace |
| 1 | First blood: compile hello | `fn main`, `println!`, statements | the tiniest crate entrypoints |
| 2 | The manifest as data | structs, `#[derive]`, `Option`, enums, `BTreeMap`, serde | `manifest.rs` |
| 3 | Ownership & borrowing | ownership, `&T`/`&mut T`, slices, `String` vs `&str` | `hash.rs` |
| 4 | Haskell-grade errors | `Result`/`Option`, `?`, `thiserror`, custom errors | `error.rs` |
| 5 | Enums & pattern matching | enums, `match`, destructuring | `error.rs` + `decide.rs` |
| 6 | Iterators & the stdlib | iterators, `map`/`filter`/`collect`, closures | `hash.rs::sorted`, lockfile |
| 7 | Traits & generics | `Display`, `Clone`, `Default`, generics, `From` | `error.rs`, `manifest.rs` derives |
| 8 | Modules & workspaces | crates, `mod`, workspace layout, feature flags | workspace `Cargo.toml` |
| 9 | Concurrency & async | threads, `Arc`, channels, async/await | `worker.rs`, backend |
| 10 | Tests that prove it | `#[cfg(test)]`, `cargo test`, doc tests | hash `#[test]`s, `tests/` |
| Capstone | Your own `hlock` | compose everything | build a tiny `harness.lock` reader |

Each lesson is beginner-biased with Python/JS/R analogies, and the adaptive
engine adjusts depth and routes review from live performance — so a Pythonista
flies through ownership via `dict`/list analogies while the system deepens
material the moment they struggle.

---

## 5. Roadmap / open work
- WASM rustc backend: compile host `rustc` to wasm and substitute into the
  static `wasm` runner (heavy ~100MB; the interface is ready, adapter stubbed).
- Cloudflare/Vercel adapter for the dynamic server (routing isolation of
  `/api/run` to a sandboxed function + durable object for user model).
- Auth/identity for multi-user progress.
- Additional course authoring helpers (import a GitHub repo's source as corpus).
