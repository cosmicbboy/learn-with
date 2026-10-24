// learn-with: Vercel / serverless adapter for the dynamic target.
//
// Exports the same Express app the local server uses, wired to the shared
// course and API routes. Deploy as a Vercel Node serverless function:
//
//   vercel.json:
//     { "builds": [{ "src": "serverless/vercel.js", "use": "@vercel/node" }],
//       "routes": [{ "src": "/(.*)", "dest": "serverless/vercel.js" }] }
//
// Execution caveat: the sandbox for `/api/run` depends on the runner backend.
// The `docker` runner keeps rustc isolated (set LEARN_WITH_BACKEND=docker and
// LEARN_WITH_IMAGE to a rust image), or point it at an agent/hosted compile
// service. Local `subprocess` rustc works on self-hosted/managed runners, not
// on platform sandboxes that lack the toolchain. See DESIGN.md §3.4.

const path = require('path');
const { createApp } = require('../lib/server');

const courseDir = process.env.LEARN_WITH_COURSE || path.join(__dirname, '..', 'courses', 'rust-hlock');
const app = createApp(courseDir, {
  backend: process.env.LEARN_WITH_BACKEND || 'dist',
  distDir: path.join(__dirname, '..', 'dist'),
  uiDir: path.join(__dirname, '..', 'ui'),
  live: false, // compile once per cold start
});

module.exports = app;
