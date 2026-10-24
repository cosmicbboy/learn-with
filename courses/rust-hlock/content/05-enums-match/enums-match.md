---
title: "Enums and match — your pattern-matching superpower"
concepts: [enums, pattern_matching]
objectives:
  - Match exhaustively and destructure values
  - Use Option/Result ergonomically with match and if-let
---

## match is a switch on steroids

You saw `match` back in the manifest module. Now let's make it a reflex. `match` in Rust
is *exhaustive*: every possible value must have an arm, and each arm can
**destructure** (pull fields out). Python's `match`+`case` borrowed this idea; Rust
came first and is stricter.

```rust
fn main() {
    let opt: Option<i32> = Some(10);
    match opt {
        Some(n) => println!("got {n}"),
        None => println!("nothing"),
    }
}
```

The arms bind `n` out of `Some(n)` — that's destructuring. You can bind, ignore with
`_`, and use guards (`if n > 5`).

::: callout type="contrast" lang="python"
**For the Pythonista.** Python's `match opt: case Some(n): ...` maps 1:1. But Rust *requires*
you to cover `None` (exhaustiveness). Forgetting an arm is a compile error — a feature
you'll come to love.
:::

## if-let: match's leaner cousin

When you only care about *one* arm, `if let` is cleaner than a full `match`:

```rust
if let Some(n) = opt {
    println!("got {n}");
} // ignore None implicitly
```

## A real enum with data

Enums can carry data, like hlock's `Error` variants do. Let's build a tiny "outcome":
`Ok(count)`, `Skipped`, `Failed(reason)`.

::: exercise id="enum-data" kind="code" concepts="enums,pattern_matching" difficulty="3" check="exact:processed 4" hints="Run it: the `todo!()` in the `Processed` arm panics before anything prints|A variant with data binds it in the pattern, so `n` already holds the count inside `Outcome::Processed(n)`|Print `processed {n}` in the first arm, then replace the `_` wildcard with `Outcome::Skipped` and `Outcome::Failed(why)` arms"
Match on `Outcome` so the `Processed(count)` variant prints `processed 4`. Then replace
the `_` wildcard with explicit arms for `Skipped` and `Failed(why)`, so every variant is
handled by name. Expected output: `processed 4`.

```rust
enum Outcome {
    Processed(u32),
    Skipped,
    Failed(String),
}

fn main() {
    let o = Outcome::Processed(4);
    match o {
        Outcome::Processed(n) => todo!(), // TODO: print processed {n}
        // TODO: replace this wildcard with Outcome::Skipped and Outcome::Failed(why) arms
        _ => todo!(),
    }
}
```

<solution>
```rust
enum Outcome {
    Processed(u32),
    Skipped,
    Failed(String),
}

fn main() {
    let o = Outcome::Processed(4);
    match o {
        Outcome::Processed(n) => println!("processed {n}"),
        Outcome::Skipped => println!("skipped"),
        Outcome::Failed(why) => println!("failed: {why}"),
    }
}
```
:::


::: exercise id="enum-data" kind="code" level="+" concepts="enums,pattern_matching" difficulty="4" check="exact:processed 4; empty batch; skipped; failed at hash: bad json" hints="A literal can sit inside a pattern, so `Outcome::Processed(0)` matches only an empty batch, as long as it comes before the general arm|A struct-like variant destructures by field name: `Outcome::Failed { step, reason }`|You are matching on `&Outcome`, so the bindings are references and `format!` works on them as-is. Return `String::from(...)` or `format!(...)` from each arm"
Now `Outcome` has a struct-like variant, `Failed { step, reason }`, and an empty batch
deserves its own message. Write `describe` as a single `match` (no wildcard) so that:

- `Processed(0)` gives `empty batch`
- any other `Processed(n)` gives `processed n`
- `Skipped` gives `skipped`
- `Failed { step, reason }` gives `failed at STEP: REASON`

`main` maps `describe` over four outcomes. Expected output:
`processed 4; empty batch; skipped; failed at hash: bad json`.

```rust
enum Outcome {
    Processed(u32),
    Skipped,
    Failed { step: String, reason: String },
}

fn describe(o: &Outcome) -> String {
    todo!("one match: an empty batch, a count, skipped, and the struct-like Failed")
}

fn main() {
    let runs = vec![
        Outcome::Processed(4),
        Outcome::Processed(0),
        Outcome::Skipped,
        Outcome::Failed { step: String::from("hash"), reason: String::from("bad json") },
    ];
    let lines: Vec<String> = runs.iter().map(describe).collect();
    println!("{}", lines.join("; "));
}
```

<solution>
```rust
enum Outcome {
    Processed(u32),
    Skipped,
    Failed { step: String, reason: String },
}

fn describe(o: &Outcome) -> String {
    match o {
        Outcome::Processed(0) => String::from("empty batch"),
        Outcome::Processed(n) => format!("processed {n}"),
        Outcome::Skipped => String::from("skipped"),
        Outcome::Failed { step, reason } => format!("failed at {step}: {reason}"),
    }
}

fn main() {
    let runs = vec![
        Outcome::Processed(4),
        Outcome::Processed(0),
        Outcome::Skipped,
        Outcome::Failed { step: String::from("hash"), reason: String::from("bad json") },
    ];
    let lines: Vec<String> = runs.iter().map(describe).collect();
    println!("{}", lines.join("; "));
}
```
:::

::: exercise id="enum-data" kind="code" level="++" concepts="enums,pattern_matching" difficulty="4" check="exact:2 manifest error: missing [harness] table; 3 not found: harness.lock; 1 io error: store dir; 4 store error: (no detail); 5 agents/main: 404" hints="Guards go after the pattern: `Error::Io(e) if e.kind() == io::ErrorKind::NotFound => ...`, and the guarded arm must come before the plain `Error::Io(e)` arm|An empty `Store` message is a guard too: `Error::Store(s) if s.is_empty()`|Each arm returns a tuple, e.g. `(2, format!(...))`. For `Pull` the message is just `p.clone()`"
This `Error` enum is shaped like hlock's `error.rs` (with the `thiserror` attributes
and the TOML/JSON variants stripped so it runs with plain rustc). A CLI has to turn
each failure into an exit code and a one-line message. Write `triage` with these rules,
in this order:

| error | exit code | message |
|---|---|---|
| `Manifest(m)` | 2 | `manifest error: m` |
| `Io(e)` whose `e.kind()` is `NotFound` | 3 | `not found: e` |
| any other `Io(e)` | 1 | `io error: e` |
| `Store(s)` with an empty `s` | 4 | `store error: (no detail)` |
| any other `Store(s)` | 4 | `store error: s` |
| `Pull(p)` | 5 | `p` unchanged |

Expected output: `2 manifest error: missing [harness] table; 3 not found: harness.lock; 1 io error: store dir; 4 store error: (no detail); 5 agents/main: 404`.

```rust
use std::io;

#[derive(Debug)]
enum Error {
    Manifest(String),
    Store(String),
    Io(io::Error),
    Pull(String),
}

// (exit code, one-line message) for the CLI
fn triage(e: &Error) -> (i32, String) {
    todo!("match every variant; two of them need guards")
}

fn main() {
    let errors = vec![
        Error::Manifest(String::from("missing [harness] table")),
        Error::Io(io::Error::new(io::ErrorKind::NotFound, "harness.lock")),
        Error::Io(io::Error::new(io::ErrorKind::PermissionDenied, "store dir")),
        Error::Store(String::new()),
        Error::Pull(String::from("agents/main: 404")),
    ];
    let out: Vec<String> = errors
        .iter()
        .map(|e| {
            let (code, msg) = triage(e);
            format!("{code} {msg}")
        })
        .collect();
    println!("{}", out.join("; "));
}
```

<solution>
```rust
use std::io;

#[derive(Debug)]
enum Error {
    Manifest(String),
    Store(String),
    Io(io::Error),
    Pull(String),
}

fn triage(e: &Error) -> (i32, String) {
    match e {
        Error::Manifest(m) => (2, format!("manifest error: {m}")),
        Error::Io(e) if e.kind() == io::ErrorKind::NotFound => (3, format!("not found: {e}")),
        Error::Io(e) => (1, format!("io error: {e}")),
        Error::Store(s) if s.is_empty() => (4, String::from("store error: (no detail)")),
        Error::Store(s) => (4, format!("store error: {s}")),
        Error::Pull(p) => (5, p.clone()),
    }
}

fn main() {
    let errors = vec![
        Error::Manifest(String::from("missing [harness] table")),
        Error::Io(io::Error::new(io::ErrorKind::NotFound, "harness.lock")),
        Error::Io(io::Error::new(io::ErrorKind::PermissionDenied, "store dir")),
        Error::Store(String::new()),
        Error::Pull(String::from("agents/main: 404")),
    ];
    let out: Vec<String> = errors
        .iter()
        .map(|e| {
            let (code, msg) = triage(e);
            format!("{code} {msg}")
        })
        .collect();
    println!("{}", out.join("; "));
}
```
:::

::: exercise id="enum-data" kind="code" level="+++" concepts="enums,pattern_matching,result_option" difficulty="5" check="exact:install a1; keep; update a1 -> b2; remove b2; nothing" hints="Match on the pair itself: `match (locked, wanted) { (None, Some(w)) => ..., ... }`, with a guard for the equal-hash case|Give the variants named fields, e.g. `Update { from: String, to: String }`, and return `Option<Action>` so that two absent hashes give `None`"
**Spec only.** A sync step compares the hash pinned in the lockfile with the hash the
manifest now wants. Either side can be absent. Design an `Action` enum yourself
(`Install`, `Keep`, `Update`, `Remove`, carrying whichever hashes each needs), then write:

- `decide(locked: Option<&str>, wanted: Option<&str>) -> Option<Action>`:
  absent → present is an install, equal hashes keep, different hashes update,
  present → absent removes, and absent on both sides gives `None`.
- a function that renders an `Option<Action>` as `install H`, `keep`, `update A -> B`,
  `remove H` or `nothing`.

Run the five cases in `main` in order and join the results with `; `. Expected output:
`install a1; keep; update a1 -> b2; remove b2; nothing`.

```rust
fn main() {
    let cases: [(Option<&str>, Option<&str>); 5] = [
        (None, Some("a1")),
        (Some("a1"), Some("a1")),
        (Some("a1"), Some("b2")),
        (Some("b2"), None),
        (None, None),
    ];
    todo!("design Action, write decide and render, print the joined line")
}
```

<solution>
```rust
enum Action {
    Install { hash: String },
    Keep,
    Update { from: String, to: String },
    Remove { hash: String },
}

fn decide(locked: Option<&str>, wanted: Option<&str>) -> Option<Action> {
    match (locked, wanted) {
        (None, Some(w)) => Some(Action::Install { hash: w.to_string() }),
        (Some(l), Some(w)) if l == w => Some(Action::Keep),
        (Some(l), Some(w)) => Some(Action::Update { from: l.to_string(), to: w.to_string() }),
        (Some(l), None) => Some(Action::Remove { hash: l.to_string() }),
        (None, None) => None,
    }
}

fn render(a: Option<Action>) -> String {
    match a {
        Some(Action::Install { hash }) => format!("install {hash}"),
        Some(Action::Keep) => String::from("keep"),
        Some(Action::Update { from, to }) => format!("update {from} -> {to}"),
        Some(Action::Remove { hash }) => format!("remove {hash}"),
        None => String::from("nothing"),
    }
}

fn main() {
    let cases: [(Option<&str>, Option<&str>); 5] = [
        (None, Some("a1")),
        (Some("a1"), Some("a1")),
        (Some("a1"), Some("b2")),
        (Some("b2"), None),
        (None, None),
    ];
    let out: Vec<String> = cases.iter().map(|&(l, w)| render(decide(l, w))).collect();
    println!("{}", out.join("; "));
}
```
:::

## Exhaustiveness catches you

If you delete the `Outcome::Skipped` arm above, rustc complains: "non-exhaustive
patterns." That's the guardrail. Let's prove we appreciate it:

::: exercise id="exhaustive-quiz" kind="mcq" concepts="enums" difficulty="2" options="It refuses to compile until every variant has an arm|It silently returns ()|It only compiles in debug|It adds a catch-all automatically" answer="0" explain="`match` must be exhaustive: if any enum variant has no arm, rustc stops with E0004 and names the missing patterns. So adding a variant to an enum in hlock points you at every `match` that needs updating."
If a `match` on an enum is missing a variant arm, what does rustc do?
:::


::: exercise id="exhaustive-quiz" kind="mcq" level="++" concepts="enums,pattern_matching" difficulty="3" options="It fails with E0004: Some(_) is not covered, because guards do not count toward exhaustiveness|It compiles: 0 and n > 0 together cover every u32|It compiles, but panics at runtime if it is ever given Some(5)|It compiles with only an unreachable-pattern warning" answer="0" explain="The exhaustiveness checker ignores what a guard says, because a guard is arbitrary code it cannot prove things about. As far as rustc knows, `Some(n) if n > 0` might match nothing, so `Some(_)` is still uncovered and it reports E0004. The fix is to drop the guard (plain `Some(n)` after `Some(0)`) or add a `Some(_)` arm."
A subtler one. Does this compile?

```rust
fn bucket(n: Option<u32>) -> &'static str {
    match n {
        Some(0) => "zero",
        Some(n) if n > 0 => "positive",
        None => "none",
    }
}
```
:::

## Option/Result ergonomics with if-let

Splunkers melt this pattern into muscle memory:

```rust
fn describe_opt(o: Option<i32>) -> &'static str {
    match o {
        Some(0) => "zero",
        Some(n) if n < 100 => "small",
        Some(_) => "big",
        None => "nothing",
    }
}
```

::: exercise id="if-let-practice" kind="code" concepts="pattern_matching,result_option" difficulty="3" check="exact:The value is 42. That's great." hints="`if let` checks one pattern and binds its data when it matches, so you don't need a full `match`|The pattern is `Res::Ok(v)`, written as `if let Res::Ok(v) = r { ... }`|Print `The value is {v}. That's great.` inside the `if let` block, and `It failed.` in an `else` block"
Replace the `todo!()` with an `if let Res::Ok(v) = r { ... } else { ... }`. When `r`
holds `Res::Ok(42)`, print exactly `The value is 42. That's great.`; otherwise print
`It failed.`.

```rust
enum Res { Ok(i32), Err(String) }

fn main() {
    let r = Res::Ok(42);
    // TODO: use if let Res::Ok(v) = r { ... } else { ... }
    todo!()
}
```

<solution>
```rust
enum Res { Ok(i32), Err(String) }

fn main() {
    let r = Res::Ok(42);
    if let Res::Ok(v) = r {
        println!("The value is {v}. That's great.");
    } else {
        println!("It failed.");
    }
}
```
:::


::: exercise id="if-let-practice" kind="code" level="+" concepts="pattern_matching,result_option" difficulty="4" check="exact:trials: 3; trials: unlimited; trials: none allowed; error: bad int" hints="Patterns nest, so `Ok(Some(n))`, `Ok(None)` and `Err(e)` are each a single arm|A literal inside the nesting matches one exact value: `Ok(Some(0))`. Put it before the general `Ok(Some(n))` arm|The four arms return `format!(...)` or `String::from(...)` for `trials: N`, `trials: none allowed`, `trials: unlimited` and `error: E`"
Now the value is a `Result<Option<u32>, String>`: parsing can fail, and a missing limit
means "unlimited". Write `report` using **nested patterns**, one arm per shape:

- `Ok(Some(0))` gives `trials: none allowed`
- `Ok(Some(n))` gives `trials: n`
- `Ok(None)` gives `trials: unlimited`
- `Err(e)` gives `error: e`

Expected output: `trials: 3; trials: unlimited; trials: none allowed; error: bad int`.

```rust
fn report(r: Result<Option<u32>, String>) -> String {
    todo!("one arm per nested shape")
}

fn main() {
    let a = report(Ok(Some(3)));
    let b = report(Ok(None));
    let c = report(Ok(Some(0)));
    let d = report(Err(String::from("bad int")));
    println!("{a}; {b}; {c}; {d}");
}
```

<solution>
```rust
fn report(r: Result<Option<u32>, String>) -> String {
    match r {
        Ok(Some(0)) => String::from("trials: none allowed"),
        Ok(Some(n)) => format!("trials: {n}"),
        Ok(None) => String::from("trials: unlimited"),
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let a = report(Ok(Some(3)));
    let b = report(Ok(None));
    let c = report(Ok(Some(0)));
    let d = report(Err(String::from("bad int")));
    println!("{a}; {b}; {c}; {d}");
}
```
:::

::: exercise id="if-let-practice" kind="code" level="++" concepts="result_option,pattern_matching" difficulty="4" check="exact:ok err(random: spent $2.25 of $1.50) err(random: trial 12 > max 10) ok" hints="Each limit is an `Option`. `if let Some(max) = b.max_spend_usd { ... }` runs only when a limit is set, and inside it a plain `if spent > max` decides. Return early with `return Err(...)`|Edition 2021 has no `if let ... && ...` chains, so nest the `if` inside the `if let`|Format money with two decimals: `format!(...)` with `${spent:.2} of ${max:.2}`, prefixed by `b.strategy`. Finish with `Ok(())`"
This `Budget` has the same fields as hlock's `manifest.rs` `Budget`: `max_spend_usd` and
`max_trials` are `Option`s, because a manifest may leave either one out, and an absent
limit means no limit. Write `check(b, spent, trials)`:

1. If `max_spend_usd` is set and `spent` is greater than it, return
   `Err("STRATEGY: spent $X of $Y")` with both amounts to two decimals.
2. Else, if `max_trials` is set and `trials` is greater than it, return
   `Err("STRATEGY: trial T > max M")`.
3. Otherwise return `Ok(())`. Being exactly at a limit is fine.

Expected output: `ok err(random: spent $2.25 of $1.50) err(random: trial 12 > max 10) ok`.

```rust
#[allow(dead_code)]
struct Budget {
    max_spend_usd: Option<f64>,
    max_trials: Option<usize>,
    strategy: String,
    random_seed: u64,
}

fn check(b: &Budget, spent: f64, trials: usize) -> Result<(), String> {
    todo!("an if let per optional limit")
}

fn main() {
    let open = Budget { max_spend_usd: None, max_trials: None, strategy: String::from("grid"), random_seed: 0 };
    let tight = Budget { max_spend_usd: Some(1.5), max_trials: Some(10), strategy: String::from("random"), random_seed: 7 };
    let results = [
        check(&open, 99.0, 500),
        check(&tight, 2.25, 3),
        check(&tight, 0.5, 12),
        check(&tight, 1.0, 10),
    ];
    let out: Vec<String> = results
        .iter()
        .map(|r| match r {
            Ok(()) => String::from("ok"),
            Err(e) => format!("err({e})"),
        })
        .collect();
    println!("{}", out.join(" "));
}
```

<solution>
```rust
#[allow(dead_code)]
struct Budget {
    max_spend_usd: Option<f64>,
    max_trials: Option<usize>,
    strategy: String,
    random_seed: u64,
}

fn check(b: &Budget, spent: f64, trials: usize) -> Result<(), String> {
    if let Some(max) = b.max_spend_usd {
        if spent > max {
            return Err(format!("{}: spent ${spent:.2} of ${max:.2}", b.strategy));
        }
    }
    if let Some(max) = b.max_trials {
        if trials > max {
            return Err(format!("{}: trial {trials} > max {max}", b.strategy));
        }
    }
    Ok(())
}

fn main() {
    let open = Budget { max_spend_usd: None, max_trials: None, strategy: String::from("grid"), random_seed: 0 };
    let tight = Budget { max_spend_usd: Some(1.5), max_trials: Some(10), strategy: String::from("random"), random_seed: 7 };
    let results = [
        check(&open, 99.0, 500),
        check(&tight, 2.25, 3),
        check(&tight, 0.5, 12),
        check(&tight, 1.0, 10),
    ];
    let out: Vec<String> = results
        .iter()
        .map(|r| match r {
            Ok(()) => String::from("ok"),
            Err(e) => format!("err({e})"),
        })
        .collect();
    println!("{}", out.join(" "));
}
```
:::

::: only level="++"
**Splunker's notes.** Two things the base lesson glossed over. First, *match ergonomics*:
matching a `&Outcome` against `Outcome::Failed { step, .. }` binds `step` as a `&String`
automatically, which is why `describe(o: &Outcome)` never needs `ref` or `*`. Second,
guards are invisible to the exhaustiveness checker, so put guarded arms *before* their
unguarded fallback and never rely on a guard to cover a case.
:::
