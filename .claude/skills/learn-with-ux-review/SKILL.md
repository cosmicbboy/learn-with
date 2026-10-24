---
name: learn-with-ux-review
description: Review and improve the design and usability of a learn-with course interface (ui/app.js, ui/styles.css, ui/index.html) by driving it in a real browser — rendering, the code editor, run/feedback loop, quizzes, navigation and progress, iterations (the Iterate button after finishing, the "Iteration n/N" switcher, adaptive plans built from per-concept performance), adaptive messaging, light/dark theming, accessibility and mobile. Use when asked to QA, polish, or "improve the UI/UX" of a learn-with course, after changing the UI, or before shipping a new course.
---

# UX review for a learn-with course

Review it the way a learner uses it: open it in a browser, read a lesson, get an exercise
wrong, then get it right. Reading the code finds some bugs, but most of the bad ones in
the first audit (broken line numbers, prose that rendered line by line, an invisible banner
in dark mode, starters that pass on their own) only showed up on screen.

## Setup

1. `lsof -i :4000`. The user often has a server running there already, so don't kill it.
   Start your own with `node bin/learn-with.js serve courses/<id> --port 4100` (run it in
   the background).
2. The dynamic server serves `ui/` live and recompiles the course on every request, so
   reload instead of restarting. (`dist/` is only the static build. If what you see
   doesn't match the source, check you're not serving a stale `dist/`.)
3. Use the browser tools (load them in one ToolSearch). Batch navigate, click and screenshot
   steps. To find buttons, `find` beats guessing coordinates.
4. **Phone layout:** the Chrome window may refuse to go below about 1700px. Inject an iframe
   instead and measure overflow:
   ```js
   const f=document.createElement('iframe');f.id='mob';f.src=location.href;
   f.style.cssText='position:fixed;top:0;left:0;width:390px;height:844px;z-index:9999;border:2px solid red';
   document.body.appendChild(f);await new Promise(r=>f.onload=r);await new Promise(r=>setTimeout(r,800));
   const d=f.contentDocument;({sw:d.documentElement.scrollWidth,
     wide:[...d.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>391&&!e.closest('pre,.tbl-wrap,.console,.ed')).map(e=>e.className)})
   ```
   Then `zoom` the region `[0,0,392,840]`, and remove the iframe afterwards.
5. Learner state lives in `localStorage` (`learnwith.<courseId>`, plus
   `learnwith.draft.*`). Clear it to test a first-time visit:
   `Object.keys(localStorage).filter(k=>k.startsWith('learnwith')).forEach(k=>localStorage.removeItem(k))`.

6. **Seeding state (e.g. to test Iterate without playing 44 items).** Write
   `localStorage`, then **reload with `navigate`**. Hash-only navigation doesn't reload,
   and the in-memory model overwrites your edit on its next save. Scripted
   `location.reload()` can also detach the browser extension from the tab. To get a
   realistic iteration 2, seed per-item **stats** as well as `done`, mixing strong and
   weak concepts:
   ```js
   const c = await fetch('/api/course').then(r=>r.json()); const IT = LearnWithIterations;
   const key = 'learnwith.' + c.id; const um = JSON.parse(localStorage.getItem(key)) || {concepts:{},lifetime:{correct:0,attempts:0}};
   um.done = {}; um.it = { plans: [], current: 1, stats: { 1: {} }, offered: {} };
   const weak = ['error_handling'], ace = ['ownership', 'borrowing'];
   for (const pl of IT.firstPlan(c).lessons) for (const it of pl.items) {
     if (it.id === 'move-spotter') continue;      // leave one to finish by hand
     um.done[it.key] = true;
     const w = it.concepts.some(x => weak.includes(x)), a = it.concepts.every(x => ace.includes(x));
     um.it.stats[1][it.key] = w ? {attempts:4,misses:3,hints:true,solution:true,done:true} : a ? {attempts:1,firstTry:true,done:true} : {attempts:2,misses:1,done:true};
   }
   localStorage.setItem(key, JSON.stringify(um));   // then navigate to reload
   ```
7. **Previewing a depth:** put `?depth=++` before the hash
   (`/?depth=++#03-ownership/ownership`). The header reads "Preview · depth 2". Read the
   query raw, because `URLSearchParams` turns `+` into a space. Previews use their own
   progress keys.
8. **The planning engine is testable without a browser.** In Node, run
   `IT.nextPlan(course, plan, stats, masteryOf, seen)` on simulated learners (aces X,
   struggles with Y) and check depth, route, skipped lessons and rules for a few
   iterations. That's faster than clicking, and it catches loops: a weak concept must not
   repeat the same exercise forever.

## The walk-through (do every step, in both themes)

1. **Home, first visit.** Does the blurb read as paragraphs? Is there one obvious "Start"
   action? Is the progress label filled in? Do the concept chips link to lessons? Is each
   lesson's state (empty, partial, ✓) visible?
2. **Open a lesson from halfway down Home.** It should land at the top. Check for
   literal quotes or markup in titles, that objectives are shown, and that the breadcrumb
   works (the module crumb should scroll Home to that module).
3. **Prose.** Hard-wrapped Markdown must form paragraphs, not one `<p>` per line.
   Emphasis spanning a line break must render. Lines should stay near 72ch. Code blocks
   should be highlighted and copyable.
4. **Code exercise.** Check, in order:
   - The gutter has one line number per line, aligned with the code (`white-space: pre`).
   - Run with the button and with ⌘/Ctrl+Enter.
   - Read the verdict *before* the logs. A compile error should read as "the lesson" and
     not as a crash. The temp-dir path should be stripped. Diagnostics shouldn't wrap.
     `E0xxx` codes should link to the error index.
   - On a wrong-output miss, the expected output is shown.
   - Reset works, and a reload restores your draft.
   - Hints are revealed one at a time.
   - "More practice" appears only after a second miss.
   - **Does the untouched starter already pass?** If so, it's a content bug. Use the
     `learn-with-author-course` skill and its audit script with `--run`.
5. **Quiz.** A wrong pick invites a retry instead of revealing the answer. The answer is
   revealed after two misses or a correct pick, with "Why?" opened. Options render
   `code` and `Arc<T>` correctly (escaped, not swallowed as HTML). The right answer isn't
   always "A". Any code snippet the question refers to is shown.
6. **Predict.** It needs a typed commitment before the reveal. Is the answer already
   visible above it?
7. **Progress.** Completing items updates the header count, the lesson's "x/y done", the
   card's ✓ Done state, the module bar on Home, and Continue, which should resume the
   last lesson you visited.
8. **Iterations.** Check, in order:
   - **Before the course is finished there's no trace of iterations:** no switcher, no
     Iterate button, no summary, no mention in the copy. Elements with a `hidden`
     attribute must really be hidden. A component's `display:` rule overrides `[hidden]`
     unless the global `[hidden] { display: none !important }` is in place.
   - Finishing the last item shows **Iterate →** at the top (header), on the Home
     completion card, and in a quiet toast.
   - Iterate builds iteration 2 and switches to it. The header switcher reads
     "‹ Iteration 2/2 ›", and Home shows "How iteration 2 was built from iteration 1":
     going deeper (and what was aced), revisiting with every hint, back for review,
     skipped, new route, and the count of exercises not seen before. The copy must
     match the evidence: don't say "strong" for a concept that was only solid.
   - Each lesson's banner explains why it's there, with evidence ("Deeper on borrowing
     (2/2 first try)", "Revisiting with every hint: result option (5 missed runs,
     solution opened)").
   - Deeper exercise cards carry a "deeper" / "deeper ×2" chip. Hints and solution
     follow the item's rules: every hint for weak concepts, fewer for strong ones.
     `contrast` analogies return in lessons with a weak concept.
   - Each iteration starts at its own first lesson. The resume point is per iteration.
   - "‹" back to 1/2 shows iteration 1 exactly as it was (✓ Done, original exercises),
     and stays on the same lesson when that lesson exists in both. Iterate appears only
     on the latest iteration, once it's complete.
   - Progress and stats are per iteration; concept mastery is shared.
   - **Copy check:** no game words (`new game`, `level up`, `boss`, `unlock`,
     `cleared`, `XP`) and no internal words (`level`, `pass`, `plan`).
9. **Adaptive banner.** It must be learner language ("ownership has been tricky — take
   the hints"), and only appear when it's actionable. Internal vocabulary such as "base
   explanation layer" or "agentic" is a bug.
10. **Dark mode.** Toggle it and repeat steps 1, 4 and 5. Any hard-coded light colour
   (a hex value in a component rule rather than a `--token`) will show up here as
   unreadable text.
11. **Keyboard.** Tab through a lesson. Focus must be visible everywhere. In the editor,
    Tab indents and Escape releases focus. "Skip to content" should appear on the first
    Tab.
12. **Phone width (390px).** No horizontal page scroll. The header collapses (the course
    name and the badge text hide). The editor and console stack. The footer nav stacks.
    The header fits the iteration switcher (the progress bar hides; the count stays), and
    the toast spans the width.

## Design rules for this UI

- **Tokens only.** Every colour is a `--var` on `:root`, redefined under
  `[data-theme="dark"]`. Code surfaces stay dark in both themes, and syntax colours are
  `--tk-*` classes, not inline styles.
- **Verdict first, then evidence.** The console leads with a pass/fail line, then
  labelled `stdout`, `compiler` and `expected` sections.
- **Every action has visible state.** That means a disabled or "Compiling…" Run button,
  ✓ Done on cards, the module bar, and the lesson ring on Home.
- **The hash is the router.** Navigation sets `location.hash` and lets `router()` render.
  Rendering directly as well draws the page twice and breaks Back.
- **Learner-facing copy.** The mode badge says "Live compiler" or "Offline" (with a
  tooltip), never `dynamic · live rustc`. Callout labels say "Coming from Python", not
  `contrast · python`.
- **Show why it adapted.** An adaptive iteration that doesn't explain itself feels
  arbitrary. Every change (deeper, revisit, skip, reorder) has a one-line reason with
  the learner's own evidence.
- **Iterations differ in content, not only in strictness.** If iteration 2 looks like
  iteration 1 with fewer hints, the course is missing depth variants. That's a content
  bug: run the authoring skill's audit, which reports per-depth concept coverage.
- **Reveal, don't advertise.** Iterate appears once it's earned. Locked placeholders
  turn a discovery into a checklist.
- **Browser modules share one global scope.** `rules.js`, `levels.js` and `iterations.js` are plain
  scripts, so wrap a new one in a function scope. Two top-level `const api`s blanked the
  whole page once.
- **Never trap or lose work.** Drafts autosave per exercise, Reset is one click, and
  Escape leaves the editor.
- **Accessible by default.** `aria-live` on the console and quiz feedback, real
  `<button type="button">`s, labelled progress, and `prefers-reduced-motion` honoured.

## Reporting

Put findings in a table with three columns: severity (broken / confusing / polish), what
the learner experiences, and the fix. Fix "broken" items before "polish". After the
fixes, run `npm test` and re-walk the steps you changed in both themes. Attach before
and after screenshots for anything visual.
