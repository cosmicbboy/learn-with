// learn-with test suite: compile the course, verify every runnable exercise and
// solution through real rustc, and unit-test the adaptive engine.
const path = require('path');
const assert = require('assert');
const { compile } = require(path.join(__dirname, '..', 'lib', 'compile'));
const { compileRun } = require(path.join(__dirname, '..', 'lib', 'runner', 'subprocess'));
const rules = require(path.join(__dirname, '..', 'lib', 'adaptive', 'rules'));
const { parseLesson } = require(path.join(__dirname, '..', 'lib', 'content'));
const levels = require(path.join(__dirname, '..', 'lib', 'adaptive', 'levels'));
const iterations = require(path.join(__dirname, '..', 'lib', 'adaptive', 'iterations'));

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '-', e.message); } }

// --- adaptive engine unit tests ---
console.log('adaptive engine');
t('observe raises score on correct', () => {
  const um = rules.blankModel();
  const s0 = rules.observe(um, 'ownership', { correct: true });
  const s1 = rules.observe(um, 'ownership', { correct: true });
  assert(s1 > s0 && s1 <= 1);
});
t('observe lowers score on wrong', () => {
  const um = rules.blankModel();
  const s0 = rules.observe(um, 'ownership', { correct: true });
  const s1 = rules.observe(um, 'ownership', { correct: false });
  assert(s1 < s0);
});
t('mastery ladder advances from unknown to mastered', () => {
  const um = rules.blankModel();
  for (let i = 0; i < 10; i++) rules.observe(um, 'enums', { correct: true });
  assert(rules.masteryOf(um, 'enums') === 'mastered');
});
t('renderLayer returns remedial after repeated failure', () => {
  const um = rules.blankModel();
  for (let i = 0; i < 3; i++) rules.observe(um, 'borrowing', { correct: false });
  assert(rules.renderLayer(um, 'borrowing') === 'remedial');
});
t('renderLayer returns deep when mastered', () => {
  const um = rules.blankModel();
  for (let i = 0; i < 12; i++) rules.observe(um, 'borrowing', { correct: true });
  assert(rules.renderLayer(um, 'borrowing') === 'deep');
});

// --- content parser robustness ---
console.log('content parser');
t(':::Notice / unknown directives never emit [object Object]', () => {
  const md = '---\ntitle: t\nconcepts: [a]\n---\n::: Notice\nbe careful\n:::\n::: warning\nheads up\n:::\n:::weird\nkept prose\n:::';
  const l = parseLesson(md, { id: 'x' });
  assert(l.body.some((s) => s.type === 'callout' && s.tone === 'info'));
  assert(l.body.some((s) => s.type === 'callout' && s.tone === 'warn'));
  assert(JSON.stringify(l).indexOf('[object Object]') === -1);
});

t('front matter is real YAML: quoted titles, block-list objectives', () => {
  const md = '---\ntitle: "Ownership — big idea"\nconcepts: [a, b]\nobjectives:\n  - one\n  - two, with a comma\n---\nbody';
  const l = parseLesson(md, {});
  assert.strictEqual(l.title, 'Ownership — big idea');
  assert.deepStrictEqual(l.concepts, ['a', 'b']);
  assert.deepStrictEqual(l.objectives, ['one', 'two, with a comma']);
});
t('mcq options and hints split on | only (commas are content)', () => {
  const md = '---\ntitle: t\n---\n::: exercise id="q" kind="mcq" concepts="a" options="Arc<T>, shared|Vec<T>" answer="0" hints="look, closely|then again" explain="because"\nWhich?\n:::';
  const q = parseLesson(md, {}).exercises[0];
  assert.deepStrictEqual(q.options, ['Arc<T>, shared', 'Vec<T>']);
  assert.deepStrictEqual(q.hints, ['look, closely', 'then again']);
  assert.strictEqual(q.explanation, 'because');
});

t('words inside quoted attribute values never become flags (a hint saying \'until\' must not set until=)', () => {
  const md = '---\ntitle: t\n---\n::: exercise id="q" kind="mcq" concepts="a" options="p|q|r" answer="0" hints="it waits until done" explain="the type of thing"\nWhich?\n:::';
  const q = parseLesson(md, {}).exercises[0];
  assert.strictEqual(q.until, undefined);
  assert.strictEqual(q.level, undefined);
});
// --- New Game+ levels ---
console.log('depth variants (levels)');
t('parseLevel accepts +/++/+++, digits, "depth ++" and rejects nonsense', () => {
  assert.deepStrictEqual(['+', '++', '+++', '0', 2, 'depth ++', undefined].map(levels.parseLevel), [1, 2, 3, 0, 2, 2, 0]);
  assert.throws(() => levels.parseLevel('++++'));
  assert.throws(() => levels.parseLevel('hard'));
});
const LV_MD = [
  '---', 'title: t', 'concepts: [a]', '---',
  '::: callout type="contrast" lang="python"', 'analogy', ':::',
  '::: only level="++"', 'deep notes', ':::',
  '::: exercise id="x" kind="code" concepts="a" check="exact:1"', 'base', '```rust', 'fn main(){}', '```', ':::',
  'between',
  '::: exercise id="x" kind="code" concepts="a" level="+" check="exact:2"', 'plus', '```rust', 'fn main(){}', '```', ':::',
  '::: exercise id="y" kind="mcq" concepts="a" options="p|q|r" answer="0" until="+"', 'q', ':::',
  '::: exercise id="z" kind="mcq" concepts="a" options="p|q|r" answer="0" level="+++"', 'boss', ':::',
].join('\n');
t('itemsFor picks the highest variant <= level, keeps slot order, honours until=', () => {
  const l = parseLesson(LV_MD, {});
  const ids = (L) => levels.itemsFor(l, L).map((e) => `${e.id}:${e.level || 0}`).join(',');
  assert.strictEqual(ids(0), 'x:0,y:0');
  assert.strictEqual(ids(1), 'x:1,y:0');
  assert.strictEqual(ids(2), 'x:1');
  assert.strictEqual(ids(3), 'x:1,z:3');
});
t('bodyFor places the variant in the base slot and drops analogies when rules say so', () => {
  const l = parseLesson(LV_MD, {});
  const kinds = (L, r) => levels.bodyFor(l, L, r).map((g) => g.type === 'exercise' ? `ex:${g.item.id}@${g.item.level || 0}` : g.type === 'callout' ? 'analogy' : g.text.trim()).join('|');
  assert.strictEqual(kinds(0, { analogies: true }), 'analogy|ex:x@0|between|ex:y@0');
  assert.strictEqual(kinds(1, { analogies: true }), 'analogy|ex:x@1|between|ex:y@0');
  assert.strictEqual(kinds(2, { analogies: false }), 'deep notes|ex:x@1|between');
});
t('normalizeLevels: 4 levels, rule defaults, order expands modules and rejects unknown refs', () => {
  const ls = [{ m: 'a', l: '1' }, { m: 'a', l: '2' }, { m: 'b', l: '1' }];
  const n = levels.normalizeLevels([{ level: '++', order: ['b', 'a/2'], rules: { hints: 0 } }], ls);
  assert.strictEqual(n.length, 4);
  assert.deepStrictEqual(n[2].order, ['b/1', 'a/2']);
  assert.strictEqual(n[2].rules.hints, 0);
  assert.strictEqual(n[2].rules.analogies, false);
  assert.deepStrictEqual(n[1].order, ['a/1', 'a/2', 'b/1']);
  assert.throws(() => levels.normalizeLevels([{ level: '+', order: ['nope'] }], ls));
});
t('base-game progress keys are unchanged (old saves keep working); plus levels are namespaced', () => {
  assert.strictEqual(levels.itemKey(0, 'm', 'l', 'e'), 'm/l/e');
  assert.strictEqual(levels.itemKey(2, 'm', 'l', 'e'), '+2:m/l/e');
});
t('higher-level wins weigh more in the mastery model', () => {
  const a = rules.blankModel(), b = rules.blankModel();
  rules.observe(a, 'c', { correct: true, weight: levels.observationWeight(0) });
  rules.observe(b, 'c', { correct: true, weight: levels.observationWeight(3) });
  assert(b.concepts.c.score > a.concepts.c.score);
});

// --- course compile ---
console.log('course compile');
const course = compile('courses/rust-hlock');
t('course has 12 modules & 16 lessons', () => {
  assert(course.modules.length === 12);
  assert(course.modules.reduce((a, m) => a + m.lessons.length, 0) === 16);
});
t('concept map is populated', () => {
  assert(Object.keys(course.conceptMap).length >= 15);
});
t('every lesson has a title without stray quotes and has objectives', () => {
  for (const m of course.modules) for (const l of m.lessons) {
    assert(!/^["']|["']$/.test(l.title), `quoted title: ${l.title}`);
    assert(l.objectives.length > 0, `no objectives: ${m.id}/${l.id}`);
  }
});
t('course has all four levels and every plus-level lesson route resolves', () => {
  assert.strictEqual(course.levels.length, 4);
  for (const lv of course.levels) for (const k of lv.order) {
    const [mid, lid] = k.split('/');
    assert(course.modules.find((m) => m.id === mid).lessons.find((l) => l.id === lid), k);
  }
});
// --- iterations: built from how the previous one went ---
console.log('iterations');
// play a plan: concepts in `weak` go badly, concepts in `ace` go perfectly, the rest OK
function play(plan, { weak = [], ace = [] }) {
  const st = {};
  for (const pl of plan.lessons) for (const it of pl.items) {
    const w = it.concepts.some((c) => weak.includes(c)), a = it.concepts.length && it.concepts.every((c) => ace.includes(c));
    st[it.key] = w ? { attempts: 4, misses: 3, hints: true, solution: true, done: true } : a ? { attempts: 1, firstTry: true, done: true } : { attempts: 2, misses: 1, done: true };
  }
  return st;
}
const mastery = () => 'unknown';
t('iteration 1 is the course as authored: every lesson, every first-pass item, original keys', () => {
  const p1 = iterations.firstPlan(course);
  assert.strictEqual(p1.lessons.length, 16);
  assert(p1.lessons.every((pl) => pl.items.every((it) => it.level === 0)));
  const pl = p1.lessons[0];
  assert.strictEqual(pl.items[0].key, `${pl.m}/${pl.l}/${pl.items[0].id}`);
});
t('aced concepts go deeper, struggled ones stay put with every hint and the solution', () => {
  const p1 = iterations.firstPlan(course);
  const p2 = iterations.nextPlan(course, p1, play(p1, { weak: ['error_handling', 'result_option'], ace: ['ownership', 'borrowing', 'slices', 'string_vs_str', 'lifetimes'] }), mastery, new Set());
  assert.strictEqual(p2.n, 2);
  assert(p2.depth.ownership >= 1 && p2.depth.borrowing >= 1);
  assert.strictEqual(p2.depth.error_handling, 0);
  assert(p2.summary.deeper.includes('ownership') && p2.summary.revisit.includes('error_handling'));
  const ro = p2.lessons.find((pl) => pl.l === 'result-option');
  assert(ro.items.every((it) => it.level === 0 && it.rules.hints === null && it.rules.solution === true));
  const own = p2.lessons.find((pl) => pl.l === 'borrowing-slices');
  assert(own.items.some((it) => it.level >= 1), 'borrowing should get deeper variants');
  assert(own.why.some((w) => w.kind === 'deeper' && w.evidence));
  assert(p2.lessons.every((pl) => pl.items.every((it) => it.key.startsWith('i2:'))), 'iteration 2 keys are namespaced');
});
t('struggling twice in a row steps one deeper anyway (a revisit never loops forever)', () => {
  let p = iterations.firstPlan(course);
  for (let k = 0; k < 2; k++) p = iterations.nextPlan(course, p, play(p, { weak: ['concurrency'] }), mastery, new Set());
  assert.strictEqual(p.n, 3);
  assert.strictEqual(p.depth.concurrency, 1);
  const conc = p.lessons.find((pl) => pl.l === 'concurrency');
  assert(conc.items.every((it) => it.rules.hints === null), 'still fully supported');
});
t('deep iterations take the authored route: orientation skipped, then reordered', () => {
  const p2 = iterations.uniformPlan(course, 2), p3 = iterations.uniformPlan(course, 3);
  assert(!p2.lessons.some((pl) => pl.m === '00-welcome' || pl.m === '01-hello'));
  assert.deepStrictEqual(p3.lessons.map((pl) => pl.m).filter((m, i, a) => a.indexOf(m) === i), course.levels[3].order.map((k) => k.split('/')[0]).filter((m, i, a) => a.indexOf(m) === i));
  assert(p2.lessons.every((pl) => pl.items.every((it) => it.key.startsWith('preview:'))), 'previews never touch real progress');
});
t('a lesson the route drops comes back when it is the only home of a weak concept', () => {
  const c2 = { ...course, conceptMap: { ...course.conceptMap } };
  const p = iterations.buildPlan(c2, { n: 4, depth: Object.fromEntries(Object.keys(course.conceptMap).map((c) => [c, 2])), perf: Object.fromEntries(Object.keys(course.conceptMap).map((c) => [c, { score: c === 'cargo' ? 0.2 : 0.9, cls: c === 'cargo' ? 'weak' : 'strong', evidence: null }])), seen: new Set() });
  const back = p.lessons.find((pl) => pl.returned);
  assert(back && back.m === '00-welcome' && back.returned.includes('cargo'));
});
t('every deeper item is reachable by some iteration', () => {
  const reach = new Set();
  for (let d = 0; d <= 3; d++) for (const pl of iterations.uniformPlan(course, d).lessons) for (const it of pl.items) reach.add(`${pl.m}/${pl.l}/${it.id}@${it.level}`);
  for (const m of course.modules) for (const l of m.lessons) for (const e of [...l.exercises, ...l.quizzes]) {
    if (e.level) assert(reach.has(`${m.id}/${l.id}/${e.id}@${e.level}`), `${m.id}/${l.id}/${e.id} depth ${e.level} is never shown`);
  }
});
t('every plus-level item is on its level\'s route (otherwise nobody can reach it)', () => {
  for (const m of course.modules) for (const l of m.lessons) for (const e of [...l.exercises, ...l.quizzes]) {
    if (e.level) assert(course.levels[e.level].order.includes(`${m.id}/${l.id}`), `${m.id}/${l.id}/${e.id} is depth ${e.level} but the lesson is off that depth's route`);
  }
});
t('every mcq explains its answer', () => {
  for (const m of course.modules) for (const l of m.lessons) for (const q of [...l.exercises, ...l.quizzes]) {
    if (q.kind === 'mcq') assert(q.explanation, `mcq without explain=: ${m.id}/${q.id}`);
  }
});
t('every module has objectives & every exercise has concepts', () => {
  for (const m of course.modules) {
    assert(Array.isArray(m.objectives));
    for (const l of m.lessons) for (const e of [...l.exercises, ...l.quizzes]) assert(e.concepts.length > 0);
  }
});

// --- runnable exercise + solution verification (real rustc) ---
// mirrors computeVerdict in ui/app.js
function passesCheck(r, check) {
  if (check.mode === 'exact') return (r.stdout || '').trim() === check.value.trim();
  return (r.stdout || '').includes(check.value);
}
async function verifyAll() {
  console.log('real rustc (this takes ~20-40s)');
  let codeN = 0, passN = 0, errN = 0;
  const intentional = new Set(['moved-value', 'scold-moved', 'struct-derives', 'two-borrows']); // broken starters that teach an error
  for (const m of course.modules) for (const l of m.lessons) {
    for (const e of [...l.exercises, ...l.quizzes]) {
      if (!['code', 'output', 'fill'].includes(e.kind) || !e.start) continue;
      codeN++;
      const r = await compileRun(e.start);
      // only base items may be intentional compile errors; variants go red via their check
      if (intentional.has(e.id) && !e.level) { if (r.phase === 'compile') { passN++; continue; } else { errN++; console.log('   ✗ intentional-err exercise now compiles?!', e.id); continue; } }
      const tag = `${m.id}/${e.id}${e.level ? '@' + levels.label(e.level) : ''}`;
      if (r.phase === 'compile') { errN++; console.log('   ✗ COMPILE-ERR', tag); continue; }
      // red→green: a starter that already passes its own check teaches nothing
      if (e.check && e.check.mode !== 'none' && passesCheck(r, e.check)) {
        errN++; console.log('   ✗ STARTER ALREADY PASSES (make it a TODO)', tag); continue;
      }
      // solution check
      if (e.solution) {
        const rs = await compileRun(e.solution);
        if (rs.phase === 'compile') { errN++; console.log('   ✗ SOLUTION COMPILE-ERR', tag); continue; }
        const ok = e.check && e.check.mode !== 'none' ? passesCheck(rs, e.check) : rs.ok;
        if (ok) passN++; else { errN++; console.log('   ✗ SOLUTION CHECK-FAIL', tag); }
      } else {
        if (r.ok) passN++; else { errN++; console.log('   ✗ RUN-ERR', tag); }
      }
    }
  }
  console.log(`  → runnable: ${codeN}, passing: ${passN}, errors: ${errN}`);
  return errN === 0;
}

(async () => {
  const ok = await verifyAll();
  console.log(`\n${pass + (ok ? 1 : 0)} assertions passed, ${fail + (ok ? 0 : 1)} failed`);
  await new Promise((r) => setTimeout(r, 300)); // let child processes drain
  process.exit(fail === 0 && ok ? 0 : 1);
})();
