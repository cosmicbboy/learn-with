---
name: learn-with-author-course
description: Author or revise a learn-with course — the course.hl.yml manifest, Markdown lessons with ::: directives, code/mcq/predict exercises graded by real rustc, and iterations (after finishing, "Iterate" builds the next iteration from the learner's per-concept performance, using authored depth variants and routes). Use when creating a new course under courses/, adding or editing lessons or exercises, writing hints/quiz explanations, adding deeper variants for iterations, or when exercises feel too easy, can't be completed, or render wrong. Encodes the exercise-design rules (red→green starters, tight checks, progressive hints) and the verification loop.
---

# Authoring a learn-with course

A course is `courses/<id>/course.hl.yml` plus `content/**/*.md`. `lib/content.js` parses
lessons, `lib/compile.js` builds `course.json`, and `ui/app.js` renders it. The learner
reads the prose, edits code in the browser and hits **Run**. In dynamic mode real `rustc`
compiles their code and their stdout is graded against the exercise's `check`.

The rules below come from a full UX audit of the first course (`rust-hlock`). Each one is
a bug that actually shipped. Read "Exercise design" before writing any exercise.

## Workflow

1. Plan the arc in `course.hl.yml`: `id`, `title`, `subtitle`, `blurb`, `persona`,
   `project.repo`, and `modules[]` with `objectives[]` and `lessons[]` (`id`, `title`,
   `file`). Put titles in plain YAML. Quote them only when YAML needs it (e.g. a title
   containing `: `).
2. Write each lesson (format below). Keep one idea per section and include at least one
   exercise per lesson. Reading-only lessons lose the learner.
3. Preview the course live with `node bin/learn-with.js serve courses/<id> --port 4100`. Port
   4000 is often taken, so check `lsof -i :4000` first. The server recompiles the course on
   every `/api/course` request and serves `ui/` directly, so **reload the page** after
   editing a lesson or the UI. No restart is needed. (`serverless/vercel.js` pins with
   `live: false`.)
4. Verify:
   - `node .claude/skills/learn-with-author-course/scripts/audit-course.js courses/<id>`
     runs the static checks instantly.
   - Add `--run` to compile every starter and solution with real rustc. It flags
     **ALREADY GREEN** starters and solutions that fail their own check.
   - Add `--only 03-,04-` to limit the audit to some modules, e.g. while several
     people are editing different modules.
   - `npm test` runs the full suite. It enforces red→green, objectives on every lesson,
     `explain=` on every mcq, and solutions that pass.
5. Click through it in a browser with the `learn-with-ux-review` skill before calling it
   done.

## Lesson file format

```md
---
title: Ownership — the big idea Rust is famous for
concepts: [ownership, string_vs_str]
objectives:
  - Explain ownership, moves, and copies
  - Trace moves through real hlock functions like sha256_bytes
---

## A heading per idea

Hard-wrap prose freely: consecutive lines join into one paragraph, and a blank line
starts a new one. *Emphasis can span a line break.* An indented line after a list item
continues that item.
```

- Front matter is parsed with js-yaml, so block lists, quoted strings and `[a, b]` all
  work. `objectives` are shown at the top of the lesson as "By the end you can". Write
  them as learner abilities, starting with a verb.
- `concepts` are the atoms the adaptive model tracks. Reuse existing concept ids (see
  `DEFAULT_SKILLS` in `lib/compile.js`) and add a summary there for any new one, because
  that summary is the concept chip's tooltip on Home.
- Use ```` ```rust ```` fences. Read-only Rust blocks are syntax-highlighted and get a
  Copy button.

### Callouts

`::: callout type="contrast" lang="python"` renders with the label **"Coming from
Python"**. The other tones are `challenge`, `warn`, `info`, `tip` and `ok`, and the
aliases `::: warning`, `::: tip`, `::: note` and so on work too. Add `title="…"` to
override the label. Use `contrast` callouts for persona analogies: one idea per callout,
mapped from the learner's language.

## Exercise design (the rules that matter)

```md
::: exercise id="make-owned" kind="code" concepts="ownership,expression" difficulty="2" check="exact:sha256 rules" hints="The function must *return* the String, so look at the last line|A trailing expression with no semicolon is the return value|End the function with just `s`"
Finish `brand()` so it builds the owned `String` "sha256 rules" and returns it.
Expected output: `sha256 rules`.

```rust
fn main() {
    println!("{}", brand());
}

fn brand() -> String {
    let mut s = String::from("sha256 ");
    todo!("append \"rules\" and return s")
}
```

<solution>
```rust
… the finished program …
```
:::
```

1. **Red → green, always.** The starter must **compile but fail the check**. Put
   `todo!()` where a value is needed, or leave a `// TODO:` gap with wrong output. A
   starter that already passes lets the learner get the ✓ by clicking Run without
   reading a word. In the first course, 24 of 28 exercises shipped like that. Starters
   that fail to compile are only for exercises whose *point* is the compiler error. List
   those ids in the `intentional` set in `test/run-tests.js`.
2. **Checks must prove the concept.** `check="exact:<stdout>"` compares trimmed stdout.
   `check="contains:<substr>"` searches stdout only (rustc errors echo source lines, so stderr would let a compile error pass). A `contains:5` passes on almost
   anything. Prefer `exact:` for single-line output, and a distinctive `contains:` for
   multi-line output, since attributes can't hold newlines. Without a check, any clean
   compile counts as correct. Use that only for "make it compile" exercises.
3. **State the target in the prose.** Say exactly what to change and what the expected
   output is. The console's placeholder also shows `Expected: …` for `exact` checks.
4. **Progressive hints.** Give 2–3 hints in `hints="…|…|…"`, separated by `|` (commas are
   fine inside a hint). The UI reveals one per click, and using any hint or opening the
   solution halves the mastery gain, so hint 1 should be a gentle nudge and the last one
   nearly the answer. Never put a `"` inside an attribute value. Use `'` or backticks
   instead.
5. **Always include a `<solution>`.** It's the escape hatch for stuck learners, and the
   tests verify that it passes the check.
6. **`difficulty` runs 1–5** and shows as dots. Use 1–2 for "change one line", 3 for
   "write a small function", and 4–5 for capstone composition.

### Quizzes (`kind="mcq"`)

- `options="A|B|C|D"` (split on `|` only) and `answer="<0-based index>"`. The UI shows the
  options in a stable shuffled order, so authoring the right answer first is fine. Don't
  rely on letters ("see option B") in the prose.
- **Always add `explain="…"`.** It opens after a correct answer or after two misses. A
  learner who misses with no "why" learns nothing.
- Put the code a question is about in a ```` ```rust ```` block inside the directive. It
  renders above the question.
- Wrong options should be *plausible misconceptions* (e.g. "it copies, like Python"),
  not jokes.

### Predict (`kind="predict"`)

The learner types a prediction before seeing the answer. The ```` ```text:expected ````
block is the answer. Matching ignores case and collapses whitespace. **The answer must not
be visible in the prose or code right above it.** The first course asked learners to count
workspace members right under a code block listing them. A good predict asks what a
program prints, or which line errors.

## Iterations: each one built from how the last went

The learner just works through the course. When they've finished every item, an
**Iterate** button appears at the top. Clicking it builds **iteration 2** from how
iteration 1 went, and the header shows a switcher, "‹ Iteration 2/2 ›". The learner can
step back to 1/2 any time to revisit the material. Finishing 2/2 offers Iterate again,
which builds 3/3, and so on. Earlier iterations stay exactly as they were.

The engine is `lib/adaptive/iterations.js`. Nothing about iterations appears until the
course is finished: no panel, no locked tiles, no levels, no game language. Don't
mention iterations in lesson prose or the blurb.

### How the next iteration is built

Every run, quiz pick and prediction records attempts, misses, hints used, solution
opened, and first-try success per item, per iteration. On Iterate, each concept gets a
score from its items: first try = 1, the solution opened = 0.25, otherwise 0.4–0.85
minus misses and hints. That score sets the concept's **depth** (0–3) for the next
iteration:

| how it went | next depth | support |
|---|---|---|
| strong (≥ 0.85) | +1, or +2 if every item was first try | that depth's default rules (fewer hints) |
| solid (≥ 0.5) | +1 | 2 hints, solution available |
| weak | same; +1 after two weak iterations in a row | every hint, solution, analogies back on |

Then the plan:
- **Exercises:** each exercise slot shows the deepest authored variant at or below
  its concepts' depth.
- **Order:** lessons follow the authored route for the iteration's overall depth.
- **Skipping:** a lesson is dropped when all its concepts are strong and it has
  nothing the learner hasn't already done first try.
- **Review:** a lesson the route drops comes back first ("Back for review") if it's
  the only home of a weak concept.

The plan is frozen when it's built, and the UI shows the learner why: a "How iteration
N was built" summary on Home, and a one-line "Deeper on X (3/3 first try)" or
"Revisiting with every hint: Y (5 missed runs, solution opened)" banner per lesson.

### What you author: depth variants and routes

The engine can only be as adaptive as the material it has to choose from. For every
concept, write deeper versions of its exercises, so a strong learner has somewhere to
go:

- **Depth 1 (`level="+"`), a twist:** the same concept with an edge case, a second
  concept folded in, or less scaffolding (more `todo!()`, fewer given lines).
- **Depth 2 (`level="++"`), the real thing:** shaped like the real project's code.
  Use the actual signatures (for hlock: `manifest.rs`, `hash.rs`, `error.rs`, the
  worker), with realistic data and failure paths. Only call something "hlock's" if
  it's quoted in the lessons; otherwise say "shaped like".
- **Depth 3 (`level="+++"`), spec only:** the starter is little more than `fn main`
  and `todo!()`s. Compose several concepts and let the learner design the types.
  Difficulty 4–5.

```md
::: exercise id="make-owned" kind="code" … level="+" difficulty="3" check="exact:…" hints="…|…|…"
Harder goal …
```rust
starter …
```
<solution>
```rust
solution …
```
:::
```

- **A variant reuses the base exercise's `id` and adds `level=`.** Put it right after
  the base exercise. An item with a **new** id and `level="++"` only appears once a
  concept reaches depth 2. `until="++"` retires an item beyond depth 2 (e.g. capstone
  checkpoints that the depth-3 builds replace).
- Deeper prose goes in `::: only level="++"` … `:::`. Callouts accept `level=` and
  `until=` too. `contrast` callouts (analogies) are dropped at depth ≥ 2 unless a
  lesson concept is weak.
- Variants follow every exercise rule above, and more strictly:
  - The starter compiles and fails the check. A variant must **compile** even when the
    base is an intentional compile error.
  - Give 2–3 hints, gentlest first, since stronger learners see only the first one or
    two.
  - Include a solution and raise `difficulty`.
- Tag concepts accurately on every variant, because the scores are per concept. A
  mis-tagged item sends the wrong concept deeper.
- Coverage: the audit warns when a lesson's concept has no item written for a depth.
  Aim for zero, so that every concept can keep getting deeper.

```yaml
# course.hl.yml — optional per-depth defaults and routes
levels:
  - level: "++"
    order: [02-manifest, 03-ownership, 04-errors/result-option, …]   # module ids or module/lesson
    note: "the orientation lessons are behind you, so this iteration starts at the manifest."
    rules: { hints: 1, solution: 3, analogies: false }
```

`order` is the route an iteration takes once its average depth reaches that value.
`note` is shown to the learner when an iteration switches to that route, so make it say
why. Rule defaults are depth 0: all hints; 1: 2 hints; 2: 1 hint with the solution after
3 misses; 3: no hints or solution. Rules apply only to concepts the learner was strong
on.

Preview a depth without playing through by adding `?depth=++` before the hash (e.g.
`http://localhost:4100/?depth=+++#02-manifest/structs-and-derives`). Previews use their
own progress keys and never touch the learner's iterations.

## Persona and tone

- `persona` in the manifest (e.g. `python: 5, javascript: 4, r: 2`) drives the chips on
  Home and the callout analogies. Write `contrast` callouts for the learner's strongest
  languages.
- Teach against the real project (`project.repo`): quote real functions, then have the
  learner write their own small version.
- Don't write UI copy into lessons ("click the purple button"). The UI owns its labels.

## Gotchas

- Inside a `::: directive` body, a line that starts with `:::` closes the block. A
  closing `:::` must sit on its own line. (Before a parser fix, prose directly after a
  closing `:::` was mistaken for a new directive and silently swallowed.)
- Header attributes are `key="value"`; bare words in the header become boolean
  attributes, and a `|` inside a hint splits it — write closures out in words.
- Double-check every mcq `answer=` against its `explain=` — the first course shipped
  a quiz whose marked answer contradicted its own explanation.
- An unknown directive renders as plain prose. It never shows `[object Object]`.
- An exercise `id` is the progress key in learners' saved state. Renaming one resets
  progress on it, and saved drafts are keyed by it too.
- Code in a directive is removed from the goal prose: the first rust block is the
  starter (or the mcq snippet), the second is the solution, and `text:expected` is the
  predict answer. Prose code you want shown inline should use backticks.
