#!/usr/bin/env node
// learn-with CLI: compile a declarative course into a static site or run the
// dynamic (execution) server.
//
//   learn-with compile <courseDir>          validate + print summary
//   learn-with build   <courseDir> [--out dist]   emit static site
//   learn-with serve   <courseDir> [--port 4000] [--backend subprocess|docker]
//   learn-with run     <courseDir> --exercise <module>/<lesson>/<item> --code <file|->

const path = require('path');
const fs = require('fs');
const { compile } = require('../lib/compile');
const { emitStatic } = require('../lib/emit-static');

function arg(argv, name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def;
}
function has(argv, name) { return argv.includes(name); }

async function main(argv) {
  const cmd = argv[0];

  // `site` builds every course under courses/ — no single courseDir argument.
  if (cmd === 'site') {
    const out = path.resolve(arg(argv, '--out', 'site'));
    const { buildSite } = require('../lib/build-site');
    const r = buildSite(out);
    console.log(`built multi-course site -> ${r.outDir}`);
    console.log(`  courses: ${r.courses.map((c) => c.id).join(', ')}`);
    console.log(`  total: ${r.lessons} lessons / ${r.exercises} exercises across ${r.courses.length} course(s)`);
    console.log(`  GitHub Pages ready: commit ${r.outDir}/ — index.html is the hub, one folder per course`);
    return r;
  }

  const courseDir = argv[1] || 'courses/rust-hlock';
  if (!fs.existsSync(courseDir)) throw new Error(`course dir not found: ${courseDir}`);
  const abs = path.resolve(courseDir);

  if (cmd === 'compile') {
    const c = compile(abs);
    const lessons = c.modules.reduce((a, m) => a + m.lessons.length, 0);
    const ex = c.modules.reduce((a, m) => a + m.lessons.reduce((x, l) => x + l.exercises.length + l.quizzes.length, 0), 0);
    console.log(`course   : ${c.title} (${c.id})`);
    console.log(`modules  : ${c.modules.length}`);
    console.log(`lessons  : ${lessons}`);
    console.log(`exercises: ${ex}`);
    console.log(`concepts : ${Object.keys(c.conceptMap).length}`);
    return { c };
  }

  if (cmd === 'build') {
    const out = path.resolve(arg(argv, '--out', 'dist'));
    const r = emitStatic(abs, out);
    console.log(`built static site -> ${r.outDir} (${r.lessons} lessons, mode=${r.mode})`);
    console.log(`  serve dist/ from any static host (e.g. npx serve ${r.outDir})`);
    return r;
  }

  if (cmd === 'serve') {
    const port = parseInt(arg(argv, '--port', '4000'), 10);
    const backend = arg(argv, '--backend', process.env.LEARN_WITH_BACKEND || 'subprocess');
    const { createApp } = require('../lib/server');
    const app = createApp(abs, { backend, distDir: path.resolve(arg(argv, '--out', 'dist')) });
    const server = app.listen(port, () => {
      console.log(`learn-with dynamic server -> http://localhost:${port}`);
      console.log(`  backend: ${backend} · /api/run for real rustc · open the URL in your browser`);
    });
    return server;
  }

  if (cmd === 'run') {
    const { compileRun } = require('../lib/runner/subprocess');
    const sel = arg(argv, '--exercise', null);
    const codeArg = arg(argv, '--code', '-');
    let code = codeArg;
    if (code === '-') code = fs.readFileSync(0, 'utf8');
    else if (fs.existsSync(codeArg)) code = fs.readFileSync(codeArg, 'utf8');
    const res = await compileRun(code);
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.ok ? 0 : 1);
    return res;
  }

  throw new Error(`unknown command '${cmd}'. Try: compile | build | serve | run`);
}

const args = process.argv.slice(2);
const isServe = args[0] === 'serve';
main(args).then(() => { if (!isServe) process.exit(0); }).catch((e) => { console.error('error:', e.message || e); process.exit(1); });
