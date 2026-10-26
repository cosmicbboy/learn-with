/* learn-with: single-page app. Renders the syllabus + adaptive lesson view,
   wires the split-screen editor to a runner, tracks a per-user mastery model,
   and powers the adaptive + agentic layers. Works identically in static and
   dynamic modes (detected at boot). */

(() => {
  'use strict';
  const ADB = globalThis.LearnWithAdaptive;
  const RUN = globalThis.LearnWithRunner;
  const LV = globalThis.LearnWithLevels;

  // ---------- tiny DOM + markdown helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function inline(s) {
    let t = String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    t = t.replace(/\*([^*]+)\*/g, '<i>$1</i>');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return t;
  }

  function codeBlockHTML(code, lang) {
    const body = lang === 'rust' ? highlightRust(code) : esc(code);
    return `<div class="codeblock"><div class="cb-head">${lang ? `<span class="cb-lang">${esc(lang)}</span>` : ''}<button type="button" class="cb-copy" data-copy>Copy</button></div><pre><code>${body}</code></pre></div>`;
  }

  // One delegated handler for every code block's Copy button.
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-copy]');
    if (!b) return;
    const code = b.closest('.codeblock').querySelector('pre').innerText;
    const done = (t) => { b.textContent = t; setTimeout(() => { b.textContent = 'Copy'; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => done('Copied'), () => done('Copy failed'));
    else done('Copy failed');
  });

  function isTableSep(line) { return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line); }

  // Build a <table> from header + body rows (all `|`-delimited, contiguous).
  function buildTable(rows) {
    const split = (r) => {
      let s = r.trim(); if (s.startsWith('|')) s = s.slice(1); if (s.endsWith('|')) s = s.slice(0, -1);
      return s.split('|').map((c) => c.trim());
    };
    let cells = split(rows[0]);
    let html = '<div class="tbl-wrap"><table>';
    if (cells.length) html += `<thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
    html += '<tbody>';
    for (let k = 2; k < rows.length; k++) {
      const cs = split(rows[k]);
      // pad/trim to header width
      while (cs.length < cells.length) cs.push('');
      html += `<tr>${cs.slice(0, cells.length).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`;
    }
    html += '</tbody></table></div>';
    return html;
  }

  // Block-level markdown renderer: headings, paragraphs, lists, tables, code,
  // blockquote, hr. Kept dependency-free and injection-safe (everything escaped).
  function renderMD(text) {
    const src = String(text || '');
    const lines = src.split('\n');
    let html = '';
    let i = 0;
    let list = null; // {type,items}
    let para = null; // soft-wrapped lines of the current paragraph
    const flushPara = () => { if (para) { html += `<p>${inline(para.join(' '))}</p>`; para = null; } };
    const flushList = () => { if (list) { const t = list.type; html += `<${t}>${list.items.map((it) => `<li>${inline(it)}</li>`).join('')}</${t}>`; list = null; } };
    const flush = () => { flushPara(); flushList(); };
    while (i < lines.length) {
      const l = lines[i];
      const h = l.match(/^(#{1,4})\s+(.*)/);
      const ul = l.match(/^\s*[-*]\s+(.*)/);
      const ol = l.match(/^\s*\d+\.\s+(.*)/);
      const q = l.match(/^\s*>\s?(.*)/);
      const fence = l.match(/^```([\w+.-]*)\s*$/);
      const isTblStart = /^\s*\|/.test(l);
      const empty = l.trim() === '';

      if (fence) {
        flush();
        const b = [];
        const lang = fence[1] || 'text';
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { b.push(lines[i]); i++; }
        html += codeBlockHTML(b.join('\n'), lang.split(':')[0]);
      } else if (h) { flush(); const lvl = Math.min(4, h[1].length); html += `<h${lvl}>${inline(h[2])}</h${lvl}>`; }
      else if (isTblStart && lines[i + 1] && isTableSep(lines[i + 1])) {
        flush();
        const rows = [l];
        i++;
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        html += buildTable(rows);
        i--;
      } else if (q) {
        flush(); const qb = [q[1]]; i++;
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { qb.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        html += `<blockquote>${inline(qb.join(' '))}</blockquote>`; i--;
      } else if (ul || ol) {
        flushPara();
        const t = ul ? 'ul' : 'ol';
        if (!list || list.type !== t) { flushList(); list = { type: t, items: [] }; }
        list.items.push((ul || ol)[1]);
      } else if (/^\s*(---|\*\*\*)\s*$/.test(l)) { flush(); html += '<div class="hr"></div>'; }
      else if (empty) { flush(); }
      // an indented line right after a list item continues that item
      else if (list && /^\s+\S/.test(l)) { list.items[list.items.length - 1] += ' ' + l.trim(); }
      // authors hard-wrap prose: consecutive lines are one paragraph
      else { flushList(); (para = para || []).push(l.trim()); }
      i++;
    }
    flush();
    return html;
  }

  // ---------- Rust syntax highlighter (tiny tokenizer) ----------
  const KW = new Set(['as','break','const','continue','crate','else','enum','extern','false','fn','for','if','impl','in','let','loop','match','mod','move','mut','pub','ref','return','self','Self','static','struct','super','trait','true','type','unsafe','use','where','while','async','await','dyn']);
  // Emits class names (tk-*) so colours come from theme tokens in styles.css.
  function highlightRust(code) {
    const re = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*")|('(?:[^'\\\s]|\\.)'|'[A-Za-z_]\w*)|(#!?\[[^\]\n]*\])|(\b\d[\d_]*(?:\.[\d_]+)?\b)|([A-Za-z_][A-Za-z0-9_]*!?)|(\s+)|(.)/g;
    const out = [];
    const span = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;
    let m;
    while ((m = re.exec(code))) {
      const [all, comment, block, str, ch, attr, num, ident, ws] = m;
      if (comment || block) out.push(span('tk-c', all));
      else if (str || ch) out.push(span('tk-s', all));
      else if (attr) out.push(span('tk-a', all));
      else if (num) out.push(span('tk-n', all));
      else if (ident) {
        if (ident.endsWith('!')) out.push(span('tk-m', ident));
        else if (KW.has(ident)) out.push(span('tk-k', ident));
        else if (/^[A-Z]/.test(ident)) out.push(span('tk-t', ident));
        else out.push(esc(ident));
      } else if (ws) out.push(all);
      else out.push(esc(all));
    }
    return out.join('');
  }

  // ---------- app state ----------
  const S = {
    course: null,
    mode: 'dynamic',
    um: null,           // user model (adaptive)
    userId: 'local-user',
    m: null,            // current module
    l: null,            // current lesson
    runner: null,       // resolved runner
  };

  const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

  // ---------- iterations ----------
  // Iteration 1 is the course as authored. Once it's finished an "Iterate" button
  // appears; iterating builds iteration 2 from how iteration 1 went (iterations.js),
  // and so on. Every earlier iteration stays one click away in the header.
  const IT = globalThis.LearnWithIterations;
  let FIRST = null; // iteration 1's plan (computed from the course, never stored)
  function latestIter() { return 1 + S.um.it.plans.length; }
  function curIter() { return S.previewPlan ? 0 : Math.min(S.um.it.current || 1, latestIter()); }
  function planOf(n = curIter()) {
    if (n === 0) return S.previewPlan;
    if (n === 1) return FIRST || (FIRST = IT.firstPlan(S.course));
    return S.um.it.plans[n - 2];
  }
  // A plan lesson resolved against the current course (edits may drop items).
  function resolveLesson(pl) {
    const found = findLesson(pl.m, pl.l);
    if (!found.l) return null;
    const pool = [...found.l.exercises, ...found.l.quizzes];
    const items = pl.items.map((it) => {
      const e = pool.find((x) => x.id === it.id && (x.level || 0) === it.level);
      return e ? { ...e, _key: it.key, _rules: it.rules } : null;
    }).filter(Boolean);
    return { m: found.m, l: found.l, pl, items };
  }
  function planLessons(n = curIter()) { return (planOf(n) ? planOf(n).lessons : []).map(resolveLesson).filter(Boolean); }
  function iterProgress(n = curIter()) {
    let done = 0, total = 0;
    for (const x of planLessons(n)) for (const e of x.items) { total++; if (S.um.done[e._key]) done++; }
    return { done, total };
  }
  function isComplete(n) { const p = iterProgress(n); return p.total > 0 && p.done === p.total; }
  function canIterate() { return !S.previewPlan && curIter() === latestIter() && isComplete(latestIter()); }
  function totalItems() { return iterProgress().total; }
  function doneCount() { return iterProgress().done; }
  function setIter(n) {
    S.previewPlan = null;
    S.um.it.current = Math.max(1, Math.min(n, latestIter()));
    saveModel();
  }
  function iterStats(n = curIter()) { return (S.um.it.stats[n] = S.um.it.stats[n] || {}); }

  // Per-item outcomes for the current iteration: what the next iteration is built from.
  function recordOutcome(e, { correct, hint, solution }) {
    if (S.previewPlan || e._generated || !e._key) return;
    const st = iterStats()[e._key] = iterStats()[e._key] || { attempts: 0, misses: 0 };
    if (st.done) return; // only the run that earned the ✓ (and those before it) count
    st.attempts++;
    if (!correct) st.misses++;
    if (hint) st.hints = true;
    if (solution) st.solution = true;
    if (correct) { st.done = true; st.firstTry = st.attempts === 1 && !st.hints && !st.solution; }
  }

  // Build the next iteration from the latest one's outcomes.
  function iterate() {
    if (!canIterate()) return;
    const n = latestIter();
    const seen = new Set();
    for (let k = 1; k <= n; k++) {
      const st = S.um.it.stats[k] || {};
      for (const pl of planOf(k).lessons) for (const it of pl.items) if (st[it.key] && st[it.key].firstTry) seen.add(`${pl.m}/${pl.l}/${it.id}@${it.level}`);
    }
    const next = IT.nextPlan(S.course, planOf(n), S.um.it.stats[n] || {}, (c) => ADB.masteryLevelFor(S.um, c), seen);
    if (!next.lessons.length || !next.fresh) {
      showToast('<b>Nothing deeper to build.</b> You have been through every depth of this course\'s material. Revisit any earlier iteration from the header.');
      return;
    }
    S.um.it.plans.push(next);
    S.um.it.current = next.n;
    saveModel();
    goHome();
  }

  // Called after every completion: the first time the latest iteration is fully
  // done, offer to iterate.
  function checkComplete() {
    const n = curIter();
    if (!n || n !== latestIter() || S.um.it.offered[n] || !isComplete(n)) return;
    S.um.it.offered[n] = Date.now();
    saveModel();
    updateProgress();
    showToast(`<b>You've worked through the whole ${n > 1 ? 'iteration' : 'course'}.</b> Iterate to build the next one from how this one went: deeper where you were strong, more support where you weren't.`,
      { label: 'Iterate →', run: iterate });
  }

  function conceptList(cs, aced = []) { return cs.map((c) => `<span class="chip-c">${aced.includes(c) ? '✓ ' : ''}${esc(c.replace(/_/g, ' '))}</span>`).join(' '); }
  function evidenceText(ev) {
    if (!ev || !ev.items) return '';
    const parts = [`${ev.firstTry}/${ev.items} first try`];
    if (ev.misses) parts.push(`${ev.misses} missed run${ev.misses > 1 ? 's' : ''}`);
    if (ev.solutions) parts.push(`solution opened ${ev.solutions}×`);
    else if (ev.hints) parts.push(`${ev.hints} with hints`);
    return parts.join(', ');
  }
  function showToast(html, action) {
    const old = $('.toast'); if (old) old.remove();
    const t = el('div', 'toast', `<div>${html}</div>`);
    t.setAttribute('role', 'status');
    if (action) {
      const b = el('button', 'btn primary', esc(action.label)); b.type = 'button';
      b.onclick = () => { t.remove(); action.run(); };
      t.appendChild(b);
    }
    const x = el('button', 'toast-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss');
    x.onclick = () => t.remove();
    t.appendChild(x);
    document.body.appendChild(t);
  }

  function saveModel() {
    try { localStorage.setItem('learnwith.' + S.course.id, JSON.stringify(S.um)); } catch (_) {}
    if (S.mode === 'dynamic') {
      fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: S.userId, model: S.um }) }).catch(() => {});
    }
  }

  function loadModel() {
    let m = null;
    try { m = JSON.parse(localStorage.getItem('learnwith.' + S.course.id)); } catch (_) {}
    if (!m) m = ADB.blankModel();
    if (!m.done) m.done = {};
    if (!m.it) m.it = { plans: [], current: 1, stats: {}, offered: {} };
    delete m.ng; // superseded by iterations
    return m;
  }

  // ---------- boot ----------
  // ---------- theme ----------
  const THEME_KEY = 'learnwith.theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const b = $('#themeToggle'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  function initTheme() {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (_) {}
    if (!t) t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    applyTheme(t);
    const b = $('#themeToggle');
    if (b) b.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    });
  }

  async function boot() {
    try {
      const health = await fetch('/api/health').then((r) => r.ok).catch(() => false);
      S.mode = health ? 'dynamic' : 'static';
    } catch (_) { S.mode = 'static'; }
    const cp = S.mode === 'dynamic' ? '/api/course' : 'course.json';
    const course = await fetch(cp).then((r) => r.json());
    S.course = course;
    $('#courseShort').textContent = course.title;
    const badge = $('#modeBadge');
    badge.textContent = S.mode === 'dynamic' ? 'Live compiler' : 'Offline';
    badge.title = S.mode === 'dynamic'
      ? 'Run sends your code to a real rustc on the server.'
      : 'Static build: quizzes and predictions work; code needs `npm run serve` (or a WASM rustc) to compile.';
    badge.classList.toggle('live', S.mode === 'dynamic');
    S.um = loadModel();
    // author preview: ?depth=++ renders every concept at that depth (nothing is
    // saved toward the learner's iterations). Read raw: URLSearchParams would
    // decode the `+`s in "++" into spaces.
    const q = (location.search.match(/[?&](?:depth|level)=([^&]*)/) || [])[1];
    if (q != null) { try { S.previewPlan = IT.uniformPlan(S.course, LV.parseLevel(decodeURIComponent(q))); } catch (_) { S.previewPlan = null; } }
    S.runner = S.mode === 'dynamic' ? {
      kind: 'dynamic',
      async run(code, item) {
        const r = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, item }) }).then((res) => res.json());
        return r;
      },
    } : {
      kind: 'static',
      async run(code, item) { return RUN.run(code, { kind: item && item.kind }); },
    };
    router();
  }

  // ---------- navigation ----------
  // The hash is the single source of truth: set it and let the router render
  // (rendering here too would draw every lesson twice).
  function setPath(moduleId, lessonId) {
    const h = `#${moduleId}/${lessonId}`;
    if (location.hash === h) router(); else location.hash = h;
  }
  function goHome(anchor) {
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
    renderHome(anchor);
  }
  function findLesson(moduleId, lessonId) {
    const m = S.course.modules.find((x) => x.id === moduleId);
    const l = m && m.lessons.find((x) => x.id === lessonId);
    return { m, l };
  }
  // The lesson route of an iteration (iterations may reorder or skip lessons).
  function flatLessons(n = curIter()) { return planLessons(n); }

  // ---------- HOME / syllabus ----------
  function renderHome(anchor) {
    const root = $('#mount');
    root.innerHTML = '';
    document.title = S.course.title;
    updateProgress();
    const c = S.course;
    const hero = el('div', 'hero');
    hero.innerHTML = `<p class="sub">${esc(c.subtitle || '')}</p><h1>${esc(c.title)}</h1>`;
    if (c.blurb) hero.innerHTML += `<div class="blurb">${renderMD(c.blurb)}</div>`;
    // persona chips
    const pc = [];
    if (c.persona && c.persona.python >= 3) pc.push('<span class="chip"><b>Python</b> native</span>');
    if (c.persona && c.persona.javascript >= 3) pc.push('<span class="chip"><b>JavaScript</b> comfortable</span>');
    if (c.persona && c.persona.r >= 2) pc.push('<span class="chip"><b>R</b> a little</span>');
    if (c.project && c.project.repo) pc.push(`<span class="chip">Splunking <b><a href="${esc(c.project.repo)}" target="_blank" rel="noopener">${esc(c.project.repo)}</a></b></span>`);
    if (pc.length) hero.appendChild(el('div', 'persona', pc.join('')));
    root.appendChild(hero);

    // continue to first unfinished lesson
    const all = flatLessons();
    const started = doneCount() > 0;
    // resume the lesson you were last in; otherwise the first unfinished one
    const lastKey = curIter() > 1 ? (S.um.it.last || {})[curIter()] : S.um.last; // resume point is per iteration
    const last = all.find((x) => `${x.m.id}/${x.l.id}` === lastKey);
    const cont = (last && !lessonComplete(last)) ? last : all.find((x) => !lessonComplete(x));
    const n = curIter();
    const multi = latestIter() > 1;
    const label = multi ? `Iteration ${n || 'preview'} · ` : '';
    if (cont) {
      const next = el('div', 'next-up', '');
      next.innerHTML = `<div><div class="next-label">${esc(label)}${started ? 'Pick up where you left off' : n > 1 ? 'This iteration starts here' : 'Start here'}</div><div class="next-title">${esc(cont.l.title)}</div><div class="next-meta">${esc(moduleNum(cont.m))} ${esc(cont.m.title)} · ${lessonCounts(cont).done}/${lessonCounts(cont).total} exercises done</div></div>`;
      const b = el('button', 'btn primary big', started ? 'Continue →' : n > 1 ? 'Begin →' : 'Start the course →');
      b.onclick = () => setPath(cont.m.id, cont.l.id);
      next.appendChild(b);
      hero.appendChild(next);
    } else if (n === latestIter()) {
      const done = el('div', 'next-up done', `<div><div class="next-label">${esc(label)}Complete</div><div class="next-title">You've worked through the whole ${n > 1 ? 'iteration' : 'course'}.</div><div class="next-meta">Iterate to build the next one from how this one went: deeper where you were strong, more support where you weren't.</div></div>`);
      const b = el('button', 'btn primary big', 'Iterate →');
      b.onclick = iterate;
      done.appendChild(b);
      hero.appendChild(done);
    } else {
      const done = el('div', 'next-up done', `<div><div class="next-label">${esc(label)}Complete</div><div class="next-title">You're revisiting iteration ${n} of ${latestIter()}.</div><div class="next-meta">Everything here stays as it was. Your latest iteration is one click away.</div></div>`);
      const b = el('button', 'btn primary big', `Go to iteration ${latestIter()} →`);
      b.onclick = () => { setIter(latestIter()); goHome(); };
      done.appendChild(b);
      hero.appendChild(done);
    }
    const why = iterationSummary(planOf());
    if (why) hero.appendChild(why);

    // concept map: mastery chips that jump to the lesson that introduces them
    const cm = el('section', 'review', '');
    cm.appendChild(el('h2', 'review-label', 'Concept mastery'));
    cm.appendChild(el('div', 'review-legend', ADB.LADDER.map((n) => `<span><i class="lv-${n}"></i>${n}</span>`).join('')));
    for (const k of Object.keys(c.conceptMap)) {
      const lvl = ADB.masteryLevelFor(S.um, k);
      const first = all.find(({ l }) => (l.concepts || []).includes(k));
      const chip = el(first ? 'a' : 'span', `concept ${lvl}`, esc(k.replace(/_/g, ' ')));
      chip.title = `${c.conceptMap[k].summary} — ${lvl}`;
      if (first) { chip.href = `#${first.m.id}/${first.l.id}`; }
      cm.appendChild(chip);
    }
    root.appendChild(cm);

    // modules, in this level's route order (a level may reorder or skip lessons,
    // so consecutive lessons from the same module are grouped into one card)
    const mods = el('div', 'modules', '');
    const runs = [];
    for (const x of all) {
      const lastRun = runs[runs.length - 1];
      if (lastRun && lastRun.m === x.m) lastRun.lessons.push(x.l); else runs.push({ m: x.m, lessons: [x.l] });
    }
    for (const { m, lessons } of runs) {
      const card = el('section', 'module', '');
      if (!mods.querySelector('#mod-' + m.id)) card.id = 'mod-' + m.id;
      let dn = 0, tt = 0;
      for (const l of lessons) { const c2 = lessonCounts({ m, l }); dn += c2.done; tt += c2.total; }
      const pct = tt ? Math.round((dn / tt) * 100) : 0;
      card.innerHTML = `<h3><span class="mnum">${esc(moduleNum(m))}</span> ${esc(m.title)} ${m.capstone ? '<span class="tag">capstone</span>' : ''} <span class="mpct">${pct}%</span></h3>`
        + `<div class="mbar" aria-hidden="true"><i style="width:${pct}%"></i></div>`;
      if (m.blurb) card.innerHTML += `<div class="obj">${renderMD(m.blurb)}</div>`;
      if (m.objectives && m.objectives.length) card.innerHTML += `<ul class="obj objlist">${m.objectives.map((o) => `<li>${inline(o)}</li>`).join('')}</ul>`;
      const ul = el('ul', 'lessons', '');
      for (const l of lessons) {
        const li = el('li', '', '');
        const n = lessonCounts({ m, l });
        const state = n.total && n.done === n.total ? 'done' : n.done ? 'partial' : '';
        const a = el('a', state, `<span class="lstate" aria-hidden="true"></span><span class="ltitle">${esc(l.title)}</span><span class="lcount">${n.done}/${n.total}</span>`);
        a.href = `#${m.id}/${l.id}`;
        a.setAttribute('aria-label', `${l.title} — ${n.done} of ${n.total} exercises done`);
        li.appendChild(a);
        ul.appendChild(li);
      }
      card.appendChild(ul);
      mods.appendChild(card);
    }
    root.appendChild(mods);
    const target = anchor && (document.getElementById('mod-' + anchor) || document.getElementById(anchor));
    if (target) target.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
  }

  // Home, iteration 2+: what this iteration was built from, in plain words.
  function iterationSummary(plan) {
    if (!plan || !plan.perf) {
      if (plan && plan.preview != null) return el('div', 'iter-why', `<b>Preview:</b> every concept at depth ${plan.preview}. Nothing you do here counts toward your iterations.`);
      return null;
    }
    const { deeper, revisit } = plan.summary;
    const title = findLessonTitle;
    const rows = [];
    const aced = deeper.filter((c) => plan.perf[c] && plan.perf[c].cls === 'strong');
    if (deeper.length) rows.push(`<li><b>Going deeper</b> on ${conceptList(deeper, aced)}${aced.length ? ' <span class="ev">(✓ = you aced it)</span>' : ''}</li>`);
    if (revisit.length) rows.push(`<li><b>Revisiting with every hint</b> where it was hard: ${conceptList(revisit)}</li>`);
    const returned = plan.lessons.filter((pl) => pl.returned);
    if (returned.length) rows.push(`<li><b>Back for review</b>: ${returned.map((pl) => esc(title(pl))).join(', ')}</li>`);
    if (plan.skipped.length) rows.push(`<li><b>Skipped</b>, nothing new for you there: ${plan.skipped.map((x) => esc(title(x))).join(', ')}</li>`);
    const prev = planOf(plan.n - 1);
    const route = S.course.levels[plan.routeDepth];
    if (prev && prev.routeDepth !== plan.routeDepth && route && route.note) rows.push(`<li><b>New route</b>: ${esc(route.note)}</li>`);
    rows.push(`<li>${plan.fresh} exercise${plan.fresh === 1 ? '' : 's'} you haven't seen before.</li>`);
    const box = el('details', 'iter-why', `<summary>How iteration ${plan.n} was built from iteration ${plan.n - 1}</summary><ul>${rows.join('')}</ul>`);
    box.open = !S.um.it.summarySeen || !S.um.it.summarySeen[plan.n];
    box.addEventListener('toggle', () => { S.um.it.summarySeen = { ...(S.um.it.summarySeen || {}), [plan.n]: true }; saveModel(); });
    return box;
  }
  function findLessonTitle(x) { const f = findLesson(x.m, x.l); return f.l ? f.l.title : `${x.m}/${x.l}`; }

  function moduleNum(m) { return m.capstone ? '★' : (m.id.split('-')[0] || ''); }
  // Item keys for a lesson in an iteration (empty if the lesson isn't part of it).
  function allItemsDone({ m, l }, n = curIter()) {
    const x = planLessons(n).find((y) => y.m === m && y.l === l);
    return x ? x.items.map((e) => e._key) : [];
  }
  function lessonCounts(x, n = curIter()) {
    const ids = allItemsDone(x, n);
    return { done: ids.filter((i) => S.um.done[i]).length, total: ids.length };
  }
  function lessonComplete(x) { const n = lessonCounts(x); return n.done === n.total; }

  // ---------- LESSON view ----------
  function renderLesson(moduleId, lessonId) {
    const found = findLesson(moduleId, lessonId);
    if (!found.l) return renderHome();
    S.m = found.m; S.l = found.l;
    const root = $('#mount');
    root.innerHTML = '';
    updateProgress();
    window.scrollTo(0, 0);

    const m = found.m, l = found.l;
    document.title = `${l.title} · ${S.course.title}`;
    const here0 = `${m.id}/${l.id}`;
    if (curIter() > 1) { S.um.it.last = S.um.it.last || {}; if (S.um.it.last[curIter()] !== here0) { S.um.it.last[curIter()] = here0; saveModel(); } }
    else if (curIter() === 1 && S.um.last !== here0) { S.um.last = here0; saveModel(); }
    const container = el('article', 'lesson');
    const all = flatLessons();
    const pos = all.findIndex((x) => x.l === l) + 1;
    const n = lessonCounts({ m, l });
    const it = curIter();
    const here = all.find((x) => x.l === l); // this lesson as planned for the iteration
    const multi = latestIter() > 1 || S.previewPlan;

    const crumb = el('nav', 'breadcrumb', `<a href="#" data-home>Home</a><span aria-hidden="true">›</span><a href="#" data-mod>${esc(moduleNum(m))} ${esc(m.title)}</a><span class="crumb-pos">${multi ? `<span class="ngchip">${it ? `Iteration ${it}` : 'Preview'}</span> ` : ''}${pos ? `Lesson ${pos} of ${all.length}` : `Not part of iteration ${it}`}</span>`);
    crumb.setAttribute('aria-label', 'Breadcrumb');
    $('[data-home]', crumb).addEventListener('click', (e) => { e.preventDefault(); goHome(); });
    $('[data-mod]', crumb).addEventListener('click', (e) => { e.preventDefault(); goHome(m.id); });
    container.appendChild(crumb);
    container.appendChild(el('h1', 'lesson-title', esc(l.title)));
    container.appendChild(el('div', 'lesson-meta', `<span id="lessonCount">${n.done}/${n.total} exercises done</span>${(l.concepts || []).map((c) => `<span class="chip-c">#${esc(c)}</span>`).join('')}`));
    const whyHere = here && lessonWhy(here.pl);
    if (whyHere) container.appendChild(el('div', 'ngbanner', whyHere));
    else if (!here && multi) container.appendChild(el('div', 'ngbanner', `This lesson isn’t part of iteration ${it}, so nothing here counts toward it.`));
    if (l.objectives && l.objectives.length) {
      container.appendChild(el('div', 'objectives', `<h2>By the end you can</h2><ul>${l.objectives.map((o) => `<li>${inline(o)}</li>`).join('')}</ul>`));
    }

    // adaptive banner: only when it has something to tell the learner
    const concepts = l.concepts || [];
    const layer = concepts.length ? ADB.renderLayer(S.um, concepts[0], S.course.persona) : 'base';
    const due = ADB.scheduleReview(S.um, Object.keys(S.course.conceptMap || {}));
    const dueNames = due.filter((d) => d.due !== false && d.level !== 'unknown' && !concepts.includes(d.concept)).slice(0, 3).map((d) => d.concept);
    const notes = [];
    if (layer === 'remedial') notes.push(`<b>${esc(concepts[0])}</b> has been tricky so far — take the hints, and use “More practice” after a miss.`);
    if (layer === 'deep') notes.push(`You've already mastered <b>${esc(concepts[0])}</b> — skim the analogies and go straight to the exercises.`);
    if (dueNames.length) {
      const links = dueNames.map((c) => {
        const first = all.find((x) => (x.l.concepts || []).includes(c));
        return first ? `<a href="#${first.m.id}/${first.l.id}">${esc(c)}</a>` : `<b>${esc(c)}</b>`;
      });
      notes.push(`Due for a quick review: ${links.join(', ')}.`);
    }
    if (notes.length) container.appendChild(el('div', 'adaptive', notes.join(' ')));

    // body
    const body = el('div', 'prose', '');
    const chosen = here ? new Map(here.items.map((e) => [e.id, e])) : new Map();
    for (const seg of LV.bodyFor(l, here ? here.pl.depth : 0, { analogies: here ? here.pl.analogies : true }, chosen)) {
      if (seg.type === 'prose') body.appendChild(el('div', '', renderMD(seg.text)));
      else if (seg.type === 'callout') {
        body.appendChild(el('aside', 'callout', `<div class="clabel">${esc(seg.title || calloutLabel(seg))}</div><div>${renderMD(seg.text)}</div>`));
        const call = body.lastChild; call.setAttribute('data-tone', seg.tone);
      } else if (seg.type === 'hint') {
        body.appendChild(el('details', 'hints', `<summary>Hint</summary><div>${renderMD(seg.text)}</div>`));
      } else if (seg.type === 'exercise' || seg.type === 'quiz') {
        body.appendChild(seg.item.kind === 'mcq' ? renderQuiz(seg.item) : renderExercise(seg.item));
      } else if (seg.type === 'concept') {
        body.appendChild(el('div', 'callout', `<div class="clabel">concept: ${esc(seg.concept)}</div>${renderMD(seg.text)}`));
      }
    }
    container.appendChild(body);

    // footer nav (adaptive next)
    container.appendChild(footerNav());

    root.appendChild(container);
  }

  // Iteration 2+: one line on why this lesson is in the iteration, from the evidence.
  function lessonWhy(pl) {
    if (!pl || !pl.why || !pl.why.length) return '';
    const deeper = pl.why.filter((w) => w.kind === 'deeper');
    const revisit = pl.why.filter((w) => w.kind === 'revisit');
    const bits = [];
    if (pl.returned) bits.push(`<b>Back for review</b> — ${pl.returned.map((c) => esc(c.replace(/_/g, ' '))).join(', ')} needs another look, and this is the lesson that teaches it.`);
    if (deeper.length) bits.push(`<b>Deeper on</b> ${deeper.map((w) => `${esc(w.concept.replace(/_/g, ' '))}${w.evidence ? ` <span class="ev">(${esc(evidenceText(w.evidence))})</span>` : ''}`).join(', ')}.`);
    if (revisit.length) bits.push(`<b>Revisiting with every hint</b>: ${revisit.map((w) => `${esc(w.concept.replace(/_/g, ' '))}${w.evidence ? ` <span class="ev">(${esc(evidenceText(w.evidence))})</span>` : ''}`).join(', ')}.`);
    return bits.join(' ');
  }

  // Human labels instead of raw tone names ("contrast · python").
  const LANG_NAMES = { python: 'Python', javascript: 'JavaScript', js: 'JavaScript', r: 'R', go: 'Go', ts: 'TypeScript' };
  function calloutLabel(seg) {
    if (seg.tone === 'contrast') return seg.lang ? `Coming from ${LANG_NAMES[seg.lang] || seg.lang}` : 'Compare';
    return { challenge: 'Challenge', warn: 'Watch out', ok: 'Nice', info: 'Note', tip: 'Tip' }[seg.tone] || seg.tone;
  }

  // ---------- exercise (code) renderer ----------
  // Items rendered from a plan carry their key; others (off-plan lessons) get one.
  function exerciseId(m, l, e) { return e._key || IT.itemKey(curIter() || 1, m, l, e); }
  function isDone(e) { return !!S.um.done[exerciseId(S.m, S.l, e)]; }
  function cardHeader(label, e, extra) {
    const diff = e.difficulty ? `<span class="diff" title="Difficulty ${e.difficulty} of 5" aria-label="Difficulty ${e.difficulty} of 5">${'●'.repeat(e.difficulty)}${'○'.repeat(5 - e.difficulty)}</span>` : '';
    const ng = e.level ? `<span class="ngchip" title="A deeper version of this exercise (depth ${e.level} of 3)">deeper${e.level > 1 ? ` ×${e.level}` : ''}</span>` : '';
    return el('div', 'hd', `<span class="dot" aria-hidden="true"></span><b>${label}</b>${ng}<span class="donetag">✓ Done</span>${extra || ''}<span class="chips">${diff}${(e.concepts || []).map((c) => `<span class="chip-c">#${esc(c)}</span>`).join(' ')}</span>`);
  }
  const DRAFT_KEY = (e) => `learnwith.draft.${S.course.id}.${exerciseId(S.m, S.l, e)}`;
  function loadDraft(e) { try { return localStorage.getItem(DRAFT_KEY(e)); } catch (_) { return null; } }
  function saveDraft(e, code) {
    try { if (code === e.start) localStorage.removeItem(DRAFT_KEY(e)); else localStorage.setItem(DRAFT_KEY(e), code); } catch (_) {}
  }

  function renderExercise(e) {
    const card = el('section', 'excard', '');
    card._state = { runCount: 0, hintShown: false };
    if (e.kind === 'predict') return renderPredict(e, card);

    card.appendChild(cardHeader(e._generated ? 'Extra practice' : 'Exercise', e));
    if (!e._generated && isDone(e)) card.classList.add('is-done');
    const body = el('div', 'exbody', '');
    body.appendChild(el('div', 'goal', renderMD(e.goal)));

    // split view: editor + console
    const runwrap = el('div', 'runwrap', '');
    const editorPane = el('div', 'editor', '');
    const start = e.start || 'fn main() {\n    println!("hello");\n}';
    const draft = e._generated ? null : loadDraft(e);
    editorPane.appendChild(el('div', 'bar', `<span class="filetab mono">main.rs</span><span class="bar-note">${draft != null ? 'restored your draft · ' : ''}<kbd>${MOD_KEY}</kbd>+<kbd>Enter</kbd> to run</span>`));
    const ed = buildEditor(draft != null ? draft : start);
    const ta = ed.ta;
    card._state.ed = ed;
    editorPane.appendChild(ed.el);
    const actions = el('div', 'actions', '');
    const runBtn = el('button', 'btn primary', '▶ Run');
    runBtn.type = 'button';
    runBtn.onclick = () => doRun(e, ta, card, runBtn);
    ed.onRun = () => { if (!runBtn.disabled) doRun(e, ta, card, runBtn); };
    if (!e._generated) ed.onChange = () => saveDraft(e, ta.value);
    actions.appendChild(runBtn);
    const reset = el('button', 'btn ghost', 'Reset');
    reset.type = 'button';
    reset.title = 'Restore the starter code';
    reset.onclick = () => { ta.value = start; paint(ed); saveDraft(e, start); ta.focus(); };
    actions.appendChild(reset);
    // level rules: cap hints; hold the solution back (or for n misses)
    const R = e._rules || LV.DEFAULT_LEVELS[0].rules;
    const hints = (e.hints || []).slice(0, R.hints == null ? undefined : R.hints);
    if (hints.length) actions.appendChild(hintButton({ ...e, hints }, card));
    else if ((e.hints || []).length && R.hints === 0) actions.appendChild(el('span', 'rule-note', 'No hints this time'));
    if (e.solution && R.solution !== false) {
      const sol = el('details', 'sol', `<summary>Show solution</summary>${codeBlockHTML(e.solution, 'rust')}`);
      sol.addEventListener('toggle', () => { if (sol.open) { card._state.hintShown = true; card._state.solOpened = true; } });
      if (typeof R.solution === 'number') {
        sol.hidden = true;
        card._state.solutionAfter = R.solution;
        card._state.solutionEl = sol;
        actions.appendChild(el('span', 'rule-note sol-note', `Solution appears after ${R.solution} missed runs`));
      }
      actions.appendChild(sol);
    }
    editorPane.appendChild(actions);
    runwrap.appendChild(editorPane);

    const consolePane = el('div', 'consolepane', '');
    const con = el('div', 'console', `<span class="dim">Output appears here when you run.${e.check && e.check.mode === 'exact' ? `\nExpected: ${esc(e.check.value)}` : ''}</span>`);
    con.setAttribute('role', 'status');
    con.setAttribute('aria-live', 'polite');
    consolePane.appendChild(con);
    runwrap.appendChild(consolePane);

    body.appendChild(runwrap);
    card.appendChild(body);
    return card;
  }

  // Progressive hints: one nudge per click, and using one is fed to the model.
  function hintButton(e, card) {
    const wrap = el('div', 'hintwrap', '');
    const list = el('ol', 'hintlist', '');
    const b = el('button', 'btn ghost', `💡 Hint (${e.hints.length})`);
    b.type = 'button';
    let shown = 0;
    b.onclick = () => {
      list.appendChild(el('li', '', inline(e.hints[shown++])));
      card._state.hintShown = true;
      if (shown >= e.hints.length) b.remove();
      else b.textContent = `💡 Next hint (${e.hints.length - shown} left)`;
    };
    wrap.appendChild(b);
    wrap.appendChild(list);
    return wrap;
  }

  // Predict: commit to an answer *before* seeing it — the commitment is the learning.
  function renderPredict(e, card) {
    card.appendChild(cardHeader('Predict', e));
    if (isDone(e)) card.classList.add('is-done');
    const body = el('div', 'exbody', '');
    body.appendChild(el('div', 'goal', renderMD(e.goal)));
    if (e.start) body.insertAdjacentHTML('beforeend', codeBlockHTML(e.start, 'rust'));
    if (e.expected == null) { card.appendChild(body); return card; }
    const form = el('form', 'predict', '<label><span>Your prediction</span><input type="text" autocomplete="off" spellcheck="false" required></label><button class="btn primary" type="submit">Check</button>');
    const fb = el('div', 'qfb', '');
    fb.setAttribute('role', 'status');
    const reveal = el('details', 'sol', `<summary>Just show me</summary>${codeBlockHTML(e.expected)}`);
    const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
    form.onsubmit = (ev) => {
      ev.preventDefault();
      const guess = $('input', form).value;
      const correct = norm(guess) === norm(e.expected);
      fb.innerHTML = correct ? '<span class="ok">✔ Exactly right.</span>' : '<span class="no">✘ Not quite — have another look, or reveal it below.</span>';
      for (const c of e.concepts) ADB.observe(S.um, c, { correct, used_hint: false, weight: LV.observationWeight(e.level) });
      recordOutcome(e, { correct, solution: reveal.open });
      if (correct) { markDone(e); card.classList.add('is-done'); reveal.open = true; }
      saveModel(); updateProgress();
    };
    body.appendChild(form); body.appendChild(fb); body.appendChild(reveal);
    card.appendChild(body);
    return card;
  }

  // Rebuild the syntax-highlighted overlay once after the DOM settles.
  function refreshEditorSync(ed) {
    requestAnimationFrame(() => { syncScroll(ed); });
  }

  function syncScroll(ed) {
    if (!ed || !ed.ta) return;
    const { ta, hl, ln } = ed;
    hl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
    ln.scrollTop = ta.scrollTop;
  }

  // A real-ish editor: a highlighted <pre> beneath a transparent <textarea>,
  // with a line-number gutter that scrolls in lock-step.
  function buildEditor(code) {
    const elmn = el('div', 'ed', '');
    const ln = el('div', 'ln', '1');
    elmn.appendChild(ln);
    const wrap = el('div', 'codewrap', '');
    const hl = el('pre', 'hl', '');
    const ta = document.createElement('textarea');
    ta.name = 'code';
    ta.setAttribute('aria-label', 'Rust code editor');
    ta.spellcheck = false;
    ta.autocapitalize = 'off';
    ta.autocomplete = 'off';
    ta.value = code;
    wrap.appendChild(hl);
    wrap.appendChild(ta);
    elmn.appendChild(wrap);
    const ed = { el: elmn, ta, ln, hl };
    ta.addEventListener('input', () => { paint(ed); if (ed.onChange) ed.onChange(); });
    const insert = (text) => {
      // execCommand keeps the native undo stack; fall back to direct splice.
      if (!document.execCommand || !document.execCommand('insertText', false, text)) {
        const s = ta.selectionStart, e2 = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + text + ta.value.slice(e2);
        ta.selectionStart = ta.selectionEnd = s + text.length;
        paint(ed); if (ed.onChange) ed.onChange();
      }
    };
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); if (ed.onRun) ed.onRun(); return; }
      // Escape releases focus so keyboard users aren't trapped by Tab-indents
      if (ev.key === 'Escape') { ta.blur(); return; }
      if (ev.key === 'Tab' && !ev.shiftKey) { ev.preventDefault(); insert('    '); return; }
      // Enter keeps the current line's indentation (+1 level after `{`)
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.altKey) {
        const before = ta.value.slice(0, ta.selectionStart);
        const line = before.slice(before.lastIndexOf('\n') + 1);
        const indent = (line.match(/^\s*/) || [''])[0] + (/[{([]\s*$/.test(line) ? '    ' : '');
        ev.preventDefault(); insert('\n' + indent);
      }
    });
    ta.addEventListener('scroll', () => syncScroll(ed));
    ta.addEventListener('resize', () => paint(ed));
    paint(ed);
    return ed;
  }

  // Render highlighted code + line numbers, then realign the overlay.
  function paint(ed) {
    const { ta, ln, hl } = ed;
    const code = ta.value;
    const n = Math.max(code.split('\n').length, 1);
    ln.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    // grow with the code (no inner vertical scrollbar) up to a sane cap
    ta.rows = Math.min(Math.max(n + 1, 10), 32);
    hl.innerHTML = highlightRust(code) + (code.endsWith('\n') ? '<br>' : '');
    syncScroll(ed);
  }

  async function doRun(e, ta, card, btn) {
    const code = ta.value;
    const con = $('.console', card);
    btn.disabled = true; btn.textContent = 'Compiling…';
    con.innerHTML = '<span class="dim">Compiling with rustc…</span>';
    con.setAttribute('aria-busy', 'true');
    try {
      const r = await S.runner.run(code, e);
      if (r.error && r.exit == null) throw new Error(r.error);
      card._state.runCount++;
      const compileFailed = r.exit !== 0 && /error(\[E\d+\])?:/.test(r.stderr || '');
      const hasCheck = e.check && e.check.mode !== 'none';
      const correct = hasCheck ? computeVerdict(r, e) === 'pass' : r.exit === 0;

      // verdict first: the learner should know pass/fail before reading logs
      let html = '';
      if (r.phase === 'compiler-unavailable') html += '<div class="verdict info">Compiler unavailable in this mode</div>';
      else if (correct) html += `<div class="verdict pass">✔ ${hasCheck ? 'Output matches — nice!' : 'Compiled and ran cleanly'}</div>`;
      else if (compileFailed) html += '<div class="verdict fail">✘ Didn’t compile — the error below is the lesson. Read it top to bottom.</div>';
      else if (/not yet implemented/.test(r.stderr || '')) html += '<div class="verdict fail">✘ Hit a <code>todo!()</code> — that’s your cue: replace it with real code</div>';
      else if (hasCheck) html += '<div class="verdict fail">✘ Ran, but the output isn’t what we expected</div>';
      else html += `<div class="verdict fail">✘ Exited with code ${esc(r.exit)}</div>`;
      if (r.stdout) html += `<div class="clabel-con">stdout</div><span>${esc(r.stdout)}</span>`;
      if (r.stderr) html += `<div class="clabel-con">${compileFailed ? 'compiler' : 'stderr'}</div><span class="${/error|panicked/i.test(r.stderr) ? 'err' : 'dim'}">${colorDiagnostics(r.stderr)}</span>`;
      if (!r.stdout && !r.stderr) html += '<span class="dim">(no output)</span>';
      if (hasCheck && !correct && !compileFailed && e.check.mode !== 'none') {
        html += `<div class="clabel-con">expected ${e.check.mode === 'contains' ? 'output to contain' : 'output'}</div><span class="ok">${esc(e.check.mode === 'auto' ? e.expected : e.check.value)}</span>`;
      }
      html += `<div class="dim con-foot">exit ${esc(r.exit)} · ${r.durationMs || 0}ms</div>`;
      con.innerHTML = html;

      if (r.phase === 'compiler-unavailable') return;
      recordOutcome(e, { correct, hint: card._state.hintShown, solution: card._state.solOpened });
      if (correct && !e._generated) { markDone(e); card.classList.add('is-done'); }
      for (const c of e.concepts) ADB.observe(S.um, c, { correct, used_hint: card._state.hintShown, weight: LV.observationWeight(e.level) });
      saveModel(); updateProgress();
      // more-practice surfaced after a failure
      // offer extra practice after a second miss (the first is often by design)
      if (!correct) {
        card._state.misses = (card._state.misses || 0) + 1;
        if (card._state.misses >= 2) maybeOfferMore(e, card);
        const sol = card._state.solutionEl;
        if (sol && sol.hidden && card._state.misses >= card._state.solutionAfter) {
          sol.hidden = false; const note = $('.sol-note', card); if (note) note.remove();
        } else if (sol && sol.hidden) {
          const note = $('.sol-note', card); const left = card._state.solutionAfter - card._state.misses;
          if (note) note.textContent = `Solution appears after ${left} more missed run${left > 1 ? 's' : ''}`;
        }
      }
    } catch (err) {
      con.innerHTML = `<div class="verdict fail">Couldn’t reach the runner</div><span class="err">${esc(String((err && err.message) || err))}</span>`;
    } finally {
      con.removeAttribute('aria-busy');
      btn.disabled = false; btn.textContent = '▶ Run';
    }
  }

  // Make rustc diagnostics scannable: highlight error/warning/help headers and codes.
  function colorDiagnostics(s) {
    return esc(s)
      // the runner compiles in a temp dir; show the file the learner knows
      .replace(/(?:[A-Za-z]:)?(?:[\\/][^\s:\\/]+)+[\\/](\w+\.rs)/g, '$1')
      .replace(/^(error(?:\[E\d+\])?)(:)/gm, '<b class="d-err">$1</b>$2')
      .replace(/^(warning)(:)/gm, '<b class="d-warn">$1</b>$2')
      .replace(/^(\s*=?\s*)(help|note)(:)/gm, '$1<b class="d-help">$2</b>$3')
      .replace(/\[(E\d{4})\]/g, (m, code) => `[<a href="https://doc.rust-lang.org/error_codes/${code}.html" target="_blank" rel="noopener">${code}</a>]`);
  }
  // `contains` matches stdout only: rustc errors echo source lines, so searching
  // stderr let a compile error "pass" a check that names a string in the code.
  function computeVerdict(r, e) {
    const c = e.check;
    let pass = false;
    if (c.mode === 'exact') pass = (r.stdout || '').trim() === c.value.trim();
    else if (c.mode === 'contains') pass = (r.stdout || '').includes(c.value);
    else if (c.mode === 'auto') pass = (r.stdout || '').trim() === (e.expected || '').trim();
    return pass ? 'pass' : 'fail';
  }

  function markDone(e) { S.um.done[exerciseId(S.m, S.l, e)] = true; checkComplete(); }

  function maybeOfferMore(e, card) {
    if ($('.more', card)) return;
    if (e._generated) return;
    const more = el('div', 'more', '');
    more.appendChild(el('div', '', `Stuck on <b>${esc(e.concepts[0] || 'this')}</b>? Try a fresh, smaller problem on the same idea, then come back.`));
    const b = el('button', 'btn', '✨ More practice on this');
    b.type = 'button';
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Generating…';
      let gen = null;
      if (S.mode === 'dynamic') {
        try {
          const r = await fetch('/api/adapt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept: e.concepts[0], persona: S.course.persona, userId: S.userId, difficulty: e.difficulty }) }).then((x) => x.json());
          gen = r.item;
        } catch (_) { gen = null; }
      }
      const prev = $('.gen', more); if (prev) prev.remove();
      const slot = el('div', 'gen', '');
      if (gen) {
        slot.appendChild(renderExercise({ ...gen, concepts: e.concepts, _generated: true }));
      } else {
        const other = otherItemFor(e);
        slot.appendChild(el('div', 'notice', other
          ? `No generator in this mode — but <a href="#${other.m.id}/${other.l.id}">${esc(other.l.title)}</a> also practises <b>${esc(e.concepts[0])}</b>.`
          : 'No generator in this mode. Re-read the section above, open a hint, then try again.'));
      }
      more.appendChild(slot);
      b.disabled = false; b.textContent = '✨ Another one';
    };
    more.appendChild(b);
    card.appendChild(more);
  }

  function stableShuffle(arr, seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      const j = h % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Another lesson that exercises the same concept (static-mode "more practice").
  function otherItemFor(e) {
    const c = e.concepts[0];
    return flatLessons().find((x) => x.l !== S.l && [...x.l.exercises, ...x.l.quizzes].some((it) => (it.concepts || []).includes(c)));
  }

  // ---------- quiz / MCQ renderer ----------
  // A wrong pick greys out that option and invites a retry; the answer is only
  // given away after two misses, so a guess can't be "learned" by elimination UI.
  function renderQuiz(q) {
    const card = el('section', 'quizcard', '');
    card.appendChild(cardHeader('Check your understanding', { ...q, difficulty: 0 }));
    const done = isDone(q);
    if (done) card.classList.add('is-done');
    const body = el('div', 'exbody', '');
    // the parser lifts fenced code out of the prose; quizzes still need to show it
    if (q.start) body.insertAdjacentHTML('beforeend', codeBlockHTML(q.start, 'rust'));
    body.appendChild(el('div', 'goal', renderMD(q.goal)));
    const opts = el('div', 'qopts', '');
    opts.setAttribute('role', 'group');
    const fb = el('div', 'qfb', '');
    fb.setAttribute('role', 'status');
    const why = q.explanation ? el('details', 'hints', `<summary>Why?</summary><div>${renderMD(q.explanation)}</div>`) : null;
    const letters = 'ABCDEFGH';
    // Authors tend to put the right answer first; show a stable per-item shuffle
    // so "always pick A" doesn't work and reloads don't reorder.
    const order = stableShuffle((q.options || []).map((_, i) => i), `${q.id || q.goal}@${curIter()}`);
    const options = order.map((i) => q.options[i]);
    const rightIdx = order.indexOf(Number(q.answer));
    let misses = 0;
    const finish = () => {
      [...opts.children].forEach((c) => { c.disabled = true; });
      opts.children[rightIdx] && opts.children[rightIdx].classList.add('right');
      if (why) why.open = true;
    };
    options.forEach((opt, i) => {
      const b = el('button', 'qopt', `<span class="key">${letters[i]}</span><span>${inline(opt)}</span>`);
      b.type = 'button';
      b.onclick = () => {
        const correct = i === rightIdx;
        for (const c of q.concepts) ADB.observe(S.um, c, { correct, used_hint: misses > 0, weight: LV.observationWeight(q.level) });
        recordOutcome(q, { correct, solution: !correct && misses >= 1 /* a 2nd miss reveals the answer */ });
        if (correct) {
          fb.innerHTML = `<span class="ok">✔ Correct${misses ? ' — got there' : ''}!</span>`;
          markDone(q); card.classList.add('is-done'); finish();
        } else {
          misses++;
          b.classList.add('wrong'); b.disabled = true;
          if (misses >= 2) { fb.innerHTML = `<span class="no">✘ Not quite — the answer is ${letters[rightIdx] || ''}. Read why below.</span>`; finish(); }
          else fb.innerHTML = '<span class="no">✘ Not that one — try again.</span>';
        }
        saveModel(); updateProgress();
      };
      opts.appendChild(b);
    });
    body.appendChild(opts); body.appendChild(fb);
    if (why) body.appendChild(why);
    if (done) { fb.innerHTML = '<span class="ok">✔ You answered this one already.</span>'; finish(); }
    card.appendChild(body);
    return card;
  }

  // ---------- footer nav + progress ----------
  function footerNav() {
    const nav = el('div', 'footnav', '');
    const all = flatLessons();
    const idx = all.findIndex((x) => x.m.id === S.m.id && x.l.id === S.l.id);
    const prev = idx > 0 ? all[idx - 1] : null;
    let next = idx < all.length - 1 ? all[idx + 1] : null;
    // adaptive: prefer the next lesson in the same module
    nav.setAttribute('aria-label', 'Lesson navigation');
    if (prev) {
      const a = el('a', 'btn ghost navbtn', `<span class="nav-label">← Previous</span>${esc(prev.l.title)}`);
      a.href = `#${prev.m.id}/${prev.l.id}`; nav.appendChild(a);
    } else nav.appendChild(el('span', '', ''));
    const n = lessonCounts({ m: S.m, l: S.l });
    const left = n.total - n.done;
    if (next) {
      const a = el('a', 'btn primary navbtn', `<span class="nav-label">Next${next.m.id !== S.m.id ? ` · ${esc(moduleNum(next.m))} ${esc(next.m.title)}` : ''} →</span>${esc(next.l.title)}`);
      a.href = `#${next.m.id}/${next.l.id}`;
      if (left) nav.appendChild(el('span', 'nav-left', `${left} exercise${left > 1 ? 's' : ''} left in this lesson`));
      nav.appendChild(a);
    } else {
      const bb = el('button', 'btn primary navbtn', '🏁 Finish → back to Home');
      bb.type = 'button';
      bb.onclick = () => goHome(); nav.appendChild(bb);
    }
    return nav;
  }

  function updateProgress() {
    // header: "Iteration n/N" switcher once there's more than one, and the
    // Iterate button once the latest iteration is finished
    const nav = $('#iterNav'), iterBtn = $('#iterateBtn');
    if (nav) {
      const N = latestIter(), n = curIter();
      nav.hidden = !(N > 1 || S.previewPlan);
      $('#iterLabel').textContent = S.previewPlan ? `Preview · depth ${S.previewPlan.preview}` : `Iteration ${n}/${N}`;
      $('#iterPrev').disabled = !!S.previewPlan || n <= 1;
      $('#iterNext').disabled = !!S.previewPlan || n >= N;
    }
    if (iterBtn) iterBtn.hidden = !canIterate();
    const n = totalItems(), d = Math.min(doneCount(), totalItems());
    const pct = n ? Math.round((d / n) * 100) : 0;
    $('#progressPct').innerHTML = `<b>${d}</b>/${n} done`;
    $('#progressBar').value = pct;
    $('#progressBar').setAttribute('aria-label', `Course progress: ${d} of ${n} exercises done`);
    const lc = $('#lessonCount');
    if (lc && S.l && location.hash) { const c = lessonCounts({ m: S.m, l: S.l }); lc.textContent = `${c.done}/${c.total} exercises done`; }
  }

  // ---------- router ----------
  function router() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return renderHome();
    const [mId, lId] = h.split('/');
    if (lId) renderLesson(mId, lId);
    else renderHome();
  }

  // header logo -> home
  const brand = $('#brandHome');
  if (brand) brand.addEventListener('click', (e) => { e.preventDefault(); goHome(); });
  // iteration switcher: stay on the same lesson if it exists in the target iteration
  const switchIter = (d) => {
    const target = curIter() + d;
    if (target < 1 || target > latestIter()) return;
    const m = S.m && S.m.id, l = S.l && S.l.id, inLesson = !!location.hash;
    setIter(target);
    if (inLesson && planLessons(target).some((x) => x.m.id === m && x.l.id === l)) router(); else goHome();
  };
  $('#iterPrev').addEventListener('click', () => switchIter(-1));
  $('#iterNext').addEventListener('click', () => switchIter(1));
  $('#iterateBtn').addEventListener('click', () => iterate());
  window.addEventListener('popstate', () => { if (!location.hash) renderHome(); });

  window.addEventListener('hashchange', router);
  initTheme();
  boot();
})();
