// learn-with: depth variants ("levels"). Pure JS (UMD: browser + Node).
//
// Authored content comes in up to four depths per exercise slot: the base item
// (0) and deeper variants with the same id and `level="+"` (1), `"++"` (2),
// `"+++"` (3). This module parses depths, resolves which variant a slot shows at a
// depth, filters prose/callouts gated with `level=`/`until=`, and holds per-depth
// defaults (rules, lesson route) from the manifest's `levels:`. Which depth each
// concept gets in a learner's next iteration is decided by iterations.js.
// Wrapped in a function scope: in the browser this shares the global script
// scope with rules.js, and two top-level `const api`s collide.
(function () {
const MAX_LEVEL = 3;
const SHORT = ['', '+', '++', '+++'];

// Rule defaults per level; a course may override any field per level.
//   hints:      max hints revealed (null = all the author wrote)
//   solution:   true = always available, false = never, n = after n failed runs
//   analogies:  show persona "Coming from Python" callouts
const DEFAULT_LEVELS = [
  { name: 'Depth 0', tagline: 'The course as authored.', rules: { hints: null, solution: true, analogies: true } },
  { name: 'Depth 1', tagline: 'A twist on each concept: edge cases, two ideas at once, less scaffolding.', rules: { hints: 2, solution: true, analogies: true } },
  { name: 'Depth 2', tagline: 'Problems shaped like real-world code.', rules: { hints: 1, solution: 3, analogies: false } },
  { name: 'Depth 3', tagline: 'Spec only, from scratch.', rules: { hints: 0, solution: false, analogies: false } },
];

// "+", "++", "+++", "ng+", "1", 2 … -> 0..3 (throws on nonsense so authors hear about typos)
function parseLevel(x) {
  if (x == null || x === '' || x === true) return 0;
  if (typeof x === 'number') return clamp(x);
  const s = String(x).trim().toLowerCase().replace(/^(?:pass|depth)\s*/, '');
  if (/^\++$/.test(s)) return clamp(s.length);
  if (/^\d+$/.test(s)) return clamp(parseInt(s, 10));
  if (s === 'base' || s === '0') return 0;
  throw new Error(`unknown level "${x}" (use +, ++, +++ or 0-3)`);
}
function clamp(n) {
  if (n < 0 || n > MAX_LEVEL) throw new Error(`level ${n} out of range 0-${MAX_LEVEL}`);
  return n;
}

// Short marker for messages: "+", "++", "+++" (depth 0 is "base").
function label(level) { return level ? SHORT[level] : 'base'; }

// Normalize course.levels (author overrides) onto the defaults: always 4 entries.
function normalizeLevels(raw, courseLessons) {
  const byLevel = {};
  for (const entry of raw || []) byLevel[parseLevel(entry.level)] = entry;
  const all = courseLessons.map((x) => `${x.m}/${x.l}`);
  return DEFAULT_LEVELS.map((d, level) => {
    const o = byLevel[level] || {};
    const order = expandOrder(o.order, courseLessons, level);
    return {
      level,
      short: SHORT[level],
      name: o.name || d.name,
      tagline: o.tagline || d.tagline,
      note: o.note || null, // shown to learners when an iteration switches to this depth's route
      rules: { ...d.rules, ...(o.rules || {}) },
      order: order || all,
    };
  });
}

// `order` entries are module ids (expands to all its lessons, in course order)
// or "module/lesson". Anything not listed is skipped at that level.
function expandOrder(order, courseLessons, level) {
  if (!order) return null;
  const out = [];
  for (const ref of order) {
    const r = String(ref);
    const hits = r.includes('/') ? courseLessons.filter((x) => `${x.m}/${x.l}` === r) : courseLessons.filter((x) => x.m === r);
    if (!hits.length) throw new Error(`levels[${level}].order: "${r}" matches no module or lesson`);
    for (const h of hits) { const k = `${h.m}/${h.l}`; if (!out.includes(k)) out.push(k); }
  }
  return out;
}

const visible = (seg, level) => (seg.level || 0) <= level && (seg.until == null || level <= seg.until);

// For one lesson at one level: which version of each exercise slot to show.
// A slot is an exercise id; the variant with the highest level <= current wins
// and is rendered where the slot first appears in the body.
function itemsFor(lesson, level) {
  const items = [...(lesson.exercises || []), ...(lesson.quizzes || [])].filter((e) => visible(e, level));
  const best = new Map();
  for (const e of items) {
    const cur = best.get(e.id);
    if (!cur || (e.level || 0) > (cur.level || 0)) best.set(e.id, e);
  }
  const seen = new Set();
  const out = [];
  for (const e of items) if (!seen.has(e.id)) { seen.add(e.id); out.push(best.get(e.id)); }
  return out;
}

// Body segments to render at a level, with exercise slots resolved. `chosen`
// (id -> item) overrides the slot choice, e.g. with an iteration's plan.
function bodyFor(lesson, level, rules, chosen) {
  chosen = chosen || new Map(itemsFor(lesson, level).map((e) => [e.id, e]));
  const placed = new Set();
  const out = [];
  for (const seg of lesson.body || []) {
    if (seg.type === 'exercise' || seg.type === 'quiz') {
      const id = seg.item.id;
      if (placed.has(id) || !chosen.has(id)) continue;
      placed.add(id);
      out.push({ ...seg, item: chosen.get(id) });
      continue;
    }
    if (!visible(seg, level)) continue;
    if (seg.type === 'callout' && seg.tone === 'contrast' && rules && rules.analogies === false) continue;
    out.push(seg);
  }
  return out;
}

// The lesson sequence at a level, as [{m, l}] objects from the course.
function sequence(course, level) {
  const lv = (course.levels || [])[level];
  const index = {};
  for (const m of course.modules) for (const l of m.lessons) index[`${m.id}/${l.id}`] = { m, l };
  const keys = lv ? lv.order : Object.keys(index);
  return keys.map((k) => index[k]).filter(Boolean);
}

// Progress key for an item at a uniform depth (depth 0 keeps the original keys).
function itemKey(level, m, l, e) {
  const k = `${m.id || m}/${l.id || l}/${e.id || e}`;
  return level ? `+${level}:${k}` : k;
}

// Higher levels are stronger evidence of mastery.
function observationWeight(level) { return 1 + 0.5 * (level || 0); }

const api = { MAX_LEVEL, SHORT, DEFAULT_LEVELS, parseLevel, label, normalizeLevels, itemsFor, bodyFor, sequence, itemKey, observationWeight };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof globalThis !== 'undefined') globalThis.LearnWithLevels = api;
})();
