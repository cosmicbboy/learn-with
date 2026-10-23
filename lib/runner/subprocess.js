// learn-with: subprocess runner — compiles & runs Rust with real rustc/cargo.
// Used by dynamic mode (local dev server). Produces REAL compiler output/errors.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const RUSTC = process.env.RUSTC || 'rustc';
const EDITION = 2021;

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'learnwith-'));
}

function run(name, args, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const env = { ...process.env, ...(opts.env || {}) };
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(name, args, { cwd, env, shell: false });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, opts.timeout || 15000);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, durationMs: Date.now() - started, killed });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: -1, durationMs: Date.now() - started, killed: false, error: e.message });
    });
  });
}

// Evaluate a snippet as a standalone program: rustc compile, then run the binary.
async function compileRun(source, opts = {}) {
  const dir = tmpdir();
  const main = path.join(dir, 'main.rs');
  const bin = path.join(dir, 'main');
  fs.writeFileSync(main, source);
  try {
    const compile = await run(RUSTC, [main, '-o', bin, '--edition', String(opts.edition || EDITION)], { timeout: opts.timeout || 20000 });
    if (compile.code !== 0) {
      return { ok: false, phase: 'compile', stdout: '', stderr: compile.stderr, exit: compile.code, durationMs: compile.durationMs };
    }
    const exec = await run(bin, [], { timeout: opts.timeout || 15000 });
    return {
      ok: exec.code === 0,
      phase: 'run',
      stdout: exec.stdout,
      stderr: exec.stderr,
      exit: exec.code,
      durationMs: (compile.durationMs || 0) + (exec.durationMs || 0),
      killed: exec.killed,
      timedOut: exec.killed,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Evaluate a test-style function / arbitrary expression? For now compile-run only.
module.exports = { compileRun, run };
