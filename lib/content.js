// learn-with: content parser.
// Turns a lesson .md file (prose + `::: directive` blocks) into a structured
// Lesson object, and pulls exercise/quizzes out of ::: exercise blocks.

const { id } = require('./model');

// ----- tiny fenced-code/attr helpers -------------------------------------------------

// Parse `:::name k1="v1" k2="v2"` style header attributes (also bare words -> key=true).
function parseAttrs(header) {
  const attrs = {};
  const re = /([A-Za-z0-9_-]+)=("([^"]*)"|'([^']*)'|(\S+))/g;
  const bare = [];
  let m;
  let last = 0;
  // split off bare tokens (no '=') first
  const tokens = header.split(/\s+/).filter(Boolean);
  let rest = [];
  for (const t of tokens) {
    if (!t.includes('=')) rest.push(t);
  }
  while ((m = re.exec(header)) !== null) {
    attrs[m[1]] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
  }
  for (const r of rest) {
    if (!r.includes('=') && !Object.prototype.hasOwnProperty.call(attrs, r)) attrs[r] = true;
  }
  return attrs;
}

// Split a string on fenced code blocks. Returns segments:
//   { type:'prose', text } | { type:'code', lang, label, code }
function splitFences(text) {
  const out = [];
  const lines = text.split('\n');
  let i = 0;
  let cur = [];
  const flushProse = () => {
    if (cur.length) {
      const t = cur.join('\n');
      if (t.trim()) out.push({ type: 'prose', text: t });
      cur = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^\s*```([\w+-]*)(?::([\w-]+))?\s*$/);
    if (m) {
      const lang = m[1] || 'text';
      const label = m[2] || 'code';
      flushProse();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      out.push({ type: 'code', lang, label, code: buf.join('\n').replace(/\n$/, '') });
      continue;
    }
    cur.push(line);
    i++;
  }
  flushProse();
  return out;
}

function listAttr(s) {
  return String(s || '')
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Parse the body of an ::: exercise block into a normalized exercise item.
function parseExercise(attrs, body) {
  const kind = attrs.kind || 'code';
  const segments = splitFences(body);
  const prose = segments.filter((s) => s.type === 'prose').map((s) => s.text).join('\n\n').trim()
    // drop author markers that are just structural, not prose
    .replace(/^\s*<(\/?)(solution|hint|expected|start|prompt)>.*$/gim, '')
    .replace(/^\s*<(\/?)(\/?solution).*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const blocks = segments.filter((s) => s.type === 'code');
  const byLabel = (label) => blocks.find((s) => s.label === label);
  const rustBlocks = blocks.filter((s) => s.lang === 'rust');
  const startBlock = byLabel('start') || rustBlocks[0];
  const solBlock = byLabel('solution') || rustBlocks[1];
  const expectedBlock = byLabel('expected') || blocks.find((s) => s.lang === 'text');
  // Normalize goal: the prose up to a "## Check" or sole prose.
  const ex = {
    id: attrs.id ? id(attrs.id) : id((prose || 'exercise').slice(0, 40)),
    kind,
    concepts: listAttr(attrs.concepts || attrs.topic),
    difficulty: Math.min(5, Math.max(1, parseInt(attrs.difficulty, 10) || 2)),
    goal: prose,
  };
  if (kind === 'code' || kind === 'fill' || kind === 'output' || kind === 'predict') {
    ex.start = (startBlock && startBlock.code) || '';
    if (solBlock && solBlock.code) ex.solution = solBlock.code;
    if (expectedBlock && expectedBlock.code) ex.expected = expectedBlock.code;
  }
  if (attrs.check) {
    const cm = /^(exact|contains|auto|none)(?::\s*(.*))?$/.exec(attrs.check);
    ex.check = cm ? { mode: cm[1], value: cm[2] } : { mode: 'none' };
  } else if (kind === 'output' && ex.expected) {
    ex.check = { mode: 'exact', value: ex.expected };
  } else {
    ex.check = { mode: 'none' };
  }
  if (attrs.hints) ex.hints = listAttr(attrs.hints);
  if (kind === 'mcq') {
    ex.options = listAttr(attrs.options || '');
    ex.answer = attrs.answer;
  }
  return ex;
}

// Parse a single lesson file into an object.
function parseLesson(fileText, meta = {}) {
  const lines = fileText.split('\n');
  const out = {
    title: meta.title || '',
    concepts: [],
    objectives: [],
    body: [], // ordered segments: {type:'prose'}|{type:'callout',...}|{type:'exercise',...}
    exercises: [],
    quizzes: [],
    meta,
  };

  // front matter: leading `---` block
  if (lines[0] && lines[0].trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end > 0) {
      const fm = lines.slice(1, end).join('\n');
      for (const l of fm.split('\n')) {
        const mm = l.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (mm) {
          const key = mm[1].trim();
          let val = mm[2].trim();
          if (val.startsWith('[') && val.endsWith(']')) val = listAttr(val.slice(1, -1));
          if (!out.title && key === 'title') out.title = val;
          if (key === 'concepts') out.concepts = Array.isArray(val) ? val : listAttr(val);
          if (key === 'objectives') out.objectives = Array.isArray(val) ? val : listAttr(val);
          out[key] = val;
        }
      }
      lines.splice(0, end + 1);
    }
  }
  if (!out.title) out.title = 'Untitled lesson';

  // block-level scan
  const text = lines.join('\n');
  const blockRe = /^:::\s*([A-Za-z0-9_-]+)([^\n]*)\n([\s\S]*?)\n:::\s*$/gm;
  let index = 0;
  const segments = [];
  let match;
  let bodyMarkup = text;
  let cursor = 0;
  // We'll manually walk using the regex but keep prose between blocks.
  const re = /^:::\s*(\w+)([^\n]*)\n/gm;
  let lastIdx = 0;
  while ((match = re.exec(bodyMarkup)) !== null) {
    const before = bodyMarkup.slice(lastIdx, match.index);
    if (before.trim()) segments.push({ type: 'prose', text: before });
    const kind = match[1];
    const attrs = parseAttrs(match[2] || '');
    // find matching close `:::` at start of line after this open
    const start = re.lastIndex;
    const closeIdx = bodyMarkup.indexOf('\n:::', start);
    let inner;
    if (closeIdx === -1) {
      inner = bodyMarkup.slice(start);
      lastIdx = bodyMarkup.length;
    } else {
      inner = bodyMarkup.slice(start, closeIdx);
      lastIdx = closeIdx + 4;
    }
    handleDirective(kind, attrs, inner, out, segments);
  }
  const tail = bodyMarkup.slice(lastIdx);
  if (tail.trim()) segments.push({ type: 'prose', text: tail });

  out.body = segments;
  // Pull exercises/quizzes
  for (const seg of segments) {
    if (seg.type === 'exercise') out.exercises.push(seg.item);
    if (seg.type === 'quiz') out.quizzes.push(seg.item);
    if (seg.concepts) for (const c of seg.concepts) if (!out.concepts.includes(c)) out.concepts.push(c);
  }
  if (!Array.isArray(out.concepts)) out.concepts = [];
  return out;
}

function handleDirective(rawKind, attrs, inner, out, segments) {
  const kind = String(rawKind || '').toLowerCase();
  if (kind === 'exercise' || kind === 'quiz') {
    const item = parseExercise(attrs, inner);
    item.kind = kind === 'quiz' && !attrs.kind ? 'mcq' : item.kind;
    segments.push({ type: kind, item, concepts: item.concepts });
  } else if (kind === 'callout' || kind === 'notice' || kind === 'note' || kind === 'warning' || kind === 'caution' || kind === 'tip' || kind === 'info' || kind === 'success' || kind === 'challenge' || kind === 'aside') {
    const tone =
      attrs.type || attrs.tone ||
      (kind === 'warning' || kind === 'caution' ? 'warn' :
        kind === 'success' ? 'ok' :
        kind === 'notice' || kind === 'note' || kind === 'info' || kind === 'aside' ? 'info' :
        kind);
    segments.push({ type: 'callout', tone, lang: attrs.lang || null, title: attrs.title || null, text: inner.trim() });
  } else if (kind === 'hint') {
    segments.push({ type: 'hint', text: inner.trim() });
  } else if (kind === 'concept') {
    segments.push({ type: 'concept', concept: attrs.name || inner.trim(), text: inner.trim() });
  } else {
    // Unknown directive: never emit literal `[object Object]` — keep the prose.
    segments.push({ type: 'prose', text: inner.trim() });
  }
}

module.exports = { parseLesson, parseAttrs, splitFences, listAttr };
