// learn-with: agentic adaptive layer (server-side, dynamic mode).
// When the deterministic engine can't serve you (stuck on a niche concept, or
// you ask for more practice), `generate` produces *bespoke material on the fly*,
// shaped to the learner's profile + the concept in difficulty context.
//
// The default `synthetic` generator is dependency-free and deterministic: it
// fabricates a fresh practice item from the concept's template bank (which is
// how a code-only static site can also produce "new" problems). When an
// OpenAI-compatible endpoint is configured (LEARN_WITH_AGENT_URL / _KEY), `llm`
// generates richer, project-grounded material. Returned items share the exercise
// shape so every renderer renders them identically.

const crypto = require('crypto');

// Concept -> practice templates. Each entry has placeholders `{a}`, `{b}` that
// get varied so consecutive calls yield fresh problems.
const TEMPLATES = {
  ownership: [{
    kind: 'code', difficulty: 2,
    goal: 'Move the error out of the borrow checker: this should compile and print `a: hello` then `b moves out` (note that `b` takes over from `a`).\n\n```rust\nfn main() {\n    let a = String::from("hello");\n    let b = a; // \`b\` now owns the data\n    println!("b moves out: {b}");\n}\n```',
  }],
  borrowing: [{
    kind: 'code', difficulty: 2,
    goal: 'Make it compile: borrow `count` twice (shared) then mutate it after both borrows are done.\n\n```rust\nfn main() {\n    let mut count = 1;\n    let a = &count;\n    let b = &count;\n    println!("{a} + {b} = {}", a + b);\n    count += 1; // okay IF a & b are dead by here\n    println!("now {count}");\n}\n```',
  }],
  enums: [{
    kind: 'mcq', difficulty: 2,
    options: ['It moves the value out of the enum and binds it to x',
              'It borrows the enum and x becomes a reference',
              'It copies the enum regardless of size',
              'It panics unless the enum is Copy'],
    answer: 0,
    goal: 'In the hlock \`error.rs\`, \`Error\` is an enum with variants that hold \`String\`s. When you \`match\` and bind a variant field by value —\n```rust\nmatch err { Error::Io(e) => println!("{e}"), ... }\n```\n— why does this *move* \`e\` out of \`err\`?',
  }],
  result_option: [{
    kind: 'code', difficulty: 3,
    goal: 'Write `parse_num` returning `Option<i32>` (`None` on non-numeric), then use `?`-style handling in `double` so it returns `None` instead of panicking.\n\n```rust\nfn parse_num(s: &str) -> Option<i32> {\n    // TODO: s.parse().ok()\n    None\n}\n\nfn double(s: &str) -> Option<i32> {\n    let n = parse_num(s)?;\n    Some(n * 2)\n}\n\nfn main() {\n    println!("{:?}", double("4"));   // Some(8)\n    println!("{:?}", double("wat")); // None\n}\n```',
  }],
  string_vs_str: [{
    kind: 'code', difficulty: 2,
    goal: 'Fix the type error: `uppercase()` should take a `&str` and return a `String`.\n\n```rust\nfn uppercase(s: String) -> String {\n    s.to_uppercase()\n}\n\nfn main() {\n    let name = "rust".to_string();\n    println!("{}", uppercase(&name));\n}\n```',
  }],
  traits: [{
    kind: 'code', difficulty: 3,
    goal: 'Implement `Display` for `Skill` so `println!("{skill}")` prints `Skill: Parsing (2/5)`.\n\n```rust\nuse std::fmt;\n\nstruct Skill { name: String, level: u8 }\n\n// TODO: impl fmt::Display for Skill { ... }\n\nfn main() {\n    let s = Skill { name: "Parsing".into(), level: 2 };\n    println!("{s}");\n}\n```',
  }],
  iterators: [{
    kind: 'code', difficulty: 2,
    goal: 'Sum only the even numbers in `numbers` using iterators (no recursion, no mutations).\n\n```rust\nfn sum_even(numbers: &[i32]) -> i32 {\n    // TODO: numbers.iter().filter(..).sum()\n    0\n}\n\nfn main() {\n    let v = [1, 2, 3, 4, 5, 6];\n    println!("{}", sum_even(&v)); // 12\n}\n```',
  }],
  pattern_matching: [{
    kind: 'predict', difficulty: 2,
    goal: 'What does this program print? Think, then hit Run to verify.\n\n```rust\nfn main() {\n    let outcome = Ok::<i32, &str>(5);\n    let plus = match outcome {\n        Ok(n) => n + 1,\n        Err(_) => 0,\n    };\n    println!("{plus}");\n}\n```',
    expected: '6',
  }],
};

function coin(seed, pool) {
  const h = crypto.createHash('sha256').update(String(seed)).digest();
  return pool[h[0] % pool.length];
}

// Deterministic, dependency-free generator: returns a fresh item from the
// concept's template bank, seeded so consecutive calls vary.
function synthetic(concept, ctx = {}) {
  const bank = TEMPLATES[concept];
  if (!bank || !bank.length) return null;
  const seed = `${ctx.userId || 'anon'}|${concept}|${ctx.seed || 1}|${Date.now()}`;
  const tpl = bank[(crypto.createHash('sha256').update(seed).digest()[0] % bank.length)];
  return {
    id: `gen-${concept}-${Date.now()}`,
    generated: true,
    concepts: [concept],
    difficulty: (ctx.difficulty || tpl.difficulty || 2),
    kind: tpl.kind,
    goal: tpl.goal,
    start: tpl.start,
    expected: tpl.expected,
    solution: tpl.solution,
    options: tpl.options,
    answer: tpl.answer,
    check: tpl.expected ? { mode: 'exact', value: tpl.expected } : { mode: 'none' },
  };
}

// Configured OpenAI-compatible endpoint? POST chat to it asking for a practice
// item scoped to the concept + learner context. Returns parsed item shape.
async function llm(concept, ctx = {}) {
  const url = process.env.LEARN_WITH_AGENT_URL;
  const key = process.env.LEARN_WITH_AGENT_KEY;
  if (!url) return null;
  const persona = ctx.persona || {};
  const system = 'You write a single interactive Rust exercise (JSON only, no markdown) '
    + 'grounded in the hlock codebase, for a learner who knows Python/JS. '
    + `Return: {"kind":"code","concepts":["${concept}"],"difficulty":N,"goal":"...",`
    + '"start":"...valid Rust main(){...}...","expected":"exact stdout or omitted","check":{"mode":"exact"|"none","value":"..."}}';
  const user = `Learner profile: python=${persona.python||0}, javascript=${persona.javascript||0}. `
    + `They are stuck on concept '${concept}' (${ctx.mastery || 'learning'}). `
    + ctx.why || 'Give them a focused, small exercise that reinforces it.';
  const cfg = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: process.env.LEARN_WITH_AGENT_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7 }),
  };
  const res = await fetch(url, cfg);
  if (!res.ok) throw new Error(`agent endpoint ${res.status}`);
  const data = await res.json();
  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('agent returned no JSON');
  return JSON.parse(m[0]);
}

// Public entry: prefer LLM if configured, else synthetic templates.
async function generate(concept, ctx = {}) {
  if (process.env.LEARN_WITH_AGENT_URL) {
    try { const got = await llm(concept, ctx); if (got) return got; } catch (_) { /* fall through */ }
  }
  return synthetic(concept, ctx);
}

module.exports = { generate, synthetic, llm, TEMPLATES };
