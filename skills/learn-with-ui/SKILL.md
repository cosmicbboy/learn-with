---
name: learn-with-ui
description: 'The learn-with UI and templates: the SPA (ui/app.js), the markdown renderer (tables, callouts, code blocks), the real code editor (transparent textarea over a highlighted pre, scroll-synced line-number gutter, single scrollbar, matched metrics), light/dark mode, and the logo. Capture all the rendering/editor gotchas learned this session so UI iteration is fast and bug-free. Use when styling, theming, or fixing how a course looks/renders. Trigger words: "ui", "styles", "editor", "line numbers", "markdown table", "light/dark", "theme toggle", "logo", "scrollbar", "rendermd", "split view".'
---

# The learn-with UI

The UI is a zero-dependency SPA rendered into `main#root` by `ui/app.js`, styled by
`ui/styles.css`, shelled by `ui/index.html`. It renders the syllabus (Home), the adaptive
lesson view (split-view editor + console), quizzes, hints, solutions, and mastery. It
works identically in both targets — mode is detected at boot by probing `/api/health`
(dynamic) else falling back to static + `ui/wasm-runner.js`.

## The markdown renderer (`renderMD` in `ui/app.js`)

Dependency-free block renderer. Highlights and the rules that avoid bugs:

- **Tables must be handled explicitly** — raw `| a | b |` lines are NOT valid HTML and
  rendered as literal text unless the parser builds `<table>`. `renderMD` detects a
  `|`-delimited header followed by a `|---|` separator row and emits a styled
  `<div class="tbl-wrap"><table>…</table></div>`. There's no MD library; keep this code.
- **Headings**: `#` count → `<h${level}>`; do NOT emit the literal `##` as a tag (a bug
  that rendered `<## …>` as escaped text).
- **Escaping**: everything is escaped before inline formatting; inline code, `**bold**`,
  `*italic*`, and links are applied in a safe order.
- **Authoring markers** (`<solution>`, `<hint>`, `<expected>`, …) are stripped by the
  *parser* in `lib/content.js` — never let them render as literal text.

## The code editor (`buildEditor` in `ui/app.js`)

A real-ish code editor built from primitives:

- A transparent `<textarea>` floats **over a highlighted `<pre class="hl">`** (the
  tokenizer in `highlightRust`). The textarea text is invisible (`-webkit-text-fill-color:
  transparent`) with a visible caret; the `<pre>` shows the highlighted tokens.
- **Line numbers** live in a `.ln` gutter that scroll-syncs with the textarea.
- **Alignment is exact**: the gutter and code must share the SAME font-size, line-height,
  and top padding (all `var(--mono)`, currently `.85rem` / `1.3` / `.9rem`). If they
  drift, toggle `text-wrap`/padding and re-verify; see the "verify geometry" note below.
- **Single scrollbar rule**: the underlay `<pre>` must be `overflow: hidden` while the
  `<textarea>` is `overflow: auto`. If the `<pre>` is `overflow: auto` too, you get the
  **double horizontal scrollbar** bug (fixed this session). The JS still scroll-syncs the
  hidden `<pre>` via `scrollTop`/`scrollLeft`.
- `buildEditor` MUST set `textarea.value = code` before first paint (this was a real bug —
  the editor started blank because it never populated the starter code).

### Verify geometry, don't guess

After touching editor CSS, confirm computed styles match in the browser:
`getComputedStyle(textarea).lineHeight === getComputedStyle(gutter).lineHeight` and equal
font-size/padding-top — otherwise the line numbers column mis-aligns and looks broken.

## Theming — light/dark mode

`<html data-theme="light|dark">` switches a full CSS-variable palette
(`:root` + `[data-theme="dark"]`). The toggle is `#themeToggle` in the header
(`initTheme`/`applyTheme` in `ui/app.js`): it persists to `localStorage`
(`learnwith.theme`) and defaults to `prefers-color-scheme`. When adding colors, define
them as variables and provide a dark override — hard-coded colors (e.g. inline hex on the
concept-map legend dots) won't adapt and lose contrast in dark mode (the legend uses
`var()` values for exactly this reason).

## Layout / legibility principles (learned from QA)

- Keep **line-height tight but readable** — prose ~`1.5`, the code editor `1.3`,
  code-display `.codeblock pre` and the console `~1.4` (the user asked to reduce editor
  spacing repeatedly).
- **Never ship double scrollbars** and prefer slim styled scrollbars in the editor.
- Buttons with a small caption (`.nav-label`) need `color: inherit` / white-on-primary so
  captions are legible (a low-contrast gray on purple was a real bug).
- Every interactive editor textarea needs a `name` + `aria-label` (an a11y console issue).

## Logo & brand

`ui/logo.svg` — an open-book + play/run button + spark, in an hlock purple→rust-orange
gradient badge — is the header wordmark and the favicon. The whole logo link navigates
home (`#brandHome` → clears the hash + `renderHome()`). If you change the logo width, keep
`.brand-logo` sizing consistent with the header `--radius`/padding.

## Iteration loop for UI changes

1. Edit `ui/*`. 2. `npm run build` (emits `dist/`, re-bakes the `?v=` cache-buster).
3. Restart the server (content/API only; for pure UI the static server picks up new
   `dist/` files, but restart if you changed `lib/`). 4. QA in a browser and verify
   computed styles/DOM, not just eyeball. 5. `npm test` to confirm no course/parser regressions.
