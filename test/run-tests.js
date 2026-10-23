// learn-with test suite: compile the course, verify every runnable exercise and
// solution through real rustc, and unit-test the adaptive engine.
const path = require('path');
const assert = require('assert');
const { compile } = require(path.join(__dirname, '..', 'lib', 'compile'));
const { compileRun } = require(path.join(__dirname, '..', 'lib', 'runner', 'subprocess'));
const rules = require(path.join(__dirname, '..', 'lib', 'adaptive', 'rules'));
const { parseLesson } = require(path.join(__dirname, '..', 'lib', 'content'));

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
t('every module has objectives & every exercise has concepts', () => {
  for (const m of course.modules) {
    assert(Array.isArray(m.objectives));
    for (const l of m.lessons) for (const e of [...l.exercises, ...l.quizzes]) assert(e.concepts.length > 0);
  }
});

// --- runnable exercise + solution verification (real rustc) ---
async function verifyAll() {
  console.log('real rustc (this takes ~20-40s)');
  let codeN = 0, passN = 0, errN = 0;
  const intentional = new Set(['moved-value', 'scold-moved', 'struct-derives', 'two-borrows']); // broken starters that teach an error
  for (const m of course.modules) for (const l of m.lessons) {
    for (const e of [...l.exercises, ...l.quizzes]) {
      if (!['code', 'output', 'fill'].includes(e.kind) || !e.start) continue;
      codeN++;
      const r = await compileRun(e.start);
      if (intentional.has(e.id)) { if (r.phase === 'compile') { passN++; continue; } else { errN++; console.log('   ✗ intentional-err exercise now compiles?!', e.id); continue; } }
      if (r.phase === 'compile') { errN++; console.log('   ✗ COMPILE-ERR', `${m.id}/${e.id}`); continue; }
      // solution check
      if (e.solution) {
        const rs = await compileRun(e.solution);
        if (rs.phase === 'compile') { errN++; console.log('   ✗ SOLUTION COMPILE-ERR', `${m.id}/${e.id}`); continue; }
        let ok = true;
        if (e.check && e.check.mode !== 'none') {
          const a = (rs.stdout || '') + (rs.stderr || '');
          ok = e.check.mode === 'exact' ? (rs.stdout || '').trim() === e.check.value.trim() : a.includes(e.check.value);
        } else ok = rs.ok;
        if (ok) passN++; else { errN++; console.log('   ✗ SOLUTION CHECK-FAIL', `${m.id}/${e.id}`); }
      } else {
        if (r.ok) passN++; else { errN++; console.log('   ✗ RUN-ERR', `${m.id}/${e.id}`); }
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
