---
name: learn-with-adaptive
description: 'The adaptation and agentic layers of learn-with: the deterministic per-concept user model (mastery ladder, forgetting-curve spaced review, difficulty challenge zone, render-layer), the UMD rules engine that runs in both browser and Node, and the on-the-fly agentic practice generator (/api/adapt). Use when tuning, extending, or debugging how a course adapts to a learner or how fresh practice is generated. Trigger words: "adaptive", "mastery", "spaced review", "difficulty", "user model", "next lesson", "generate more practice", "agentic", "/api/adapt", "challenge zone".'
---

# The adaptive + agentic layers

A course is **beginner-biased but adapts fast**. Adaptivity comes from two cooperating
layers: a **deterministic rules engine** (runs client- AND server-side, so it works in
every target) and an **agentic layer** (server-side, generates on-the-fly material).

## The user model (`lib/adaptive/rules.js`)

Per-concept state: `score (0..1)`, `attempts`, `correct`, `streak`, `consecutive_fail`,
`hints_used`, `last_seen`, `seen_count`. `blankModel()` starts empty; `observe(um,
concept, {correct, used_hint})` updates it (asymmetric: failing sinks faster than success,
and using a hint halves the credit).

Key decisions, all pure JS and unit-tested:

- **Mastery ladder**: `unknown → learning → practiced → mastered`, derived from score
  decayed by `recency()` (a forgetting curve — old Mastered concepts get rescheduled).
- **`renderLayer(um, concept, persona)`** returns `base | contrast | deep | remedial` —
  what explanation depth to show. Repeated failure → `remedial`; mastered → `deep`.
- **`challengeZone`** picks a difficulty aiming for ~70–85% success (nudged by win rate and
  recent streak).
- **`pickNext(items, um)`** routes the next item toward mid-mastery concepts / un-touched
  ones / the challenge zone.
- **`scheduleReview(um, concepts)`** surfaces concepts due for spaced review.

**It is UMD**: `module.exports` in Node, `globalThis.LearnWithAdaptive` in the browser —
single source of truth, two environments (`lib/adaptive/rules.js` is served to the client
as `adaptive.js`).

## Persistence

- Browser: `localStorage` (`learnwith.<courseId>`).
- Dynamic server: `POST/GET /api/user` writes a small JSON store behind `dist/.data` in
  `lib/server.js`. Swap for a KV/DB in production.

## The agentic layer (`lib/adaptive/agent.js`)

When the rules can't fully serve you (you're stuck, or you click
**"✨ Generate more practice (agentic)"**), `POST /api/adapt { concept, persona, userId,
difficulty, ... }` fabricates a fresh exercise scoped to the concept + learner profile.
Two backends:

- **Default — synthetic generator** (`synthetic`, dependency-free + deterministic): picks a
  variant from a per-concept template bank in `agent.js` (ownership, borrowing, enums,
  result_option, string_vs_str, traits, iterators, pattern_matching, …), seeded so
  consecutive calls differ.
- **LLM hook** (`llm`): if `LEARN_WITH_AGENT_URL` (+ `LEARN_WITH_AGENT_KEY`,
  `LEARN_WITH_AGENT_MODEL`) is set, it POSTs a chat request asking for a JSON exercise
  grounded in the project, then falls back to the synthetic generator on error.

Generated items reuse the same exercise shape, so they render identically to authored
exercises (verified in QA). When adding a new concept, add a template to the bank so the
agentic layer can generate practice for it.

## Extending

The engine is intentionally modular (`observe`, `masteryOf`, `renderLayer`,
`challengeZone`, `pickNext`, `scheduleReview`, `generate`) — swap or extend any piece.
Changes to `rules.js` touch both Node and browser; add a unit test in `test/run-tests.js`
(e.g. "raises score on correct", "renders remedial after repeated failure", "reaches
mastered after enough corrects").
