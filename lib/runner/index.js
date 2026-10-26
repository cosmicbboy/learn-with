// learn-with: runner registry. Picks a backend per target and normalizes results
// (adds a check verdict for output-check exercises).

const subprocess = require('./subprocess');
const docker = require('./docker');

const BACKENDS = { subprocess, docker };

// Build a fresh {run} closure for a given target:
//   target: { mode:'dynamic', backend:'subprocess'|'docker' } | { mode:'static' }
function forTarget(target, opts = {}) {
  const backend = (target && target.backend) || (process.env.LEARN_WITH_BACKEND || 'subprocess');
  if (target && target.mode === 'static') {
    // Static mode runs on the client; a thin JS adapter that reports "client".
    return {
      isNode: false,
      async run(code, ico) { return { ok: false, phase: 'client', stderr: 'client-side runner not available in Node static emit; run() is executed by the browser wasm.js adapter', exit: 2 }; },
    };
  }
  const impl = BACKENDS[backend] || subprocess;
  return {
    isNode: true,
    backend,
    async run(code, ico) {
      const res = await impl.compileRun(code, { timeout: opts.timeout });
      return attachVerdict(res, ico);
    },
  };
}

// Attach a {verdict:'pass'|'fail'|'na'} when the item declares an output check.
function attachVerdict(res, item) {
  const check = (item && item.check) || {};
  if (!check || !check.mode || check.mode === 'none') return { ...res, verdict: 'na' };
  let pass = false;
  if (check.mode === 'exact') pass = (res.stdout || '').trim() === check.value.trim();
  // stdout only, like the UI: rustc errors echo source lines into stderr
  else if (check.mode === 'contains') pass = (res.stdout || '').includes(check.value);
  else if (check.mode === 'auto') pass = (res.stdout || '').trim() === ((item.expected || '').trim());
  return { ...res, verdict: pass ? 'pass' : 'fail' };
}

module.exports = { forTarget, attachVerdict, BACKENDS };
