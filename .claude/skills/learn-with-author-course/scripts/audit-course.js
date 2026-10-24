#!/usr/bin/env node
// Audit a learn-with course for the pedagogy/UX problems that the renderer
// can't fix on its own. Static checks are instant; --run also compiles every
// starter + solution with the course runner (real rustc) to catch "already-green"
// exercises whose starter already satisfies its own check.
//
//   node .claude/skills/learn-with-author-course/scripts/audit-course.js courses/<id> [--run] [--only 03-,04-]
//
// --only limits findings to modules whose id starts with one of the prefixes.
//
// Exit code 1 if any ERROR is found (warnings don't fail).

const path = require('path');
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const { compile } = require(path.join(repo, 'lib', 'compile'));

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || 'courses/rust-hlock');
const RUN = args.includes('--run');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? String(args[onlyIdx + 1] || '').split(',').filter(Boolean) : null;
const inScope = (mid) => !ONLY || ONLY.some((p) => mid.startsWith(p));

const findings = [];
const add = (level, where, msg) => findings.push({ level, where, msg });

function passes(r, check) {
  if (check.mode === 'exact') return (r.stdout || '').trim() === check.value.trim();
  return (r.stdout || '').includes(check.value);
}

(async () => {
  let course;
  try { course = compile(dir); } catch (e) { console.error('ERROR course does not compile:', e.message); process.exit(1); }

  for (const m of course.modules) {
    if (!inScope(m.id)) continue;
    if (!m.objectives || !m.objectives.length) add('WARN', m.id, 'module has no objectives');
    for (const l of m.lessons) {
      const where = `${m.id}/${l.id}`;
      if (/^["']|["']$/.test(l.title)) add('ERROR', where, `title has literal quotes: ${l.title}`);
      if (!l.objectives.length) add('WARN', where, 'lesson has no objectives (front matter `objectives:` list)');
      const items = [...l.exercises, ...l.quizzes];
      if (!items.length) add('WARN', where, 'lesson has no exercises — reading-only lessons lose the learner');
      for (const e of items) {
        const w = `${where}/${e.id}${e.level ? `@depth${e.level}` : ''}`;
        if (!e.concepts.length) add('ERROR', w, 'item has no concepts= (the adaptive model cannot track it)');
        if (e.kind === 'mcq') {
          if (!e.explanation) add('WARN', w, 'mcq has no explain= (learners who miss get no "why")');
          if ((e.options || []).length < 3) add('WARN', w, 'mcq has fewer than 3 options');
          if (e.answer == null || !e.options[Number(e.answer)]) add('ERROR', w, `mcq answer=${e.answer} does not index an option`);
        }
        if (e.kind === 'predict' && e.expected == null) add('ERROR', w, 'predict has no ```text:expected block — it can never be completed');
        if (['code', 'fill', 'output'].includes(e.kind)) {
          if (!e.start) add('ERROR', w, 'code exercise has no starter ```rust block');
          if (!e.solution) add('WARN', w, 'no <solution> block — "Show solution" is the escape hatch for stuck learners');
          if (!e.hints || !e.hints.length) add('WARN', w, 'no hints= (use 2–3 progressive nudges separated by |)');
          if (!e.check || e.check.mode === 'none') add('WARN', w, 'no check= — any clean compile counts as correct');
          else if (e.check.mode === 'contains' && e.check.value && e.check.value.trim().length <= 2) add('WARN', w, `weak check "${e.check.mode}:${e.check.value}" — almost any output passes`);
          if (e.start && e.solution && e.start.trim() === e.solution.trim()) add('ERROR', w, 'starter is identical to the solution');
        }
      }
    }
  }

  // Depth coverage: for each depth, every concept a routed lesson teaches should
  // have at least one item written at that depth — otherwise when an iteration
  // sends a strong learner deeper on it, there's nothing deeper to show.
  for (const lv of course.levels.slice(1)) {
    const route = lv.order.map((k) => k.split('/'));
    for (const [mid, lid] of route) {
      if (!inScope(mid)) continue;
      const l = course.modules.find((m) => m.id === mid).lessons.find((x) => x.id === lid);
      const items = [...l.exercises, ...l.quizzes];
      for (const c of l.concepts) {
        const has = items.some((e) => e.level === lv.level && e.concepts.includes(c));
        if (!has) add('WARN', `${mid}/${lid}`, `no depth-${lv.level} item for concept "${c}" (a strong learner can't go deeper on it here)`);
      }
    }
    for (const m of course.modules) for (const l of m.lessons) {
      if (!inScope(m.id) || lv.order.includes(`${m.id}/${l.id}`)) continue;
      if ([...l.exercises, ...l.quizzes].some((e) => e.level === lv.level)) add('WARN', `${m.id}/${l.id}`, `has depth-${lv.level} items but the lesson is not on the depth-${lv.level} route (order:) — they only appear if the lesson returns for review`);
    }
  }

  if (RUN) {
    const { compileRun } = require(path.join(repo, 'lib', 'runner', 'subprocess'));
    for (const m of course.modules) for (const l of m.lessons) for (const e of l.exercises) {
      if (!inScope(m.id) || !['code', 'fill', 'output'].includes(e.kind) || !e.start) continue;
      const w = `${m.id}/${l.id}/${e.id}${e.level ? `@depth${e.level}` : ''}`;
      const r = await compileRun(e.start);
      const hasCheck = e.check && e.check.mode !== 'none';
      // pass variants must compile; a first-pass starter may fail on purpose
      if (r.phase === 'compile') add(e.level ? 'ERROR' : 'WARN', w, e.level ? 'starter does not compile (depth variants must compile and go red via their check)' : 'starter does not compile — fine only if the compiler error is the lesson (list it in test/run-tests.js `intentional`)');
      if (hasCheck && passes(r, e.check)) add('ERROR', w, 'ALREADY GREEN: the starter already passes its check — replace the key line with todo!() or a TODO');
      if (e.solution) {
        const s = await compileRun(e.solution);
        if (s.phase === 'compile') add('ERROR', w, 'solution does not compile');
        else if (hasCheck && !passes(s, e.check)) add('ERROR', w, `solution fails its own check (${e.check.mode}:${e.check.value})`);
      }
    }
  }

  const order = { ERROR: 0, WARN: 1 };
  findings.sort((a, b) => order[a.level] - order[b.level] || a.where.localeCompare(b.where));
  for (const f of findings) console.log(`${f.level.padEnd(5)} ${f.where}: ${f.msg}`);
  const errs = findings.filter((f) => f.level === 'ERROR').length;
  console.log(`\n${errs} error(s), ${findings.length - errs} warning(s)${RUN ? '' : ' — add --run to also compile starters/solutions'}`);
  process.exit(errs ? 1 : 0);
})();
