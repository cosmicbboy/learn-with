---
title: "Result, Option, and the ? operator"
concepts: [result_option, error_handling]
objectives:
  - Handle fallibility with Result and Option
  - Propagate errors with ? instead of nested match
---

## Errors are values, not exceptions

In Python you `raise`; in JS you `throw`. In Rust there are **no exceptions** — a
function that can fail declares it in its *type*. That's `Result<T, E>`:

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

A fallible function returns `Result`. The reader *sees* fallibility in the signature and
can't forget to handle it (exhaustive `match` again).

::: callout type="contrast" lang="python"
**For the Pythonista.** You learned to trust the type hints `-> int`. Rust raises the
stakes: `-> Result<i32, Error>` literally means "either an int or an error." You can't
silently ignore it; the compiler makes you face each arm.
:::

## The `?` operator: propagate, don't nest

Handling nested `Result`s by hand is brutal — that's why Rust has `?`. `?` says: *if this
is `Ok`, unwrap the value; if it's `Err`, return that `Err` from the current function
immediately.* It's the idiomatic version of Python's `raise` bubbling up, but explicit.

```rust
fn read_first_value() -> Result<i32, String> {
    let raw = String::from("42");
    let n = raw.parse::<i32>().map_err(|_| String::from("not a number"))?;
    Ok(n * 2)
}
```

`parse::<i32>()` returns `Result<i32, ParseIntError>`; `?` bubbles the error (mapped to
our `String`) or gives us the number.

::: exercise id="question-mark" kind="code" concepts="result_option,error_handling" difficulty="3" check="contains:Err(" hints="`.unwrap()` panics on an `Err`, but `?` returns the `Err` from the function early|The parse error is a `ParseIntError`, and the function returns `Result<i32, String>`, so convert the error first|Replace `.unwrap()` with `.map_err(...)` whose closure ignores the parse error and returns `String::from` of nope, then add `?` at the end"
`twice_maybe` currently calls `.unwrap()`, so it panics on `wat`. Use `?` instead (with
`map_err` to turn the parse error into the `String` `nope`) so the function returns
`Err("nope")` on bad input. The program should print `Ok(16)` and then `Err("nope")`.

```rust
fn twice_maybe(s: &str) -> Result<i32, String> {
    // TODO: replace .unwrap() with ? so a bad parse returns the nope error
    let n: i32 = s.parse().unwrap();
    Ok(n * 2)
}

fn main() {
    println!("{:?}", twice_maybe("8"));   // want Ok(16)
    println!("{:?}", twice_maybe("wat")); // want the nope error
}
```

<solution>
```rust
fn twice_maybe(s: &str) -> Result<i32, String> {
    let n: i32 = s.parse().map_err(|_| String::from("nope"))?;
    Ok(n * 2)
}

fn main() {
    println!("{:?}", twice_maybe("8"));
    println!("{:?}", twice_maybe("wat"));
}
```
:::

::: exercise id="question-mark" level="+" kind="code" concepts="result_option,error_handling" difficulty="4" check="exact:7 | missing comma | bad number: x" hints="`split_once(',')` returns an `Option`, but `?` in this function needs a `Result`. `ok_or` turns `None` into an `Err`|`?` converts a `&str` error into `String` by itself, since `String` implements `From<&str>`. The parse error still needs `map_err`, and the message must name the bad text|Use `let (a, b) = s.split_once(',').ok_or(...)?;`, then parse each half with `map_err` building `format!` with the text bad number: and the offending piece, and finish with `Ok((x, y))`"
Two failure modes, one `?` each. `parse_pair` turns `a,b` into two numbers. With no
comma it fails with `missing comma`. If either half isn't a number it fails with
`bad number: <that half>`. Here `None` has to become an error first, and there's no
`match` and no `unwrap`. Expected output: `7 | missing comma | bad number: x`.

```rust
fn parse_pair(s: &str) -> Result<(i32, i32), String> {
    todo!()
}

fn main() {
    let out: Vec<String> = ["3,4", "3", "3,x"]
        .iter()
        .map(|s| match parse_pair(s) {
            Ok((a, b)) => (a + b).to_string(),
            Err(e) => e,
        })
        .collect();
    println!("{}", out.join(" | "));
}
```

<solution>
```rust
fn parse_pair(s: &str) -> Result<(i32, i32), String> {
    let (a, b) = s.split_once(',').ok_or("missing comma")?;
    let x = a.parse::<i32>().map_err(|_| format!("bad number: {a}"))?;
    let y = b.parse::<i32>().map_err(|_| format!("bad number: {b}"))?;
    Ok((x, y))
}

fn main() {
    let out: Vec<String> = ["3,4", "3", "3,x"]
        .iter()
        .map(|s| match parse_pair(s) {
            Ok((a, b)) => (a + b).to_string(),
            Err(e) => e,
        })
        .collect();
    println!("{}", out.join(" | "));
}
```
:::

::: exercise id="question-mark" level="++" kind="code" concepts="result_option,error_handling" difficulty="4" check="exact:ok | missing.md not in lock | b.md: expected sha256:22, got sha256:99 | all failed: missing.md not in lock" hints="`lock.get(path)` is an `Option<&String>`. Turn the absent case into an error with `ok_or_else` and a closure that formats the message, then `?` it|A mismatch isn't an Option or a Result you can `?`. Check it with an `if` and `return Err(...)` early|`verify_all` is a loop that calls `verify(lock, p, h)?` for each pair, so the first failure returns at once, and it ends with `Ok(checks.len())`"
Restoring a harness means checking files against `harness.lock`. This is shaped like that
step, with the lock as a `BTreeMap<path, hash>`. Write:

- `verify(lock, path, actual)`: `Ok(())` when the hashes match, `<path> not in lock` when
  the path is absent, `<path>: expected <locked>, got <actual>` when they differ;
- `verify_all(lock, checks)`: stops at the **first** failure and returns it. On success
  it returns how many files were checked.

Expected output:
`ok | missing.md not in lock | b.md: expected sha256:22, got sha256:99 | all failed: missing.md not in lock`.

```rust
use std::collections::BTreeMap;

fn verify(lock: &BTreeMap<String, String>, path: &str, actual: &str) -> Result<(), String> {
    todo!()
}

fn verify_all(lock: &BTreeMap<String, String>, checks: &[(&str, &str)]) -> Result<usize, String> {
    todo!()
}

fn main() {
    let mut lock = BTreeMap::new();
    lock.insert(String::from("a.md"), String::from("sha256:11"));
    lock.insert(String::from("b.md"), String::from("sha256:22"));
    let checks = [("a.md", "sha256:11"), ("missing.md", "sha256:00"), ("b.md", "sha256:99")];
    let mut out: Vec<String> = checks
        .iter()
        .map(|(p, h)| match verify(&lock, p, h) {
            Ok(()) => String::from("ok"),
            Err(e) => e,
        })
        .collect();
    out.push(match verify_all(&lock, &checks) {
        Ok(n) => format!("all={n}"),
        Err(e) => format!("all failed: {e}"),
    });
    println!("{}", out.join(" | "));
}
```

<solution>
```rust
use std::collections::BTreeMap;

fn verify(lock: &BTreeMap<String, String>, path: &str, actual: &str) -> Result<(), String> {
    let expected = lock.get(path).ok_or_else(|| format!("{path} not in lock"))?;
    if expected != actual {
        return Err(format!("{path}: expected {expected}, got {actual}"));
    }
    Ok(())
}

fn verify_all(lock: &BTreeMap<String, String>, checks: &[(&str, &str)]) -> Result<usize, String> {
    for (path, hash) in checks {
        verify(lock, path, hash)?;
    }
    Ok(checks.len())
}

fn main() {
    let mut lock = BTreeMap::new();
    lock.insert(String::from("a.md"), String::from("sha256:11"));
    lock.insert(String::from("b.md"), String::from("sha256:22"));
    let checks = [("a.md", "sha256:11"), ("missing.md", "sha256:00"), ("b.md", "sha256:99")];
    let mut out: Vec<String> = checks
        .iter()
        .map(|(p, h)| match verify(&lock, p, h) {
            Ok(()) => String::from("ok"),
            Err(e) => e,
        })
        .collect();
    out.push(match verify_all(&lock, &checks) {
        Ok(n) => format!("all={n}"),
        Err(e) => format!("all failed: {e}"),
    });
    println!("{}", out.join(" | "));
}
```
:::

::: exercise id="question-mark" level="+++" kind="code" concepts="result_option,error_handling" difficulty="5" check="exact:ok total=30 modes=644,755 | err line 2: bad size x" hints="Split each line on `:`. The size is required, so turn its absence into an error with `ok_or`, while the mode is optional and falls back with `unwrap_or`|Keep the per-line parser ignorant of line numbers, and add the `line N:` prefix in the caller with `map_err` before the `?`|`enumerate()` is zero-based, so the first line is `i + 1`. Collect the modes as Strings and join them with commas at print time"
**Spec only.** A size manifest has one entry per line: `path:size` or
`path:size:mode`. The mode is optional and defaults to `644`. Summarize a list of lines
into the total size and the list of modes, or fail on the **first** bad line with
`line <n>: <reason>` (1-based), where the reason is `missing size` or
`bad size <text>`. Design the types yourself. Print both runs on one line:

- `["a.md:10", "b.sh:20:755"]` gives `ok total=30 modes=644,755`
- `["a.md:10", "b.md:x", "c"]` gives `err line 2: bad size x`

Expected output: `ok total=30 modes=644,755 | err line 2: bad size x`.

```rust
fn main() {
    // Build it from the spec: a line parser, a summarizer, and this print.
    todo!()
}
```

<solution>
```rust
struct Entry<'a> {
    size: u64,
    mode: &'a str,
}

fn parse_line(line: &str) -> Result<Entry<'_>, String> {
    let mut parts = line.split(':').skip(1); // skip the path
    let raw = parts.next().ok_or("missing size")?;
    let size = raw.parse::<u64>().map_err(|_| format!("bad size {raw}"))?;
    let mode = parts.next().unwrap_or("644");
    Ok(Entry { size, mode })
}

fn summarize(lines: &[&str]) -> Result<(u64, Vec<String>), String> {
    let mut total = 0;
    let mut modes = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        let e = parse_line(line).map_err(|e| format!("line {}: {e}", i + 1))?;
        total += e.size;
        modes.push(e.mode.to_string());
    }
    Ok((total, modes))
}

fn show(r: Result<(u64, Vec<String>), String>) -> String {
    match r {
        Ok((total, modes)) => format!("ok total={total} modes={}", modes.join(",")),
        Err(e) => format!("err {e}"),
    }
}

fn main() {
    let good = summarize(&["a.md:10", "b.sh:20:755"]);
    let bad = summarize(&["a.md:10", "b.md:x", "c"]);
    println!("{} | {}", show(good), show(bad));
}
```
:::

## Option's safe escapes

`Option` has friendly helpers for when you'd rather avoid a `match`: `unwrap_or`,
`unwrap_or_else`, `expect`, `and_then`. In hlock you'll see `unwrap_or_default()`
constantly — "give me a sensible zero if missing":

```rust
let maybe = Some::<i32>(4);
let v = maybe.unwrap_or(0);          // 4
let none: Option<i32> = None;
let v2 = none.unwrap_or_default();   // 0
```

::: exercise id="unwrap-or" kind="code" concepts="result_option" difficulty="2" check="exact:0" hints="`.unwrap()` on `None` panics, and that's the crash you see|`Option` has methods that return a fallback when there is no value|Use `m.unwrap_or_default()` (or `m.unwrap_or(0)`), since the default `i32` is `0`"
`safe` currently calls `.unwrap()`, which panics on `None`. Change it to use
`unwrap_or_default()` so it returns `0` instead. No panic allowed. Expected output: `0`.

```rust
fn safe(m: Option<i32>) -> i32 {
    m.unwrap() // TODO: return 0 instead of panicking on None
}

fn main() {
    println!("{}", safe(None)); // 0
}
```

<solution>
```rust
fn safe(m: Option<i32>) -> i32 {
    m.unwrap_or_default()
}

fn main() {
    println!("{}", safe(None));
}
```
:::

::: exercise id="unwrap-or" level="+" kind="code" concepts="result_option" difficulty="3" check="exact:9000 8080 8080 443" hints="There are two ways to fail here: the config is absent (`None`), or it is present but won't parse. Both should fall back to 8080|`and_then` chains an Option into another Option, and `.ok()` turns the parse `Result` into an `Option`|Use `cfg.and_then(...)` with a closure that trims the text, parses it, and calls `.ok()`, then end with `.unwrap_or(8080)`. 70000 doesn't fit in a `u16`, so it fails too"
`port` reads an *optional* config value. It returns the parsed port, or `8080` when the
value is missing, isn't a number, or doesn't fit in a `u16`. Surrounding whitespace is
allowed. Write it as one chain, with no `match` and no `unwrap()`. Expected output:
`9000 8080 8080 443`.

```rust
fn port(cfg: Option<&str>) -> u16 {
    todo!()
}

fn main() {
    println!(
        "{} {} {} {}",
        port(Some("9000")),
        port(Some("abc")),
        port(None),
        port(Some(" 443 ")),
    );
    assert_eq!(port(Some("70000")), 8080);
}
```

<solution>
```rust
fn port(cfg: Option<&str>) -> u16 {
    cfg.and_then(|s| s.trim().parse().ok()).unwrap_or(8080)
}

fn main() {
    println!(
        "{} {} {} {}",
        port(Some("9000")),
        port(Some("abc")),
        port(None),
        port(Some(" 443 ")),
    );
    assert_eq!(port(Some("70000")), 8080);
}
```
:::

::: exercise id="unwrap-or" level="++" kind="code" concepts="result_option" difficulty="4" check="exact:claude@1.2 (3 files) | codex@unpinned (0 files) | cursor@unpinned (0 files)" hints="`describe` only borrows the `Harness`, so you can't move the `String` out of `h.version`. `as_deref()` turns `&Option<String>` into `Option<&str>`|An empty version string counts as unpinned too. `filter` turns a `Some` that fails a test into `None`|Use `h.version.as_deref().filter(...)` with a check that the text isn't empty, then `.unwrap_or(...)` with the text unpinned, and `h.include.as_ref().map_or(0, ...)` with the Vec's `len()` for the count"
A harness entry shaped like the ones in hlock's manifest, where every optional field is
an `Option`. Write `describe(&Harness)` so it returns `<name>@<version> (<n> files)`.
A missing version **or an empty one** prints as `unpinned`, and a missing `include`
counts as `0` files. You only get a borrow, so nothing can be moved out. Expected output:
`claude@1.2 (3 files) | codex@unpinned (0 files) | cursor@unpinned (0 files)`.

```rust
struct Harness {
    name: String,
    version: Option<String>,
    include: Option<Vec<String>>,
}

fn describe(h: &Harness) -> String {
    todo!()
}

fn main() {
    let hs = vec![
        Harness {
            name: "claude".into(),
            version: Some("1.2".into()),
            include: Some(vec!["a".into(), "b".into(), "c".into()]),
        },
        Harness { name: "codex".into(), version: None, include: None },
        Harness { name: "cursor".into(), version: Some(String::new()), include: Some(vec![]) },
    ];
    let out: Vec<String> = hs.iter().map(describe).collect();
    println!("{}", out.join(" | "));
}
```

<solution>
```rust
struct Harness {
    name: String,
    version: Option<String>,
    include: Option<Vec<String>>,
}

fn describe(h: &Harness) -> String {
    let version = h.version.as_deref().filter(|v| !v.is_empty()).unwrap_or("unpinned");
    let files = h.include.as_ref().map_or(0, |v| v.len());
    format!("{}@{version} ({files} files)", h.name)
}

fn main() {
    let hs = vec![
        Harness {
            name: "claude".into(),
            version: Some("1.2".into()),
            include: Some(vec!["a".into(), "b".into(), "c".into()]),
        },
        Harness { name: "codex".into(), version: None, include: None },
        Harness { name: "cursor".into(), version: Some(String::new()), include: Some(vec![]) },
    ];
    let out: Vec<String> = hs.iter().map(describe).collect();
    println!("{}", out.join(" | "));
}
```
:::

> **A word on `unwrap()`.** You'll see `unwrap()` and `expect()` in hlock where the author
> is *sure* it can't fail. They panic if wrong. As a learner, prefer `?`,
> `unwrap_or*`, or a `match` — they force you to think about failure, which is the
> Splunker's virtue.

## Quick check

::: exercise id="result-vs-option" kind="mcq" concepts="result_option" difficulty="1" options="It carries a value | It carries an error type E as well as a value | It never carries an error | It is the same as Option" answer="1" explain="`Option<T>` can only say a value is missing (`None`), while `Result<T, E>` also says what went wrong, carrying an error value `E` inside `Err`. That is how hlock's fallible functions report failures with context."
`Result<T, E>` differs from `Option<T>` because…
:::

::: exercise id="result-vs-option" level="++" kind="mcq" concepts="result_option,error_handling" difficulty="3" options="Err for the x parse: collect stops at the first failure|Ok with the vector 1, 3: bad entries are skipped|Err holding both the x and y failures|A Vec of four Results, one per string" answer="0" explain="Collecting an iterator of `Result<T, E>` into `Result<Vec<T>, E>` short-circuits. It returns the first `Err` it meets and never looks at `y`. That's the iterator version of `?` in a loop. To *skip* bad entries instead, use `filter_map` with `.ok()`. To keep every result, collect into `Vec<Result<i32, _>>`."
```rust
let r: Result<Vec<i32>, _> = ["1", "x", "3", "y"]
    .iter()
    .map(|s| s.parse::<i32>())
    .collect();
```
What is `r`?
:::

::: exercise id="result-vs-option" level="+++" kind="mcq" concepts="result_option,error_handling" difficulty="4" options="Ok(None), then Ok(Some(5)), then an Err|None, then Some(5), then None|Err for None, because there is nothing to parse|It does not compile, since you cannot map an Option into a Result" answer="0" explain="`s.map(...)` gives `Option<Result<i32, ParseIntError>>`, and `transpose()` swaps the layers into `Result<Option<i32>, ParseIntError>`. An absent value is not an error, so it becomes `Ok(None)`. A good value becomes `Ok(Some(5))`, and a bad one becomes `Err(...)`, which you can now `?`. This is the right shape for an *optional* field that must be valid when present."
```rust
use std::num::ParseIntError;

fn opt_num(s: Option<&str>) -> Result<Option<i32>, ParseIntError> {
    s.map(|t| t.parse::<i32>()).transpose()
}
// called as opt_num(None), opt_num(Some("5")), opt_num(Some("five"))
```
What do the three calls return, in order?
:::

::: only level="++"
**Splunker's notes.** Look at where hlock uses `?` and where it uses `unwrap_or_default()`.
The line between them is a design decision. A missing *optional* field, such as a
harness without an `include` list, isn't an error, so it falls back to a default. A
missing *required* thing, such as a lock entry for a file you're restoring, is an error
and gets propagated with `?`. When you're unsure which one a value is, ask whether the
user would want to be told. If they would, it's a `Result`.
:::
