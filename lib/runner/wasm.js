// learn-with: browser side runner used in STATIC mode. Same interface as the
// Node runner (async run(source, opts) -> {ok,stdout,stderr,exit,phase}).
//
// - If a WASM rustc bundle was loaded (window.Rustc, the Rust Playground
//   approach), we compile + run in-browser. Loading/bundling host rustc->wasm is
//   heavy (~100MB) and left as an adapter: the interface is stable.
// - `predict` and `mcq` items need no compiler (pure interaction) and always work.
// - Otherwise code items return a clear "needs a compiler backend" message so
//   static demos still communicate the execution requirement honestly.

(function (global) {
  function run(source, opts) {
    opts = opts || {};
    if (global.Rustc && typeof global.Rustc.compileAndRun === 'function') {
      try {
        return global.Rustc.compileAndRun(source, { edition: opts.edition || 2021, timeoutMs: opts.timeout || 15000 });
      } catch (e) {
        return Promise.resolve({ ok: false, phase: 'run', stdout: '', stderr: String(e && e.message || e), exit: 1 });
      }
    }
    if (opts.kind === 'predict' || opts.kind === 'mcq') {
      return Promise.resolve({ ok: true, phase: 'interactive', stdout: '', stderr: '', exit: 0, note: 'predict/mcq items need no compiler' });
    }
    return Promise.resolve({
      ok: false,
      phase: 'compiler-unavailable',
      stdout: '',
      stderr: '[static mode] In-browser rustc is not bundled. Run the course in dynamic mode (`npm run serve`)\n'
        + 'so real rustc compiles your code, or enable the WASM rustc adapter.',
      exit: 2,
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { run };
  else global.LearnWithRunner = { run };
})(typeof window !== 'undefined' ? window : globalThis);
