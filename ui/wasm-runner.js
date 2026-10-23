// learn-with: browser-side runner (STATIC mode). Same async shape as Node's:
//   LearnWithRunner.run(source, {kind}) -> Promise<{ok,stdout,stderr,exit,phase,...}>
// - predict/mcq need no compiler and always work.
// - If a WASM rustc bundle is loaded (window.Rustc.compileAndRun) it's used.
// - Otherwise code items report that real compilation needs the dynamic server,
//   or the WASM adapter. Keeps static demos honest.
(function (global) {
  function run(source, opts) {
    opts = opts || {};
    if (global.Rustc && typeof global.Rustc.compileAndRun === 'function') {
      try { return Promise.resolve(global.Rustc.compileAndRun(source, { edition: opts.edition || 2021, timeoutMs: opts.timeout || 15000 })); }
      catch (e) { return Promise.resolve({ ok: false, phase: 'run', stdout: '', stderr: String((e && e.message) || e), exit: 1 }); }
    }
    if (opts.kind === 'predict' || opts.kind === 'mcq') {
      return Promise.resolve({ ok: true, phase: 'interactive', stdout: '', stderr: '', exit: 0 });
    }
    return Promise.resolve({
      ok: false, phase: 'compiler-unavailable', stdout: '', exit: 2,
      stderr: '[static mode] In-browser rustc is not bundled. Run the course in dynamic mode (`npm run serve`) '
        + 'so real rustc compiles your code, or enable the WASM rustc adapter.',
    });
  }
  global.LearnWithRunner = { run };
})(typeof window !== 'undefined' ? window : globalThis);
