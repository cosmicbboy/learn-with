// learn-with: dynamic server (Express). Serves the emitted static UI + adds the
// execution/adaptation/persistence API. Deployable locally, or adapted to
// Vercel/Cloudflare by wrapping the same handlers.

const path = require('path');
const fs = require('fs');
const express = require('express');
const runner = require('./runner');
const agent = require('./adaptive/agent');

const MAX_CODE = 64 * 1024;

function createApp(courseDir, opts = {}) {
  const distDir = opts.distDir || path.join(courseDir, '..', '..', 'dist');
  const dataDir = opts.dataDir || path.join(distDir, '.data');
  fs.mkdirSync(dataDir, { recursive: true });

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const r = opts.runner || runner.forTarget({ mode: 'dynamic', backend: opts.backend || 'subprocess' }, opts);

  // course manifest
  // Recompile per request in dev so lesson edits show on reload (it's ~ms);
  // `live: false` pins the startup compile for hosted deployments.
  const { compile } = require('./compile');
  let course = compile(courseDir);
  const current = () => (opts.live === false ? course : (course = compile(courseDir)));
  const sendCourse = (req, res) => {
    try { res.json(current()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  };
  app.get('/api/course', sendCourse);
  app.get('/course.json', sendCourse);

  // compile + run user code
  app.post('/api/run', async (req, res) => {
    const code = req.body && req.body.code;
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'no code' });
    if (code.length > MAX_CODE) return res.status(413).json({ error: 'code too large' });
    const item = req.body.item;
    try {
      const result = await r.run(code, item);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
  });

  // agentic on-the-fly material
  app.post('/api/adapt', async (req, res) => {
    const concept = req.body && req.body.concept;
    if (!concept) return res.status(400).json({ error: 'no concept' });
    try {
      const item = await agent.generate(concept, {
        userId: req.body.userId,
        persona: req.body.persona,
        mastery: req.body.mastery,
        difficulty: req.body.difficulty,
        seed: req.body.seed,
        why: req.body.why,
      });
      res.json({ item: item || null });
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
  });

  // user-model persistence (simple JSON store; swap for KV in serverless)
  const userFile = path.join(dataDir, 'users.json');
  let users = {};
  try { users = JSON.parse(fs.readFileSync(userFile, 'utf8')); } catch (_) {}
  const save = () => { try { fs.writeFileSync(userFile, JSON.stringify(users)); } catch (_) {} };

  app.post('/api/user', (req, res) => {
    const { userId, model } = req.body || {};
    if (!userId || !model) return res.status(400).json({ error: 'userId + model required' });
    users[userId] = model;
    save();
    res.json({ ok: true });
  });
  app.get('/api/user', (req, res) => {
    const userId = req.query.userId;
    res.json(users[userId] || null);
  });

  // shared UMD adaptive engine for the browser
  app.get('/adaptive.js', (req, res) => res.sendFile(path.join(__dirname, 'adaptive', 'rules.js')));
  app.get('/levels.js', (req, res) => res.sendFile(path.join(__dirname, 'adaptive', 'levels.js')));
  app.get('/iterations.js', (req, res) => res.sendFile(path.join(__dirname, 'adaptive', 'iterations.js')));

  // static UI: the live ui/ sources (mode is detected via /api/health, so the
  // static build's baked index.html isn't needed — and serving dist/ meant UI
  // edits were invisible until a rebuild). no-cache so a reload always revalidates.
  const uiDir = opts.uiDir || path.join(__dirname, '..', 'ui');
  app.use(express.static(uiDir, { etag: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

  app.get('/api/health', (req, res) => res.json({ ok: true, mode: 'dynamic', course: course.id, runner: r.backend || 'subprocess' }));

  return app;
}

module.exports = { createApp };
