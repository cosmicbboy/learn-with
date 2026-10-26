// learn-with: iterations. Pure JS (UMD: browser + Node).
//
// A learner works through the course once (iteration 1). When they've finished
// it they can Iterate: the next iteration is *built from how the last one went*,
// concept by concept, out of the course's authored depth variants
// (`level="+"`, `"++"`, `"+++"` — see levels.js):
//
//   aced a concept      -> go deeper on it (+1, or +2 if every item was first-try)
//   solid               -> go deeper, but keep hints and the solution available
//   struggled           -> stay at the same depth, with full support and analogies
//                          (twice in a row -> step one deeper anyway, still fully
//                          supported, so a revisit never repeats the same thing forever)
//
// Lessons are ordered by the authored route for the iteration's overall depth
// (`levels[d].order`), lessons with nothing new to offer a strong learner are
// skipped, and lessons a route drops come back if they hold a weak concept.
// A plan is computed once, when the learner hits Iterate, and then frozen.

(function () {
const LV = typeof module !== 'undefined' && module.exports ? require('./levels') : globalThis.LearnWithLevels;
const MAX = LV.MAX_LEVEL;

// ---- scoring the iteration that just finished --------------------------------

// One item's outcome -> how strongly it shows the learner has the concept.
// stats: { attempts, misses, hints, solution, firstTry, done }
function itemScore(st) {
  if (!st || !st.attempts) return null;
  if (!st.done) return 0.3;
  if (st.solution) return 0.25;
  if (st.firstTry) return 1;
  return Math.max(0.4, 0.85 - 0.15 * (st.misses || 0) - (st.hints ? 0.15 : 0));
}

function classify(score) { return score >= 0.85 ? 'strong' : score >= 0.5 ? 'solid' : 'weak'; }

// Per-concept performance over a resolved plan's items. Concepts with no recorded
// attempts (e.g. progress saved before iterations existed) fall back to the
// adaptive model's mastery level.
function conceptPerformance(course, plan, stats, masteryOf) {
  const acc = {};
  for (const pl of plan.lessons) for (const it of pl.items) {
    const st = stats && stats[it.key];
    const sc = itemScore(st);
    for (const c of it.concepts) {
      const a = (acc[c] = acc[c] || { scores: [], items: 0, firstTry: 0, misses: 0, hints: 0, solutions: 0 });
      a.items++;
      if (sc != null) a.scores.push(sc);
      if (st) { a.firstTry += st.firstTry ? 1 : 0; a.misses += st.misses || 0; a.hints += st.hints ? 1 : 0; a.solutions += st.solution ? 1 : 0; }
    }
  }
  const FALLBACK = { mastered: 0.9, practiced: 0.65, learning: 0.4, unknown: 0.3 };
  const out = {};
  for (const c of Object.keys(course.conceptMap || {})) {
    const a = acc[c];
    let score;
    if (a && a.scores.length) score = a.scores.reduce((x, y) => x + y, 0) / a.scores.length;
    else score = FALLBACK[masteryOf ? masteryOf(c) : 'unknown'] || 0.3;
    out[c] = { score: Math.round(score * 100) / 100, cls: classify(score), evidence: a ? { items: a.items, firstTry: a.firstTry, misses: a.misses, hints: a.hints, solutions: a.solutions } : null };
  }
  return out;
}

function nextDepth(d, p, stuck) {
  if (!p) return d;
  if (p.cls === 'weak') return stuck >= 2 ? Math.min(MAX, d + 1) : d;
  const perfect = p.score === 1 && p.evidence && p.evidence.items >= 2;
  return Math.min(MAX, d + (p.cls === 'strong' && perfect ? 2 : 1));
}

// ---- building a plan -----------------------------------------------------------

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const visibleAt = (it, t) => (it.level || 0) <= t && (it.until == null || t <= it.until);

// Pick, for each exercise slot in a lesson, the deepest authored variant at or
// below the depth its concepts call for.
function chooseItems(lesson, depthOf) {
  const all = [...(lesson.exercises || []), ...(lesson.quizzes || [])];
  const slots = new Map();
  for (const e of all) { if (!slots.has(e.id)) slots.set(e.id, []); slots.get(e.id).push(e); }
  const out = [];
  for (const [id, variants] of slots) {
    const concepts = variants[0].concepts || [];
    const t = Math.round(mean(concepts.map(depthOf)));
    const fits = variants.filter((v) => visibleAt(v, t)).sort((a, b) => (b.level || 0) - (a.level || 0));
    if (fits.length) out.push({ item: fits[0], target: t });
  }
  return out;
}

// Rules for one item, from how the learner did on its concepts.
function rulesFor(course, concepts, perf, t) {
  const worst = concepts.map((c) => (perf[c] || {}).cls || 'solid').sort((a, b) => ORDER[a] - ORDER[b])[0] || 'solid';
  if (worst === 'weak') return { hints: null, solution: true };
  if (worst === 'solid') return { hints: 2, solution: true };
  const r = (course.levels && course.levels[t] && course.levels[t].rules) || LV.DEFAULT_LEVELS[t].rules;
  return { hints: r.hints, solution: r.solution };
}
const ORDER = { weak: 0, solid: 1, strong: 2 };

// depth: {concept: 0..3}; perf: conceptPerformance(...) of the previous iteration
// (or null for the first); seen: Set of "m/l/id@level" the learner already did
// first-try (so a strong learner isn't handed the same exercise twice).
function buildPlan(course, { n, depth, perf, seen, prevDepth, stuck }) {
  const depthOf = (c) => (depth[c] == null ? 0 : depth[c]);
  const concepts = Object.keys(course.conceptMap || {});
  const routeDepth = Math.min(MAX, Math.floor(mean(concepts.map(depthOf))));
  const route = (course.levels && course.levels[routeDepth] ? course.levels[routeDepth].order : null)
    || course.modules.flatMap((m) => m.lessons.map((l) => `${m.id}/${l.id}`));
  const index = {};
  for (const m of course.modules) for (const l of m.lessons) index[`${m.id}/${l.id}`] = { m, l };

  const planLesson = (key) => {
    const { m, l } = index[key];
    const chosen = chooseItems(l, depthOf);
    const lc = l.concepts || [];
    const lessonDepth = Math.max(0, ...chosen.map((c) => c.item.level || 0), Math.round(mean(lc.map(depthOf))));
    const weak = perf ? lc.filter((c) => perf[c] && perf[c].cls === 'weak') : [];
    const levelRules = (course.levels && course.levels[lessonDepth] && course.levels[lessonDepth].rules) || LV.DEFAULT_LEVELS[lessonDepth].rules;
    const items = chosen.map(({ item, target }) => ({
      id: item.id, level: item.level || 0, key: itemKey(n, m, l, item), concepts: item.concepts || [],
      rules: perf ? rulesFor(course, item.concepts || [], perf, item.level || 0) : { hints: levelRules.hints, solution: levelRules.solution },
      fresh: !seen || !seen.has(`${m.id}/${l.id}/${item.id}@${item.level || 0}`),
    }));
    const why = perf ? lc.map((c) => {
      const before = prevDepth ? (prevDepth[c] || 0) : 0;
      const kind = depthOf(c) > before ? 'deeper' : (perf[c] && perf[c].cls === 'weak') ? 'revisit' : 'steady';
      return { concept: c, kind, score: perf[c] ? perf[c].score : null, evidence: perf[c] ? perf[c].evidence : null };
    }) : [];
    return { m: m.id, l: l.id, depth: lessonDepth, analogies: weak.length > 0 || levelRules.analogies !== false, items, why };
  };

  const lessons = [];
  const skipped = [];
  for (const key of route) {
    if (!index[key]) continue;
    const pl = planLesson(key);
    if (!pl.items.length) { skipped.push({ m: pl.m, l: pl.l, reason: 'empty' }); continue; }
    // nothing new and every concept already strong -> don't make them redo it
    const allStrong = perf && (index[key].l.concepts || []).every((c) => perf[c] && perf[c].cls === 'strong');
    if (perf && allStrong && pl.items.every((it) => !it.fresh)) { skipped.push({ m: pl.m, l: pl.l, reason: 'mastered' }); continue; }
    lessons.push(pl);
  }
  // a lesson the route drops comes back if it's the only home of a weak concept
  if (perf) {
    const covered = new Set(lessons.flatMap((pl) => index[`${pl.m}/${pl.l}`].l.concepts || []));
    for (const key of Object.keys(index)) {
      if (route.includes(key)) continue;
      const lc = index[key].l.concepts || [];
      const orphanWeak = lc.filter((c) => perf[c] && perf[c].cls === 'weak' && !covered.has(c));
      if (!orphanWeak.length) continue;
      const pl = planLesson(key);
      if (!pl.items.length) continue;
      pl.returned = orphanWeak;
      lessons.unshift(pl); // review before going deeper
      orphanWeak.forEach((c) => covered.add(c));
    }
  }
  const summary = { deeper: [], revisit: [], steady: [] };
  if (perf) for (const c of concepts) {
    const k = depthOf(c) > ((prevDepth || {})[c] || 0) ? 'deeper' : perf[c] && perf[c].cls === 'weak' ? 'revisit' : 'steady';
    summary[k].push(c);
  }
  return {
    n, createdAt: Date.now(), depth: { ...depth }, perf: perf || null, stuck: stuck || {}, routeDepth,
    lessons, skipped, summary,
    fresh: lessons.reduce((a, pl) => a + pl.items.filter((it) => it.fresh).length, 0),
  };
}

// Iteration 1: the course as authored, at depth 0.
function firstPlan(course) {
  const depth = {};
  for (const c of Object.keys(course.conceptMap || {})) depth[c] = 0;
  return buildPlan(course, { n: 1, depth, perf: null });
}

// Author preview: every concept at one depth, with that depth's default rules.
function uniformPlan(course, d) {
  const depth = {};
  for (const c of Object.keys(course.conceptMap || {})) depth[c] = d;
  const plan = buildPlan(course, { n: 0, depth, perf: null });
  plan.preview = d;
  return plan;
}

// Build iteration n+1 from iteration n's plan and its recorded outcomes.
function nextPlan(course, prev, stats, masteryOf, seen) {
  const perf = conceptPerformance(course, prev, stats, masteryOf);
  const depth = {}, stuck = {};
  for (const c of Object.keys(course.conceptMap || {})) {
    stuck[c] = perf[c] && perf[c].cls === 'weak' ? ((prev.stuck || {})[c] || 0) + 1 : 0;
    depth[c] = nextDepth((prev.depth || {})[c] || 0, perf[c], stuck[c]);
  }
  return buildPlan(course, { n: prev.n + 1, depth, perf, seen, prevDepth: prev.depth, stuck });
}

// Progress key: iteration 1 keeps the original keys, so existing saves still count.
function itemKey(n, m, l, e) {
  const k = `${m.id || m}/${l.id || l}/${e.id || e}`;
  if (n === 1) return k;
  return n > 1 ? `i${n}:${k}@${e.level || 0}` : `preview:${k}@${e.level || 0}`;
}

const api = { itemScore, classify, conceptPerformance, nextDepth, chooseItems, buildPlan, firstPlan, uniformPlan, nextPlan, itemKey };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof globalThis !== 'undefined') globalThis.LearnWithIterations = api;
})();
