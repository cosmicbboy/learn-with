/* learn-with: single-page app. Renders the syllabus + adaptive lesson view,
   wires the split-screen editor to a runner, tracks a per-user mastery model,
   and powers the adaptive + agentic layers. Works identically in static and
   dynamic modes (detected at boot). */

(() => {
  'use strict';
  const ADB = globalThis.LearnWithAdaptive;
  const RUN = globalThis.LearnWithRunner;

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
    return `<div class="codeblock"><div class="cb-head">${lang ? `<span class="cb-lang">${esc(lang)}</span>` : ''}</div><pre><code>${esc(code)}</code></pre></div>`;
  }

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
    const flush = () => { if (list) { const t = list.type; html += `<${t}>${list.items.join('')}</${t}>`; list = null; } };
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
        html += codeBlockHTML(b.join('\n'), lang);
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
        const t = ul ? 'ul' : 'ol';
        if (!list || list.type !== t) { flush(); list = { type: t, items: [] }; }
        list.items.push(`<li>${inline((ul || ol)[1])}</li>`);
      } else if (/^\s*(---|\*\*\*)\s*$/.test(l)) { flush(); html += '<div class="hr"></div>'; }
      else if (empty) { flush(); }
      else { flush(); html += `<p>${inline(l)}</p>`; }
      i++;
    }
    flush();
    return html;
  }

  // ---------- Rust syntax highlighter (tiny tokenizer) ----------
  const KW = new Set(['as','break','const','continue','crate','else','enum','extern','false','fn','for','if','impl','in','let','loop','match','mod','move','mut','pub','ref','return','self','Self','static','struct','super','trait','true','type','unsafe','use','where','while','async','await','dyn']);
  function highlightRust(code) {
    const re = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*'?)|(\b\d[\d_]*(?:\.[\d_]+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g;
    const out = [];
    let m;
    while ((m = re.exec(code))) {
      const [all, comment, block, str, ch, num, ident, ws, other] = m;
      if (comment || block) out.push(`<span style="color:#8b949e">${esc(all)}</span>`);
      else if (str || ch) out.push(`<span style="color:#a5d6ff">${esc(all)}</span>`);
      else if (num) out.push(`<span style="color:#79c0ff">${esc(num)}</span>`);
      else if (ident) out.push(KW.has(ident) ? `<span style="color:#ff7b72">${ident}</span>` : esc(ident));
      else if (ws) out.push(all);
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

  const A = window.__LEARN_WITH__ && window.__LEARN_WITH__.mode === 'static';

  function totalItems() {
    let n = 0;
    for (const m of S.course.modules) for (const l of m.lessons) n += l.exercises.length + l.quizzes.length;
    return n;
  }
  function doneCount() { return Object.keys(S.um.done || {}).length; }

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
    return m;
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const health = await fetch('/api/health').then((r) => r.ok).catch(() => false);
      S.mode = health ? 'dynamic' : 'static';
    } catch (_) { S.mode = 'static'; }
    const cp = S.mode === 'dynamic' ? '/api/course' : 'course.json';
    const course = await fetch(cp).then((r) => r.json());
    S.course = course;
    $('#courseShort').textContent = course.id;
    $('#modeBadge').textContent = S.mode + (S.mode === 'dynamic' ? ' · live rustc' : '');
    $('#modeBadge').classList.toggle('live', S.mode === 'dynamic');
    S.um = loadModel();
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
  function setPath(moduleId, lessonId) {
    location.hash = `${moduleId}/${lessonId}`;
    renderLesson(moduleId, lessonId);
  }
  function findLesson(moduleId, lessonId) {
    const m = S.course.modules.find((x) => x.id === moduleId);
    const l = m && m.lessons.find((x) => x.id === lessonId);
    return { m, l };
  }
  function flatLessons() {
    const out = [];
    for (const m of S.course.modules) for (const l of m.lessons) out.push({ m, l });
    return out;
  }

  // ---------- HOME / syllabus ----------
  function renderHome() {
    const root = $('#mount');
    root.innerHTML = '';
    const c = S.course;
    const hero = el('div', 'hero');
    hero.innerHTML = `<p class="sub">${esc(c.subtitle || '')}</p><h1>${esc(c.title)}</h1>`;
    if (c.blurb) hero.innerHTML += `<p>${renderMD(c.blurb)}</p>`;
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
    const cont = all.find(({ m, l }) => !(S.um.done && allItemsDone({ m, l }).every((id) => S.um.done[id])));
    if (cont) {
      const b = el('button', 'btn primary', '▶ Continue learning');
      b.onclick = () => setPath(cont.m.id, cont.l.id);
      hero.appendChild(el('div', 'adaptive', `Adaptive path active — material re-routes to your mastery. <b>Next up:</b> ${esc(cont.m.title)} → ${esc(cont.l.title)}`));
      hero.appendChild(b);
    }

    // concept map with mastery badges
    const cm = el('div', 'review', '');
    cm.innerHTML = '<div style="width:100%;font-size:.85rem;color:var(--ink-soft);margin-bottom:.2rem">Concept mastery map</div>';
    const concs = Object.keys(c.conceptMap).slice(0, 24);
    for (const k of concs) {
      const lvl = ADB.masteryLevelFor(S.um, k);
      const span = el('span', `concept ${lvl}`, esc(k));
      cm.appendChild(span);
    }
    root.appendChild(cm);

    // modules
    const mods = el('div', 'modules', '');
    for (const m of c.modules) {
      const card = el('div', 'module', '');
      const pct = lessonPct(m);
      card.innerHTML = `<h3><span style="color:var(--accent-2)">${m.id.split('-')[0] || ''}</span> ${esc(m.title)} ${m.capstone ? '<span class="tag">capstone</span>' : ''} <span style="margin-left:auto;font-size:.75rem;color:var(--ink-soft)">${Math.round(pct)}%</span></h3>`;
      if (m.blurb) card.innerHTML += `<div class="obj">${renderMD(m.blurb)}</div>`;
      if (m.objectives && m.objectives.length) card.innerHTML += `<div class="obj" style="margin-top:.3rem">🎯 ${m.objectives.slice(0, 2).map(inline).join(' · ')}</div>`;
      const ul = el('ul', 'lessons', '');
      for (const l of m.lessons) {
        const li = el('li', '', '');
        const a = el('a', '', `${esc(l.title)} <span class="concepts">${(l.concepts || []).map((x) => '#' + x).join(' ')}</span>`);
        a.href = `#${m.id}/${l.id}`;
        a.onclick = (e) => { e.preventDefault(); setPath(m.id, l.id); };
        li.appendChild(a);
        ul.appendChild(li);
      }
      card.appendChild(ul);
      mods.appendChild(card);
    }
    root.appendChild(mods);
  }

  function allItemsDone({ m, l }) {
    return [...l.exercises, ...l.quizzes].map((e) => `${m.id}/${l.id}/${e.id}`);
  }
  function lessonPct(m) {
    let done = 0, n = 0;
    for (const l of m.lessons) { for (const i of allItemsDone({ m, l })) { n++; if (S.um.done[i]) done++; } }
    return n ? (done / n) * 100 : 0;
  }

  // ---------- LESSON view ----------
  function renderLesson(moduleId, lessonId) {
    const found = findLesson(moduleId, lessonId);
    if (!found.l) return renderHome();
    S.m = found.m; S.l = found.l;
    const root = $('#mount');
    root.innerHTML = '';
    updateProgress();

    const m = found.m, l = found.l;
    const container = el('div', '');

    container.appendChild(el('div', 'breadcrumb', `<a href="#" data-home>Home</a> › <a href="#" data-home>${esc(m.title)}</a>`));
    $('[data-home]', container).addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; renderHome(); });
    container.appendChild(el('h1', 'lesson-title', esc(l.title)));
    if (l.objectives && l.objectives.length) {
      container.appendChild(el('div', 'objectives', `<h4>Learning objectives</h4><ul>${l.objectives.map((o) => `<li>${inline(o)}</li>`).join('')}</ul>`));
    }

    // adaptive banner: render layer + review nudge
    const concepts = l.concepts || [];
    const layer = concepts.length ? ADB.renderLayer(S.um, concepts[0], S.course.persona) : 'base';
    const due = ADB.scheduleReview(S.um, Object.keys(S.course.conceptMap || {}));
    const dueNames = due.filter((d) => d.due !== false && d.level !== 'unknown').slice(0, 3).map((d) => d.concept);
    const banner = el('div', 'adaptive', `Adaptive: showing <b>${layer}</b> explanation layer` + (dueNames.length ? ` · review due: ${dueNames.map((x) => `<b>${esc(x)}</b>`).join(', ')}` : ''));
    container.appendChild(banner);

    // body
    const body = el('div', 'prose', '');
    for (const seg of l.body) {
      if (seg.type === 'prose') body.appendChild(el('div', '', renderMD(seg.text)));
      else if (seg.type === 'callout') {
        body.appendChild(el('div', 'callout', `${seg.title ? `<div class="clabel">${esc(seg.title)}</div>` : '<div class="clabel">' + esc(seg.tone) + (seg.lang ? ' · ' + esc(seg.lang) : '') + '</div>'}<div>${renderMD(seg.text)}</div>`));
        const call = body.lastChild; call.setAttribute('data-tone', seg.tone);
      } else if (seg.type === 'hint') {
        body.appendChild(el('details', 'hints', `<summary>Hint</summary><p>${renderMD(seg.text)}</p>`));
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

  // ---------- exercise (code) renderer ----------
  function exerciseId(m, l, e) { return `${m.id}/${l.id}/${e.id}`; }

  function renderExercise(e) {
    const card = el('div', 'excard', '');
    const diff = '●'.repeat(e.difficulty || 2) + '○'.repeat(5 - (e.difficulty || 2));
    card.appendChild(el('div', 'hd', `<span class="dot"></span><b>Exercise</b> <span class="chips"><span class="diff" title="Difficulty">${esc(diff)}</span>${(e.concepts || []).map((c) => `<span class="chip-c">#${esc(c)}</span>`).join(' ')}</span>`));

    // predict / read-only exercises have no editor
    if (e.kind === 'predict') {
      const pbody = el('div', 'exbody', '');
      pbody.appendChild(el('div', 'goal', renderMD(e.goal)));
      if (e.expected != null) {
        pbody.appendChild(el('details', 'sol', `<summary>Reveal expected output</summary>${codeBlockHTML(e.expected)}`));
      }
      card.appendChild(pbody);
      return card;
    }

    const body = el('div', 'exbody', '');
    body.appendChild(el('div', 'goal', renderMD(e.goal)));

    // split view: editor + console
    const runwrap = el('div', 'runwrap', '');
    const editorPane = el('div', 'editor', '');
    editorPane.appendChild(el('div', 'bar', `<span class="filetab mono">main.rs</span><span class="bar-note">real compiler · run to verify</span>`));
    const ed = buildEditor(e.start || 'fn main() {\n    println!("hello");\n}');
    const ta = ed.ta;
    editorPane.appendChild(ed.el);
    const actions = el('div', 'actions', '');
    const runBtn = el('button', 'btn primary', '▶  Run');
    runBtn.onclick = () => doRun(e, ta, card, runBtn, ed);
    actions.appendChild(runBtn);
    if (e.hints && e.hints.length) {
      actions.appendChild(el('details', 'hints', `<summary>💡 Get a hint</summary><ul>${e.hints.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>`));
    }
    if (e.solution) actions.appendChild(el('details', 'sol', `<summary>👁 Show solution</summary>${codeBlockHTML(e.solution, 'rust')}`));
    editorPane.appendChild(actions);
    runwrap.appendChild(editorPane);

    const consolePane = el('div', 'consolepane', '');
    const con = el('div', 'console', '<span class="dim">— output will appear here —</span>');
    consolePane.appendChild(con);
    runwrap.appendChild(consolePane);

    body.appendChild(runwrap);
    card.appendChild(body);

    card._state = { runCount: 0, ed };
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
    ta.addEventListener('input', () => { paint(ed); });
    ta.addEventListener('keydown', (ev) => {
      // Tab inserts spaces (and keeps focus)
      if (ev.key === 'Tab') {
        ev.preventDefault();
        const s = ta.selectionStart, e2 = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(e2);
        ta.selectionStart = ta.selectionEnd = s + 4;
        paint(ed);
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
    hl.innerHTML = highlightRust(code) + (code.endsWith('\n') ? '<br>' : '');
    syncScroll(ed);
  }

  async function doRun(e, ta, card, btn) {
    const code = ta.value;
    const con = $('.console', card);
    const id = exerciseId(S.m, S.l, e);
    btn.disabled = true; btn.textContent = '⏳ compiling…';
    con.innerHTML = '<span class="dim">compiling with rustc…</span>';
    try {
      const r = await S.runner.run(code, e);
      const okCompile = !r.stderr && r.phase !== 'compile';
      card._state.runCount++;
      let html = '';
      if (r.stderr && /error|panicked|warning: unused/i.test(r.stderr)) html += `<span class="err">${esc(r.stderr)}</span>\n`;
      else if (r.stderr) html += `<span class="dim">${esc(r.stderr)}</span>\n`;
      if (r.stdout) html += `<span>${esc(r.stdout)}</span>`;
      if (!r.stdout && !r.stderr) html += '<span class="dim">(no output)</span>';
      html += `<span class="dim">\n— exit ${r.exit} · ${r.durationMs || 0}ms · ${r.phase} —</span>`;
      con.innerHTML = html;
      setConsoleClass(con, r.exit === 0 ? 'ok-run' : 'err-run');

      // adaptive observation + verdict
      let verdict = null;
      let correct;
      if (e.check && e.check.mode !== 'none') {
        verdict = computeVerdict(r, e);
        correct = verdict === 'pass';
        con.innerHTML += `<div class="verdict ${correct ? 'pass' : 'fail'}">${correct ? '✔ output matches — nice!' : '✘ output mismatch'}</div>`;
      } else {
        correct = r.exit === 0 && !(card._state._hintShown);
      }
      if (correct) markDone(e);
      for (const c of e.concepts) ADB.observe(S.um, c, { correct, used_hint: card._state._hintShown });
      saveModel(); updateProgress();
      // more-practice surfaced after a failure
      if (!correct) maybeOfferMore(e, card);
    } catch (err) {
      con.innerHTML = `<span class="err">${esc(String((err && err.message) || err))}</span>`;
    } finally {
      btn.disabled = false; btn.textContent = '▶ Run';
    }
  }

  function setConsoleClass(con, cls) { con.className = 'console'; if (cls === 'err-run') con.classList.add('err'); }
  function computeVerdict(r, e) {
    const c = e.check;
    const actual = (r.stdout || '') + (r.stderr || '');
    let pass = false;
    if (c.mode === 'exact') pass = (r.stdout || '').trim() === c.value.trim();
    else if (c.mode === 'contains') pass = actual.includes(c.value);
    else if (c.mode === 'auto') pass = (r.stdout || '').trim() === (e.expected || '').trim();
    return pass ? 'pass' : 'fail';
  }

  function markDone(e) { S.um.done[exerciseId(S.m, S.l, e)] = true; }

  function maybeOfferMore(e, card) {
    if ($('.more', card)) return;
    const more = el('div', 'more', '');
    more.appendChild(el('div', '', `Stuck on <b>${esc(e.concepts[0] || 'this')}</b>? Get a fresh, adaptive practice problem.`));
    const b = el('button', 'btn', '✨ Generate more practice (agentic)');
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'generating…';
      let gen;
      if (S.mode === 'dynamic') {
        const r = await fetch('/api/adapt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept: e.concepts[0], persona: S.course.persona, userId: S.userId, difficulty: e.difficulty }) }).then((x) => x.json());
        gen = r.item;
      } else {
        gen = null;
      }
      if (gen) {
        const gcard = renderExercise({ ...gen, concepts: e.concepts });
        const tag = el('div', 'adaptive', 'Agentic material — generated on the fly for you. Hit Run to verify it works.');
        more.appendChild(tag); more.appendChild(gcard);
      } else {
        more.appendChild(el('div', 'notice', 'Dynamic agent offline. In this mode, more practice maps to the next pre-authored exercise for this concept — keep going and review the concept map on Home.'));
      }
      b.disabled = false; b.textContent = '✨ Generate more practice (agentic)';
    };
    more.appendChild(b);
    card.appendChild(more);
  }

  // ---------- quiz / MCQ renderer ----------
  function renderQuiz(q) {
    const card = el('div', 'quizcard', '');
    card.appendChild(el('div', 'hd', `<span class="dot"></span><b>Check your understanding</b> <span class="chips">${(q.concepts || []).map((c) => `<span class="chip-c">#${esc(c)}</span>`).join(' ')}</span>`));
    const body = el('div', 'exbody', '');
    body.appendChild(el('div', 'goal', renderMD(q.goal)));
    const opts = el('div', 'qopts', '');
    const fb = el('div', 'qfb', '');
    const letters = 'ABCDEFGH';
    (q.options || []).forEach((opt, i) => {
      const b = el('button', 'qopt', `<span class="key">${letters[i]}</span><span>${opt}</span>`);
      b.onclick = () => {
        const correct = String(i) === String(q.answer) || i === Number(q.answer);
        [...opts.children].forEach((c) => c.classList.remove('sel', 'right', 'wrong'));
        b.classList.add('sel');
        if (correct) {
          b.classList.add('right');
          fb.innerHTML = '<span class="ok">✔ Correct! That concept sharpens.</span>';
        } else {
          b.classList.add('wrong');
          const rightIdx = Number(q.answer);
          if (q.options[rightIdx]) opts.children[rightIdx].classList.add('right');
          fb.innerHTML = `<span class="no">✘ Not quite — the answer was ${letters[rightIdx] || ''}.</span>`;
        }
        for (const c of q.concepts) ADB.observe(S.um, c, { correct, used_hint: false });
        if (correct) markDone(q);
        saveModel(); updateProgress();
      };
      opts.appendChild(b);
    });
    body.appendChild(opts); body.appendChild(fb);
    if (q.explanation) body.appendChild(el('details', 'hints', `<summary>Why?</summary><p>${renderMD(q.explanation)}</p>`));
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
    if (prev) {
      const b = el('button', 'btn ghost', `<span class="nav-label">← Previous</span>${esc(prev.m.id !== S.m.id ? `Module ${prev.m.id.split('-')[0]}: ` : '')}${esc(prev.l.title)}`);
      b.onclick = () => setPath(prev.m.id, prev.l.id); nav.appendChild(b);
    } else nav.appendChild(el('span', '', ''));
    if (next) {
      const b = el('button', 'btn primary', `${esc(next.l.title)}<span class="nav-label">Next →</span>`);
      b.onclick = () => setPath(next.m.id, next.l.id); nav.appendChild(b);
    } else {
      const bb = el('button', 'btn primary', '🏁 Course complete → Home');
      bb.onclick = () => { location.hash = ''; renderHome(); }; nav.appendChild(bb);
    }
    return nav;
  }

  function updateProgress() {
    const n = totalItems(), d = doneCount();
    const pct = n ? Math.round((d / n) * 100) : 0;
    $('#progressPct').textContent = `${d}/${n} exercises · ${pct}%`;
    $('#progressBar').value = pct;
  }

  // ---------- router ----------
  function router() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return renderHome();
    const [mId, lId] = h.split('/');
    if (lId) renderLesson(mId, lId);
    else renderHome();
  }

  window.addEventListener('hashchange', router);
  boot();
})();
