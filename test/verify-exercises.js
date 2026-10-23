// Dev tooling: run every runnable exercise through the real rustc subprocess
// runner and report which compile + which pass their output check. Not shipped
// as a lesson; used to validate the course content is pedagogically sound.
const path = require('path');
const { compile } = require(path.join(__dirname, '..', 'lib', 'compile'));
const { compileRun } = require(path.join(__dirname, '..', 'lib', 'runner', 'subprocess'));

async function main() {
  const course = compile('courses/rust-hlock');
  let codeN = 0, pass = 0, fail = 0, compileErr = 0;
  for (const m of course.modules) {
    for (const l of m.lessons) {
      for (const e of [...l.exercises, ...l.quizzes]) {
        if (e.kind !== 'code' && e.kind !== 'output' && e.kind !== 'fill') continue;
        if (!e.start) continue;
        codeN++;
        const r = await compileRun(e.start);
        let verdict = 'na';
        if (e.check && e.check.mode !== 'none') {
          const actual = (r.stdout || '') + (r.stderr || '');
          if (e.check.mode === 'exact') verdict = (r.stdout || '').trim() === e.check.value.trim() ? 'PASS' : 'FAIL';
          else if (e.check.mode === 'contains') verdict = actual.includes(e.check.value) ? 'PASS' : 'FAIL';
          else if (e.check.mode === 'auto') verdict = (r.stdout || '').trim() === (e.expected || '').trim() ? 'PASS' : 'FAIL';
        } else {
          verdict = r.ok || r.phase === 'interactive' ? 'runs' : 'RUN-ERR';
        }
        const status = !r.ok && r.phase === 'compile' ? 'COMPILE-ERR' : verdict;
        if (status === 'PASS' || status === 'runs') pass++;
        else if (status === 'COMPILE-ERR') { compileErr++; console.log(`[COMPILE-ERR] ${m.id}/${l.id}/${e.id}`); console.log('   ', (r.stderr||'').split('\n').slice(0,3).join(' | ')); }
        else { fail++; console.log(`[${status}] ${m.id}/${l.id}/${e.id} want=${JSON.stringify(e.check&&e.check.value)} got=${JSON.stringify((r.stdout||'').trim())}`); }
      }
    }
  }
  console.log(`\nRunnable exercises: ${codeN} | pass/runs: ${pass} | check-mismatch: ${fail} | compile-errors: ${compileErr}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
