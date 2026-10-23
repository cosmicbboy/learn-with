// learn-with: static emitter. Copies the shared UI and bakes a mode flag +
// course manifest into a self-contained dist/ that any static host can serve.

const fs = require('fs');
const path = require('path');
const { compile } = require('./compile');

function emitStatic(courseDir, outDir, opts = {}) {
  const course = compile(courseDir);
  fs.mkdirSync(outDir, { recursive: true });
  const uiDir = path.join(__dirname, '..', 'ui');

  // course manifest
  fs.writeFileSync(path.join(outDir, 'course.json'), JSON.stringify(course, null, 2));

  // assets
  for (const f of ['app.js', 'styles.css', 'wasm-runner.js', 'logo.svg']) {
    fs.copyFileSync(path.join(uiDir, f), path.join(outDir, f));
  }
  // reusable deterministic adaptive engine (UMD) for the browser
  fs.copyFileSync(path.join(__dirname, 'adaptive', 'rules.js'), path.join(outDir, 'adaptive.js'));

  // index.html with embedded mode (so wasm.js doesn't need a fetch for config)
  let html = fs.readFileSync(path.join(uiDir, 'index.html'), 'utf8');
  html = html.replace('/*__LEARN_WITH_MODE__*/ null', JSON.stringify({ mode: 'static' }));
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  return { course: course.id, outDir, mode: 'static', lessons: course.modules.reduce((a, m) => a + m.lessons.length, 0) };
}

module.exports = { emitStatic };
