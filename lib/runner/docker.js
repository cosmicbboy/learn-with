// learn-with: docker sandbox runner — runs cargo/rustc inside an ephemeral
// container (resource-capped, host deps not needed). For hosted/sandboxed
// dynamic mode. Falls back to the subprocess runner if docker is unavailable.

const { spawnSync } = require('child_process');
const subprocess = require('./subprocess');

const IMAGE = process.env.LEARN_WITH_IMAGE || 'rust:1.87';

function dockerAvailable() {
  try {
    const r = spawnSync('docker', ['info'], { stdio: 'ignore' });
    return r.status === 0;
  } catch (_) {
    return false;
  }
}

// Evaluate source by running a one-shot container that compiles + runs it.
// Returns the same shape as subprocess.compileRun.
async function compileRun(source, opts = {}) {
  if (!dockerAvailable()) return subprocess.compileRun(source, opts);
  // Write source via stdin to avoid volume mounts/name collisions.
  return new Promise((resolve) => {
    const { execFile } = require('child_process');
    const args = ['run', '--rm', '--network', 'none', '--memory', '512m', '--cpus', '1',
      '-i', IMAGE, 'sh', '-c', 'cat > /tmp/main.rs && rustc /tmp/main.rs --edition 2021 -o /tmp/main && /tmp/main'];
    const started = Date.now();
    const child = execFile('docker', args, { timeout: opts.timeout || 30000 }, (err, stdout, stderr) => {
      if (err && /ETIMEDOUT|SIGKILL/.test(String(err.message))) {
        resolve({ ok: false, phase: 'run', stdout, stderr: stderr + '\n[timed out]', exit: 124, durationMs: Date.now() - started, timedOut: true });
        return;
      }
      // docker exit code isn't the program's; treat non-empty nonzero stderr as compile/run failure
      const code = err ? (err.code || 1) : 0;
      const looksCompile = /\berror\[|^error:/.test(stderr);
      resolve({ ok: code === 0, phase: looksCompile ? 'compile' : 'run', stdout, stderr, exit: code, durationMs: Date.now() - started });
    });
    child.stdin.on('error', () => {});
    child.stdin.write(source);
    child.stdin.end();
  });
}

module.exports = { compileRun, dockerAvailable, IMAGE };
