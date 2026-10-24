// learn-with: deterministic adaptive engine. Pure JS (runs in browser and Node).
// Maintains a per-concept user model and makes pedagogy decisions: mastery
// ladder, difficulty "challenge zone", render-layer choice, next-item routing,
// and spaced review. The agentic layer (agent.js) builds on these decisions.

const LADDER = ['unknown', 'learning', 'practiced', 'mastered'];
const HOUR = 3600 * 1000;

const DEFAULT_CONCEPT = { score: 0, attempts: 0, correct: 0, streak: 0, consecutive_fail: 0, hints_used: 0, last_seen: 0, seen_count: 0 };

function blankModel() {
  return { concepts: {}, lifetime: { correct: 0, attempts: 0, lessonsCompleted: 0 } };
}

function get(um, concept) {
  if (!um.concepts[concept]) um.concepts[concept] = { ...DEFAULT_CONCEPT, concept };
  return um.concepts[concept];
}

// A forgetting-curve recency factor in [0..1]: decays toward 0 the longer since
// we last saw the concept and the lower its stored strength. Used to discount an
// old Mastered so we still schedule review before it erodes.
function recency(rec, now = Date.now()) {
  if (!rec.last_seen) return 0;
  const ageH = (now - rec.last_seen) / HOUR;
  const strength = Math.min(2, rec.score * 3); // stored strength
  return Math.max(0, 1 - ageH / (strength * 72 + 24)); // half-life grows with mastery
}

// A single observation updates the concept score via a symmetric-asymmetric
// update (fast sink on failure, moderate rise on success), plus hints discount.
function observe(um, concept, observation) {
  const rec = get(um, concept);
  rec.attempts += 1;
  rec.seen_count += 1;
  rec.last_seen = Date.now();
  um.lifetime.attempts += 1;
  const correct = !!observation.correct;
  const usedHint = !!observation.used_hint;

  // weight > 1 = stronger evidence (e.g. solved at New Game++), applied to gains only
  const weight = correct ? Math.max(0, observation.weight || 1) : 1;
  const step = (0.12 + (1 - rec.score) * 0.15) * weight; // bigger steps when far from mastery
  const hintPenalty = usedHint ? 0.5 : 1;
  if (correct) {
    rec.streak += 1;
    rec.consecutive_fail = 0;
    rec.correct += 1;
    rec.score = Math.min(1, rec.score + step * hintPenalty);
    if (usedHint) um.lifetime.correct += 0.5; else um.lifetime.correct += 1;
  } else {
    rec.streak = 0;
    rec.consecutive_fail += 1;
    rec.score = Math.max(0, rec.score - step * 1.6 * hintPenalty);
  }
  return rec.score;
}

function masteryOf(um, concept, now = Date.now()) {
  const rec = get(um, concept);
  const r = recency(rec, now);
  // effective mastery: stored score decayed by recency, floored by streak history
  const eff = rec.score * (0.45 + 0.55 * r);
  if (eff >= 0.8) return 'mastered';
  if (eff >= 0.5) return 'practiced';
  if (eff >= 0.2) return 'learning';
  return 'unknown';
}

function masteryLevelFor(um, concept, now) {
  return masteryOf(um, concept, now);
}

// Render layer: adapt explanation depth to the learner's mastery on the concept
// and the persona. Returns one of base|contrast|deep|remedial.
function renderLayer(um, concept, persona = {}, base = 2) {
  const rec = get(um, concept);
  if (rec.consecutive_fail >= 2 || (rec.attempts >= 2 && rec.score < 0.2)) return 'remedial';
  const lvl = LADDER.indexOf(masteryOf(um, concept));
  if (lvl >= 3) return 'deep';
  return 'base';
}

// Challenge-zone difficulty for a learner: aim for ~70-85% success. Start near
// the learner's average mastery, nudge up on wins, down on losses.
function challengeZone(um, difficulty, opts = {}) {
  const base = opts.base || difficulty;
  let offset = 0;
  const lifetime = um.lifetime.attempts || 0;
  const rate = lifetime ? um.lifetime.correct / lifetime : 0.5;
  if (rate > 0.85) offset = 1;
  else if (rate < 0.65) offset = -1;
  // recent streak
  const wins = Math.min(2, (opts.recentStreak || 0) / 2);
  offset += wins;
  return Math.max(1, Math.min(5, base + offset));
}

// Choose the next item from a candidate list: prefer un-mastered concepts for
// the current lesson, avoid giving the same item twice in a row, prefer items in
// the challenge zone, and interleave review items.
function pickNext(items, um, opts = {}) {
  const candidates = items.filter((it) => it && !opts.excludeIds || (it && !opts.excludeIds.includes(it.id)));
  if (!candidates.length) return items[0] || null;
  const now = Date.now();
  const scored = candidates.map((it) => {
    let s = 0;
    const mastery = it.concepts.map((c) => get(um, c));
    const avgScore = mastery.length ? mastery.reduce((a, b) => a + b.score, 0) / mastery.length : 0;
    const seen = it.concepts.some((c) => recency(get(um, c), now) > 0);
    // favor items whose concepts are mid-mastery (not done, not brand new)
    s += avgScore * 2; // slightly favor what they've touched
    if (!seen) s -= 0.5;
    // challenge zone: item difficulty vs learner rate
    const clearance = Math.abs(it.difficulty - opts.perceived || 3);
    s += (3 - clearance) * 0.4;
    return { it, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].it;
}

// Spaced review: which concepts are due to be seen again (below Mastered with an
// elapsed gap, or Mastered that has decayed below threshold).
function scheduleReview(um, concepts, now = Date.now()) {
  const due = [];
  for (const c of concepts) {
    const rec = get(um, c);
    const lvl = masteryOf(um, c, now);
    if (lvl === 'mastered') {
      if (recency(rec, now) < 0.8) due.push({ concept: c, level: 'mastered', due: true });
    } else if (lvl === 'practiced' || lvl === 'learning') {
      const ageH = rec.last_seen ? (now - rec.last_seen) / HOUR : 9999;
      if (ageH > 2) due.push({ concept: c, level: lvl, due: true });
    } else if (lvl === 'unknown') {
      // untouched: surface early
      due.push({ concept: c, level: 'unknown', due: false });
    }
  }
  return due;
}

const api = {
  LADDER,
  DEFAULT_CONCEPT,
  blankModel,
  get,
  observe,
  masteryOf,
  masteryLevelFor,
  renderLayer,
  challengeZone,
  pickNext,
  scheduleReview,
  recency,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof globalThis !== 'undefined') globalThis.LearnWithAdaptive = api;
