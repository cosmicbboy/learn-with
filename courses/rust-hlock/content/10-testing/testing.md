---
title: "#[test], #[cfg(test)], and proving hash.rs is deterministic"
concepts: [testing, expression]
objectives:
  - Write unit tests and run them with cargo test
  - Re-read hlock's hash.rs test that proves determinism
---

## Tests live next to the code

Rust lets you write tests in the same file, inside a `#[cfg(test)] mod tests`. The
attribute says "only compile this when testing." It's like a Python `if __name__ ==
"__main__"` guard, purpose-built for tests.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic() {
        let a = ...;
        assert_eq!(content_hash(&a), content_hash(&a));
    }
}
```

- `#[test]` marks a function as a test.
- `use super::*;` imports the outer module's items (so tests can call the real code).
- `assert_eq!(a, b)` fails the test if not equal.
- `cargo test` runs every `#[test]`, along with doc tests and integration tests in
  `tests/` (like hlock's `tests/graders.rs`, `tests/resolver.rs`).

## Splunk it: the real determinism test

hlock's `hash.rs` has a test that hashes the *same* JSON written with keys/ordering in
different orders, and asserts the hashes are **equal** — proving canonicalization works:

```rust
#[test]
fn deterministic() {
    let a = serde_json::json!({"b": 1, "a": [3, {"d": 4, "c": 5}]});
    let b = serde_json::json!({"a": [3, {"c": 5, "d": 4}], "b": 1});
    assert_eq!(content_hash(&a), content_hash(&b));
}
```

The whole point of `sorted()` (your iterator lesson) is to make these two equal, whatever
order the keys arrive in. (With serde_json's default features its `Map` is a `BTreeMap`, which
already sorts keys; `sorted()` keeps the hash stable even if the `preserve_order` feature
is ever switched on, and the test pins that guarantee down.)

::: callout type="challenge"
The harness's small runner can't run the whole `serde_json` crate standalone, but
`#[test]` + `assert_eq!` on *plain* logic works perfectly. You'll write your own test
module below.
:::

## Write a test module

::: exercise id="write-test" kind="code" concepts="testing,expression" difficulty="3" check="exact:double(3) = 6" hints="Run it: `double(3)` gives 5, because `n + 2` only looks right for `n = 2`|Inside `mod tests`, add a `#[test]` function that calls `assert_eq!(double(3), 6);`, which is the test that would catch this bug|Then fix the body of `double` to `n * 2` so main prints `double(3) = 6`"
`double` has a bug: it's written as `n + 2`, which happens to be right for `2`. First
add a `#[test]` inside the `#[cfg(test)] mod tests` block that asserts `double(3) == 6`;
under `cargo test` it would fail and catch the bug. (This harness only compiles and runs
`main`.) Then fix `double` so the program prints exactly `double(3) = 6`.

```rust
fn double(n: i32) -> i32 { n + 2 } // TODO: bug, find it with a test then fix it

#[cfg(test)]
mod tests {
    use super::*;

    // TODO: add a #[test] fn that asserts double(3) == 6
}

fn main() {
    println!("double(3) = {}", double(3));
}
```

<solution>
```rust
fn double(n: i32) -> i32 { n * 2 }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles() {
        assert_eq!(double(3), 6);
    }
}

fn main() {
    println!("double(3) = {}", double(3));
}
```
:::

::: exercise id="write-test" kind="code" level="+" concepts="testing,expression" difficulty="4" check="contains:test result: ok. 3 passed; 0 failed" hints="Run it first: every test is a `todo!()`, so all three report FAILED. Replace each with a real assertion|The second test feeds in a level with whitespace around it. Real lock files have trailing newlines, so make `parse_level` cope|The panic test has to call `parse_level` on 9. The runner also checks the panic message for `out of range`, like `#[should_panic(expected = ...)]`, and `.trim()` before `.parse()` fixes the bug"
Plain `rustc` compiles `main`, not `#[test]` functions, so this program ships a tiny
stand-in for `cargo test`. `main` calls each test, catches its panic, and prints
cargo-style lines. Your job:

1. Write the three test bodies. `parses_plain` asserts that `"3"` gives `3`.
   `trims_whitespace` asserts that `" 4\n"` gives `4`. `rejects_out_of_range` calls
   `parse_level("9")`; the runner expects it to panic with a message containing
   `out of range`, the same check as `#[should_panic(expected = "out of range")]`.
2. One test will fail against the current `parse_level`. Fix the function, not the test.

Expected last line: `test result: ok. 3 passed; 0 failed`.

```rust
/// Parse a lock level like "3" into 0..=5. Panics on anything else.
/// TODO: there is an edge-case bug in here. Your tests should find it.
fn parse_level(s: &str) -> u8 {
    let n: u8 = s.parse().expect("level must be a number");
    if n > 5 {
        panic!("level {n} out of range 0..=5");
    }
    n
}

// --- tests (cargo test would find these via #[test]) ---
fn parses_plain() {
    todo!("assert that \"3\" parses to 3")
}

fn trims_whitespace() {
    todo!("assert that \" 4\\n\" parses to 4")
}

// #[should_panic(expected = "out of range")]
fn rejects_out_of_range() {
    todo!("call parse_level on \"9\" and let it panic")
}

// --- a tiny stand-in for the cargo test runner: don't edit below ---
fn run(name: &str, f: fn(), expected_panic: Option<&str>) -> bool {
    let outcome = std::panic::catch_unwind(f);
    let ok = match (outcome, expected_panic) {
        (Ok(()), None) => true,
        (Err(e), Some(want)) => {
            let msg = e.downcast_ref::<String>().map(|s| s.as_str())
                .or_else(|| e.downcast_ref::<&str>().copied())
                .unwrap_or("");
            msg.contains(want)
        }
        _ => false,
    };
    println!("test {name} ... {}", if ok { "ok" } else { "FAILED" });
    ok
}

fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    let results = [
        run("parses_plain", parses_plain, None),
        run("trims_whitespace", trims_whitespace, None),
        run("rejects_out_of_range", rejects_out_of_range, Some("out of range")),
    ];
    let passed = results.iter().filter(|ok| **ok).count();
    let failed = results.len() - passed;
    let status = if failed == 0 { "ok" } else { "FAILED" };
    println!("test result: {status}. {passed} passed; {failed} failed");
}
```

<solution>
```rust
/// Parse a lock level like "3" into 0..=5. Panics on anything else.
fn parse_level(s: &str) -> u8 {
    let n: u8 = s.trim().parse().expect("level must be a number");
    if n > 5 {
        panic!("level {n} out of range 0..=5");
    }
    n
}

// --- tests (cargo test would find these via #[test]) ---
fn parses_plain() {
    assert_eq!(parse_level("3"), 3);
}

fn trims_whitespace() {
    assert_eq!(parse_level(" 4\n"), 4);
}

// #[should_panic(expected = "out of range")]
fn rejects_out_of_range() {
    parse_level("9");
}

// --- a tiny stand-in for the cargo test runner: don't edit below ---
fn run(name: &str, f: fn(), expected_panic: Option<&str>) -> bool {
    let outcome = std::panic::catch_unwind(f);
    let ok = match (outcome, expected_panic) {
        (Ok(()), None) => true,
        (Err(e), Some(want)) => {
            let msg = e.downcast_ref::<String>().map(|s| s.as_str())
                .or_else(|| e.downcast_ref::<&str>().copied())
                .unwrap_or("");
            msg.contains(want)
        }
        _ => false,
    };
    println!("test {name} ... {}", if ok { "ok" } else { "FAILED" });
    ok
}

fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    let results = [
        run("parses_plain", parses_plain, None),
        run("trims_whitespace", trims_whitespace, None),
        run("rejects_out_of_range", rejects_out_of_range, Some("out of range")),
    ];
    let passed = results.iter().filter(|ok| **ok).count();
    let failed = results.len() - passed;
    let status = if failed == 0 { "ok" } else { "FAILED" };
    println!("test result: {status}. {passed} passed; {failed} failed");
}
```
:::

::: exercise id="write-test" kind="code" level="++" concepts="testing,expression" difficulty="5" check="contains:test result: ok. 2 passed; 0 failed" hints="Rebuild hash.rs's real test with the `obj` helper: a = b:1 then a:[3, obj(d:4, c:5)], and b = the same data with both key orders swapped|Once `deterministic` is written it fails, because the `Arr` arm prints nested objects with `{:?}` and never sorts their keys. Canonicalize all the way down|Make the `Arr` arm recurse, the way hash.rs's `sorted()` maps over array items: `items.iter().map(canonical).collect::<Vec<_>>().join(...)` inside brackets, and keep the array order"
This is hlock's `hash.rs` determinism test, ported to std. `Value` stands in for
`serde_json::Value`, `canonical` plays the part of `sorted()`, and `content_hash` uses
FNV-1a because std has no sha256. Recall the real test:

`a = {"b": 1, "a": [3, {"d": 4, "c": 5}]}` and `b = {"a": [3, {"c": 5, "d": 4}], "b": 1}`
must hash equal.

1. Write `deterministic`, which is that test, using the `obj` helper.
2. Write `array_order_matters`, the guard that keeps "fixes" honest: `[1, 2]` and
   `[2, 1]` must hash **differently**, because sorting arrays would be a bug.
3. Your tests will catch a bug in `canonical`. Fix it so both pass.

Expected last line: `test result: ok. 2 passed; 0 failed`.

```rust
// A std-only stand-in for serde_json::Value, shaped like what hash.rs hashes.
#[derive(Debug, Clone)]
enum Value {
    Num(i64),
    Arr(Vec<Value>),
    Obj(Vec<(String, Value)>), // keys in the order they were written
}
use Value::*;

fn obj(pairs: &[(&str, Value)]) -> Value {
    Obj(pairs.iter().map(|(k, v)| (k.to_string(), v.clone())).collect())
}

/// Canonical text: object keys sorted at every depth, arrays kept in order.
fn canonical(v: &Value) -> String {
    match v {
        Num(n) => n.to_string(),
        Arr(items) => format!("{items:?}"), // TODO: a shortcut someone took. Is it canonical?
        Obj(pairs) => {
            let mut sorted: Vec<&(String, Value)> = pairs.iter().collect();
            sorted.sort_by(|a, b| a.0.cmp(&b.0));
            let body: Vec<String> = sorted
                .iter()
                .map(|(k, v)| format!("{k:?}:{}", canonical(v)))
                .collect();
            format!("{{{}}}", body.join(","))
        }
    }
}

/// `fnv1a:<hex>` of the canonical text (hlock uses sha256; std has no sha2).
fn content_hash(v: &Value) -> String {
    let mut h: u32 = 0x811c9dc5;
    for b in canonical(v).bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    format!("fnv1a:{h:08x}")
}

// --- tests: the hash.rs determinism test, plus the one that keeps it honest ---
fn deterministic() {
    // TODO: build the two values from hash.rs's real test (same data, keys in a
    // different order at both depths) and assert_eq! their content_hash
    todo!()
}

fn array_order_matters() {
    // TODO: assert_ne! the hashes of [1, 2] and [2, 1], because arrays are ordered data
    todo!()
}

// --- a tiny stand-in for the cargo test runner: don't edit below ---
fn run(name: &str, f: fn()) -> bool {
    let ok = std::panic::catch_unwind(f).is_ok();
    println!("test hash::tests::{name} ... {}", if ok { "ok" } else { "FAILED" });
    ok
}

fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    let results = [run("deterministic", deterministic), run("array_order_matters", array_order_matters)];
    let passed = results.iter().filter(|ok| **ok).count();
    let failed = results.len() - passed;
    let status = if failed == 0 { "ok" } else { "FAILED" };
    println!("test result: {status}. {passed} passed; {failed} failed");
}
```

<solution>
```rust
// A std-only stand-in for serde_json::Value, shaped like what hash.rs hashes.
#[derive(Debug, Clone)]
enum Value {
    Num(i64),
    Arr(Vec<Value>),
    Obj(Vec<(String, Value)>), // keys in the order they were written
}
use Value::*;

fn obj(pairs: &[(&str, Value)]) -> Value {
    Obj(pairs.iter().map(|(k, v)| (k.to_string(), v.clone())).collect())
}

/// Canonical text: object keys sorted at every depth, arrays kept in order.
fn canonical(v: &Value) -> String {
    match v {
        Num(n) => n.to_string(),
        Arr(items) => format!(
            "[{}]",
            items.iter().map(canonical).collect::<Vec<_>>().join(",")
        ),
        Obj(pairs) => {
            let mut sorted: Vec<&(String, Value)> = pairs.iter().collect();
            sorted.sort_by(|a, b| a.0.cmp(&b.0));
            let body: Vec<String> = sorted
                .iter()
                .map(|(k, v)| format!("{k:?}:{}", canonical(v)))
                .collect();
            format!("{{{}}}", body.join(","))
        }
    }
}

/// `fnv1a:<hex>` of the canonical text (hlock uses sha256; std has no sha2).
fn content_hash(v: &Value) -> String {
    let mut h: u32 = 0x811c9dc5;
    for b in canonical(v).bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    format!("fnv1a:{h:08x}")
}

// --- tests: the hash.rs determinism test, plus the one that keeps it honest ---
fn deterministic() {
    let a = obj(&[("b", Num(1)), ("a", Arr(vec![Num(3), obj(&[("d", Num(4)), ("c", Num(5))])]))]);
    let b = obj(&[("a", Arr(vec![Num(3), obj(&[("c", Num(5)), ("d", Num(4))])])), ("b", Num(1))]);
    assert_eq!(content_hash(&a), content_hash(&b));
}

fn array_order_matters() {
    assert_ne!(content_hash(&Arr(vec![Num(1), Num(2)])), content_hash(&Arr(vec![Num(2), Num(1)])));
}

// --- a tiny stand-in for the cargo test runner: don't edit below ---
fn run(name: &str, f: fn()) -> bool {
    let ok = std::panic::catch_unwind(f).is_ok();
    println!("test hash::tests::{name} ... {}", if ok { "ok" } else { "FAILED" });
    ok
}

fn main() {
    std::panic::set_hook(Box::new(|_| {}));
    let results = [run("deterministic", deterministic), run("array_order_matters", array_order_matters)];
    let passed = results.iter().filter(|ok| **ok).count();
    let failed = results.len() - passed;
    let status = if failed == 0 { "ok" } else { "FAILED" };
    println!("test result: {status}. {passed} passed; {failed} failed");
}
```
:::

::: exercise id="write-test" kind="code" level="+++" concepts="testing,expression" difficulty="5" check="contains:test result: FAILED. 4 passed; 1 failed; failures: canary_fails" hints="Start with `parse_lock_line` and `split_once` on '=', using `?` with `ok_or_else` for the missing-equals case|A test case can be a struct with a `name: &'static str` and `f: fn()`. Sort the cases by name, then run each through `std::panic::catch_unwind(t.f)`|Silence the default panic message with `std::panic::set_hook(Box::new(...))` taking a closure that ignores its argument, count the passes, and collect the failing names for the summary line"
**Spec: write the code, the tests, *and* the test runner.**

`parse_lock_line(line: &str) -> Result<(String, String), String>` reads one line of a
lock file, `name = sha256:<hex>`:
- no `=` gives `Err("missing '='")`;
- a hash that, once trimmed, doesn't start with `sha256:` gives an `Err` that starts with
  `bad hash prefix`;
- otherwise it returns `Ok((name, hash))` with spaces trimmed from both.

Write five test functions with exactly these names. Each one panics on failure, as
`assert_eq!` does:
- `parses_ok`: `rust=sha256:9f2c` gives `("rust", "sha256:9f2c")`
- `trims_spaces`: `  py =  sha256:77aa ` gives `("py", "sha256:77aa")`
- `rejects_missing_eq`: `go sha256:1` gives the missing `=` error
- `rejects_bad_prefix`: `go = md5:1` gives a bad-prefix error
- `canary_fails`: asserts `1 + 1 == 3`. A runner that can't report a failure proves nothing.

Then build the runner. Register the tests in the order above, but run and print them
**sorted by name**, as cargo does. Don't let panic messages reach the output. The
output must be exactly these seven lines:

1. `running 5 tests`
2. `test canary_fails ... FAILED`
3. `test parses_ok ... ok`
4. `test rejects_bad_prefix ... ok`
5. `test rejects_missing_eq ... ok`
6. `test trims_spaces ... ok`
7. `test result: FAILED. 4 passed; 1 failed; failures: canary_fails`

```rust
// Spec-only: write parse_lock_line, the five tests, and a runner.
// Plain rustc runs main, not #[test], so your runner is the test harness.

fn main() {
    todo!("register the five tests and run them")
}
```

<solution>
```rust
use std::panic;

fn parse_lock_line(line: &str) -> Result<(String, String), String> {
    let (name, hash) = line.split_once('=').ok_or_else(|| String::from("missing '='"))?;
    let hash = hash.trim();
    if !hash.starts_with("sha256:") {
        return Err(format!("bad hash prefix in {hash}"));
    }
    Ok((name.trim().to_string(), hash.to_string()))
}

fn parses_ok() {
    assert_eq!(parse_lock_line("rust=sha256:9f2c"), Ok((String::from("rust"), String::from("sha256:9f2c"))));
}
fn trims_spaces() {
    assert_eq!(parse_lock_line("  py =  sha256:77aa "), Ok((String::from("py"), String::from("sha256:77aa"))));
}
fn rejects_missing_eq() {
    assert_eq!(parse_lock_line("go sha256:1"), Err(String::from("missing '='")));
}
fn rejects_bad_prefix() {
    let err = parse_lock_line("go = md5:1").unwrap_err();
    assert!(err.starts_with("bad hash prefix"), "got {err}");
}
fn canary_fails() {
    assert_eq!(1 + 1, 3, "the runner must report this one");
}

struct TestCase {
    name: &'static str,
    f: fn(),
}

struct Summary {
    passed: usize,
    failures: Vec<&'static str>,
}

fn run_all(mut tests: Vec<TestCase>) -> Summary {
    tests.sort_by_key(|t| t.name);
    println!("running {} tests", tests.len());
    let mut s = Summary { passed: 0, failures: Vec::new() };
    for t in &tests {
        let ok = panic::catch_unwind(t.f).is_ok();
        println!("test {} ... {}", t.name, if ok { "ok" } else { "FAILED" });
        if ok { s.passed += 1 } else { s.failures.push(t.name) }
    }
    s
}

fn main() {
    panic::set_hook(Box::new(|_| {}));
    let s = run_all(vec![
        TestCase { name: "trims_spaces", f: trims_spaces },
        TestCase { name: "canary_fails", f: canary_fails },
        TestCase { name: "parses_ok", f: parses_ok },
        TestCase { name: "rejects_missing_eq", f: rejects_missing_eq },
        TestCase { name: "rejects_bad_prefix", f: rejects_bad_prefix },
    ]);
    let status = if s.failures.is_empty() { "ok" } else { "FAILED" };
    println!(
        "test result: {status}. {} passed; {} failed; failures: {}",
        s.passed,
        s.failures.len(),
        s.failures.join(", ")
    );
}
```
:::

::: only until="0"
> Plain `rustc` compiles the `#[cfg(test)]` module *out*, so here only `main` runs and
> prints `double(3) = 6`. Under `cargo test` your `#[test]` would run too. On later
> playthroughs you'll drive the tests from `main` yourself.
:::

## The three test homes

| where | kind | like |
|---|---|---|
| inside the file, `mod tests` | unit tests | in-function asserts |
| `tests/foo.rs` | integration tests | black-box from outside |
| `///` doc comments with code | doc tests | doctest in Python |

::: exercise id="test-home" kind="mcq" concepts="testing" difficulty="1" options="In a `#[cfg(test)] mod tests` block inside `hash.rs`|In a separate file under `tests/`, like `tests/hash.rs`|In `///` doc comments above `content_hash`|In `fn main` of the `hlock` CLI crate" answer="0" explain="Like most Rust crates, hlock keeps unit tests next to the code in a `#[cfg(test)] mod tests` block at the bottom of `hash.rs`. `cfg(test)` means the module is only compiled under `cargo test`, and it can reach private items such as `sorted()` through `use super::*`. Files under `tests/` (like `tests/resolver.rs`) are *integration* tests that see only the public API, and `///` examples are *doc* tests. `fn main` is the program itself and isn't run by `cargo test`."
Where does hlock write its unit tests for `hash.rs`?
:::

::: exercise id="test-home" kind="mcq" level="+" concepts="testing" difficulty="2" options="Compile error: `normalize` is private to the library crate|Works: `use super::*` reaches every item in the crate|Works, but only under `cargo test`, which unlocks private items|Works once `normalize` is marked `#[cfg(test)]`" answer="0" explain="Each file in `tests/` (like hlock's `tests/resolver.rs`) is its own crate that links the library from the outside, so it sees only the public API, and rustc rejects the call as private (E0603). `cfg(test)` only decides whether code is compiled; it never changes visibility, so neither `cargo test` nor a `#[cfg(test)]` on the helper helps. In an integration test file `super` has no parent to name at all. `use super::*` works in a `mod tests` *inside* the file because a child module can see its parent's private items. To test a private helper, write a unit test next to it, or test it through the pub function that calls it."
hlock's `tests/resolver.rs` wants to call a **private** helper `fn normalize(...)` in
the core crate's resolver module. What happens?
:::

::: exercise id="test-home" kind="mcq" level="++" concepts="testing" difficulty="3" options="That key order can't change the hash, even in nested objects|Nothing more: both only show content_hash is a pure function|That content_hash never panics on nested input|That serde_json preserves the insertion order of keys" answer="0" explain="Hashing a value against itself only shows the function has no randomness. The real test builds `a` and `b` with the same data but keys in different orders, including inside the nested object in the array, and asserts equal hashes. It would fail if key order ever leaked into the hash, so it guards `sorted()` (and serde_json's sorted default `Map`) against regressions. It says nothing about panics, and it would pass whether or not serde_json kept insertion order. A test should be able to fail for the bug it guards against."
hlock's determinism test compares `content_hash(&a)` to `content_hash(&b)`, where `b`
has `a`'s data with the keys reordered. What does it prove that
`assert_eq!(content_hash(&a), content_hash(&a))` would not?
:::

::: exercise id="test-home" kind="mcq" level="+++" concepts="testing,expression" difficulty="4" options="The doctest fails: `content_hash` is not in scope|The doctest passes: it sees its own module's items|Nothing runs: `///` code is only rendered by rustdoc|The doctest is skipped: it has no explicit `fn main`" answer="0" explain="`cargo test` extracts every fenced example in `///` docs, wraps it in a `fn main` if it has none, and compiles it as a **separate crate** linked to yours. Like an integration test, it sees only pub items and has to import them with the crate's path, so without a `use` line `content_hash` is unresolved (E0425) and that doctest is reported as failed. That is also why doctests are good documentation: they show exactly what a user has to write."
A `///` comment on `pub fn content_hash` contains this example, with no `use` line:

```rust
/// let v = serde_json::json!({"a": 1});
/// assert_eq!(content_hash(&v), content_hash(&v));
```

What happens under `cargo test`?
:::

::: only level="++"
### Splunker's notes: what the real suite does

- `cargo test` builds your crate **twice**: once as a library, once with `--test`, which
  turns every `#[test]` into an entry in a generated harness `main`. The runner you
  wrote above is a hand-made version of that harness.
- Tests run on **parallel threads** by default, so shared state such as files, env
  vars or a global store makes tests flaky. hlock-style tests stay deterministic by
  building their inputs inline. `cargo test -- --test-threads=1` is the escape hatch.
- `#[should_panic(expected = "...")]` matches a *substring* of the panic message, and a
  test can also return `Result<(), E>` so you can use `?` inside it.
- A good determinism test should be able to fail. Pair every "these are equal" test
  with a "these must differ" test, as with `array_order_matters`.
:::
