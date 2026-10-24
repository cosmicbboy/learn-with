---
name: learn-with-author
description: 'Author and edit learn-with courses: the course.hl.yml manifest, lesson Markdown plus ::: directives (callouts, exercises, quizzes), output checks, persona-aware callouts, intentional-error exercises, and every parser gotcha learned the hard way (markdown tables, <solution>/<hint> marker stripping, capital/unknown directives that never render [object Object]). Use when writing or editing course content. Trigger words: "write a course", "add an exercise", "lesson markdown", "exercise", "quiz", "callout", "harness.toml course", "edit course content".'
---

# Authoring a learn-with course

A course is two things: a **manifest** (`course.hl.yml`) describing modules/lessons and
objectives, and a set of **Markdown lesson files** with `::: directive` blocks. The
compiler (`lib/compile.js`) reads the manifest, parses each lesson with
`lib/content.js`, and emits a `course.json` manifest consumed by the UI.

## 1. The manifest: `course.hl.yml`

Top-level keys: `id`, `title`, `subtitle`, `author`, `blurb`, `persona`, `defaultDifficulty`,
`project`, and `modules[]`.

- **`persona`** is important: `{ python: 5, javascript: 4, r: 2 }` — the adaptive engine
  reads it to steer analogy depth for the learner.
- Each `module` has `id`, `title`, `blurb`, `objectives[]`, `capstone` (bool, optional),
  and `lessons[]`. Each lesson points at a content file via `file:` and — importantly —
  the lesson's **`concepts` must come from the lesson file's front matter**, not from the
  manifest (the parser only reads `concepts` from front matter).

> **YAML gotcha:** a plain scalar cannot contain `: ` (colon+space) or it parses as a
> nested mapping. Quote titles with colons, e.g. `title: "First Blood: Hello, Rust"`.

## 2. Lesson front matter

Every lesson starts with a `---` front-matter block:

```markdown
---
title: Ownership — the big idea Rust is famous for
concepts: [ownership, string_vs_str]
objectives:
  - Explain ownership, moves, and copies
  - Trace moves through real hlock functions
---
```

`title`, `concepts` (array), and `objectives[]` are all used by the UI. **`concepts` is
required** — every exercise and the lesson must map to concepts so the adaptive engine
can track mastery.

## 3. Directives that render as callouts

```
::: callout type="contrast" lang="python"
In Python you write `d["k"] = v`; in Rust you call `map.insert(...)`.
:::
```

`type` drives the colour (via `data-tone`): base accent, `warn`, `ok`, `challenge`,
`contrast`, `info`. **You don't have to say `callout`** — `::: Notice`, `::: warning`,
`::: caution`, `::: tip`, `::: info`, `::: success`, `::: challenge`, and `::: aside` are
aliases that resolve to the matching tone automatically. This matters: **the renderer
must never show the literal text `[object Object]`** — an unknown directive is rendered
as plain prose of its inner content instead (see `learn-with-ui`).

`::: hint` renders a collapsible hint. `::: concept` renders a concept callout.

## 4. Exercises (runnable code) — the heart of the framework

```
::: exercise id="two-borrows" kind="code" concepts="borrowing,lifetimes" difficulty="3" check="contains:now 2"
Run it, read the E0506 error, then reorder so both shared prints happen before the
mutation. Output: `a=1 b=1` then `now 2`.

```rust
fn main() {
    let mut count = 1;
    let a = &count;
    count += 1;            // E0506: count is borrowed here
    let b = &count;
    println!("a={a} b={b}");
}
```

<solution>
```rust
fn main() {
    let mut count = 1;
    let a = &count;
    println!("a={a} b={b}");
    count += 1;
    println!("now {count}");
}
```
:::
```

Rules and gotchas:

- **`id` is effectively required** — if omitted it's generated from a slice of the goal
  prose, which is ugly and can collide. Always set it.
- **The first fenced `rust` block is the starter code**; the **second `rust` block (e.g.
  under `<solution>`) is the solution**, or label fences `rust:solution`,
  `rust:expected`, `text:expected` explicitly. The parser picks start = first rust block,
  solution = second.
- **`<solution>` / `<hint>` / `<expected>` / `<start>` / `<prompt>` marker lines are
  stripped** from the goal prose by the parser. They must not leak through as literal text
  (a bug we fixed — guard it with a regression test).
- **`kind`**: `code` | `fill` | `predict` | `output` | `mcq`. `predict` (no compiler,
  shows "Reveal expected output") and `mcq` are interacted with, not compiled.
- **`check`** grades real stdout: `exact:<text>` (trimmed equality) | `contains:<text>` |
  `auto` (compare against the `text:expected` block) | `none`. For `kind="output"` with an
  `expected` block, `exact` is implied.
- **Keep goal text, starter code, and `check` consistent.** A frequent author error: the
  prose says one thing but the starter prints something else, so the check fails. The
  automated verifier surfaces exactly this.

## 5. Intentional-error exercises (Splunker pedagogy)

A great way to teach the borrow checker / compiler is to ship **deliberately broken
starter code** that the learner must fix — the *compiler error is the lesson* (this is how
the Rust course teaches `E0382` and `E0506`). If you do this:

- Make sure the starter genuinely fails with the intended error under *real* rustc. (The
  borrow-checker coalesces lifetimes under NLL — an example we shipped initially actually
  *compiled* because the shared borrow ended before the mutation. Test it.)
- Ship a **working solution** and keep the broken starter in a list the test suite treats
  as "intentional" (see `test/run-tests.js`), so `npm test` doesn't fail on it.

## 6. Quizzes (MCQ)

```
::: exercise id="borrow-quiz" kind="mcq" concepts="borrowing" difficulty="2" options="Yes|No — exclusive|Only once|Yes it panics" answer="1"
Can you hold a `&mut Vec<T>` while a shared `&Vec<T>` is still in scope?
:::
```

`options` are separated by `|` (commas/semicolons also work). `answer` is the 0-based
index of the correct option. The UI renders letter-keyed options and reveals the correct
answer on a wrong pick.

## 7. Grounding in a real project (the "Splunking" method)

Learn Rust (or anything) by mining a real codebase: pull authentic snippets into the
prose and exercises, and reference the exact file (`manifest.rs`, `hash.rs`,
`error.rs`, …). Learners with a Python/JS background benefit from a `contrast type="x"
lang="python"|lang="javascript"` callout on each hard idea (ownership vs `dict` aliasing,
`Result` vs exceptions, `String` vs `&str`).

## Minimal checklist before pushing a course

1. `node bin/learn-with.js compile courses/<id>` — zero errors, expected module/lesson/
   exercise/concept counts.
2. `npm test` — every runnable exercise and solution passes real rustc; intentional-error
   starters listed correctly; no `[object Object]` or `<solution>` leaks.
3. In the browser (dynamic server): one code exercise runs and shows a real error then
   passes after the fix; one quiz grades and reveals; the concept-map legend renders.
