---
title: "A real error enum with thiserror"
concepts: [enums, from_display, error_handling, traits]
objectives:
  - Model your own error type as an enum with thiserror
  - Understand #[from], Display, and the ? operator's automatic conversion
---

## The real error.rs

Here is hlock's *actual* top-level error type, from `error.rs` — an enum where every
variant is a kind of failure, and `thiserror` generates the boring parts:

```rust
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("manifest error: {0}")]
    Manifest(String),
    #[error("store error: {0}")]
    Store(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("toml error: {0}")]
    Toml(#[from] toml::de::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Pull(String),
}

pub type Result<T> = std::result::Result<T, Error>;
```

Read it as a Splunker:
- `#[derive(Debug, thiserror::Error)]` — `thiserror` implements the `Error` trait for us.
- Each `#[error("... {0}")]` is the **Display** message; `{0}` substitutes the inner value.
- `#[from]` says "I can convert `std::io::Error` into `Error::Io` automatically."

That last one is the `?` superpower: `?` needs the function's error type to be
convertible *from* whatever error it just got. `#[from]` gives you that conversion for
free, so a function returning `Result<T, Error>` can `?` an io error, a toml error, and a
json error all in one body. Python's `except`-everything can't hold a candle to this
precision.

## A `type Result<T>` alias

The last line, `pub type Result<T> = std::result::Result<T, Error>;`, means inside hlock
you can write `fn f() -> Result<Vec<u8>>` and everyone knows the error is `Error`.
It's just a shortcut, like a Python alias.

Now you'll define a small error enum with `thiserror`.

::: callout type="challenge"
For these exercises the harness only has std (the real project pulls `thiserror` as a
crate). So we'll *hand-write* the parts `thiserror` would generate — which is exactly
the lesson: `#[from]` and `#[error]` are sugar for `impl From` + `impl Display`.
:::

## Hand-rolling what thiserror generates

`#[error("io error: {0}")]` generates a `Display` impl. Writing it by hand teaches you
both the trait and the macro:

::: exercise id="hand-display" kind="code" concepts="from_display,traits" difficulty="3" check="exact:Error: boom" hints="Inside `fmt`, you write text into the formatter `f` and return the `fmt::Result`|The `write!` macro works like `format!` but takes `f` as its first argument|In the `Error::Msg(s)` arm, use `write!(f, ...)` with the format string `Error: {s}`"
Complete the `Display` impl: replace the `todo!()` in the `Error::Msg(s)` arm with a
`write!` call so `println!("{e}")` prints exactly `Error: boom`.

```rust
use std::fmt;

enum Error { Msg(String) }

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Msg(s) => todo!(), // TODO: write!(f, ...) so it shows Error: boom
        }
    }
}

fn main() {
    let e = Error::Msg(String::from("boom"));
    println!("{e}");
}
```

<solution>
```rust
use std::fmt;

enum Error { Msg(String) }

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Msg(s) => write!(f, "Error: {s}"),
        }
    }
}

fn main() {
    let e = Error::Msg(String::from("boom"));
    println!("{e}");
}
```
:::

::: exercise id="hand-display" level="+" kind="code" concepts="from_display,traits,enums" difficulty="4" check="exact:manifest error: missing name | io error: harness.toml | HTTP 401 from registry | sources=false,true,false" hints="`fmt` needs one `match` arm per variant, each a `write!` with that variant's message. `Pull` is like hlock's bare `{0}` variant, so it prints only the inner text|`source()` is how an error says which lower-level error caused it. thiserror's `#[from]` also marks the field as the source|In `source`, match `Error::Io(e)` to `Some(e)` and every other variant to `None`"
Three variants copied from hlock's `error.rs`, with the code `thiserror` would generate
written by hand. Do both halves:

- `Display`: `manifest error: <msg>`, `io error: <inner>`, and for `Pull` the inner text
  only (hlock's `#[error("{0}")]`);
- `Error::source`: return the wrapped `io::Error` for `Io`, and `None` for the others.
  This is what `#[from]` implies: the wrapped error becomes the *source*.

Expected output:
`manifest error: missing name | io error: harness.toml | HTTP 401 from registry | sources=false,true,false`.

```rust
use std::error::Error as StdError;
use std::fmt;
use std::io;

#[derive(Debug)]
enum Error {
    Manifest(String),
    Io(io::Error),
    Pull(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("one write! per variant")
    }
}

impl StdError for Error {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        todo!("the wrapped io::Error for Io, None otherwise")
    }
}

fn main() {
    let errs = [
        Error::Manifest(String::from("missing name")),
        Error::Io(io::Error::new(io::ErrorKind::NotFound, "harness.toml")),
        Error::Pull(String::from("HTTP 401 from registry")),
    ];
    let shown: Vec<String> = errs.iter().map(|e| e.to_string()).collect();
    let sources: Vec<String> = errs.iter().map(|e| e.source().is_some().to_string()).collect();
    println!("{} | sources={}", shown.join(" | "), sources.join(","));
}
```

<solution>
```rust
use std::error::Error as StdError;
use std::fmt;
use std::io;

#[derive(Debug)]
enum Error {
    Manifest(String),
    Io(io::Error),
    Pull(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Manifest(m) => write!(f, "manifest error: {m}"),
            Error::Io(e) => write!(f, "io error: {e}"),
            Error::Pull(m) => write!(f, "{m}"),
        }
    }
}

impl StdError for Error {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            Error::Io(e) => Some(e),
            _ => None,
        }
    }
}

fn main() {
    let errs = [
        Error::Manifest(String::from("missing name")),
        Error::Io(io::Error::new(io::ErrorKind::NotFound, "harness.toml")),
        Error::Pull(String::from("HTTP 401 from registry")),
    ];
    let shown: Vec<String> = errs.iter().map(|e| e.to_string()).collect();
    let sources: Vec<String> = errs.iter().map(|e| e.source().is_some().to_string()).collect();
    println!("{} | sources={}", shown.join(" | "), sources.join(","));
}
```
:::

::: exercise id="hand-display" level="++" kind="code" concepts="enums,from_display,error_handling,traits" difficulty="4" check="exact:ok: claude | io error: missing.toml not found | manifest error: empty.toml has no name | store error: lock is read-only | registry said 401" hints="Do it in three parts: a `Display` arm per variant using hlock's exact `#[error]` strings, an `impl From<io::Error> for Error`, and then `load_name`|With the `From` impl in place, `read_file(path)?` converts the io error into `Error::Io` by itself. No `map_err` needed|For the name, `strip_prefix` with the text name and a space, an equals sign and a space returns an `Option<&str>`. Turn `None` into an error with `ok_or_else` and a closure that builds `Error::Manifest(format!(...))`, apply `?`, then `Ok(name.to_string())`"
This is hlock's `error.rs` with `thiserror` expanded by hand, minus the toml/json
variants, which need crates. Write the `Display` impl with the same messages as the real
`#[error(...)]` attributes, the `From<io::Error>` impl that `#[from]` would generate, and
`load_name`, which reads a manifest with `?` and returns the harness name from its
`name = …` line. A file without one is
`Error::Manifest("<path> has no name")`. `read_file` stands in for
`std::fs::read_to_string`. Expected output:
`ok: claude | io error: missing.toml not found | manifest error: empty.toml has no name | store error: lock is read-only | registry said 401`.

```rust
use std::fmt;
use std::io;

#[derive(Debug)]
pub enum Error {
    Manifest(String),
    Store(String),
    Io(io::Error),
    Pull(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("hlock's #[error] messages, one arm per variant")
    }
}

impl std::error::Error for Error {}

// TODO: the impl From<io::Error> for Error that #[from] generates

// Stand-in for std::fs::read_to_string.
fn read_file(path: &str) -> io::Result<String> {
    match path {
        "harness.toml" => Ok(String::from("name = claude")),
        "empty.toml" => Ok(String::new()),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, format!("{path} not found"))),
    }
}

fn load_name(path: &str) -> Result<String> {
    todo!()
}

fn main() {
    let mut out: Vec<String> = ["harness.toml", "missing.toml", "empty.toml"]
        .iter()
        .map(|p| match load_name(p) {
            Ok(name) => format!("ok: {name}"),
            Err(e) => e.to_string(),
        })
        .collect();
    out.push(Error::Store(String::from("lock is read-only")).to_string());
    out.push(Error::Pull(String::from("registry said 401")).to_string());
    println!("{}", out.join(" | "));
}
```

<solution>
```rust
use std::fmt;
use std::io;

#[derive(Debug)]
pub enum Error {
    Manifest(String),
    Store(String),
    Io(io::Error),
    Pull(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Manifest(m) => write!(f, "manifest error: {m}"),
            Error::Store(m) => write!(f, "store error: {m}"),
            Error::Io(e) => write!(f, "io error: {e}"),
            Error::Pull(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<io::Error> for Error {
    fn from(e: io::Error) -> Self {
        Error::Io(e)
    }
}

// Stand-in for std::fs::read_to_string.
fn read_file(path: &str) -> io::Result<String> {
    match path {
        "harness.toml" => Ok(String::from("name = claude")),
        "empty.toml" => Ok(String::new()),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, format!("{path} not found"))),
    }
}

fn load_name(path: &str) -> Result<String> {
    let text = read_file(path)?;
    let name = text
        .strip_prefix("name = ")
        .ok_or_else(|| Error::Manifest(format!("{path} has no name")))?;
    Ok(name.to_string())
}

fn main() {
    let mut out: Vec<String> = ["harness.toml", "missing.toml", "empty.toml"]
        .iter()
        .map(|p| match load_name(p) {
            Ok(name) => format!("ok: {name}"),
            Err(e) => e.to_string(),
        })
        .collect();
    out.push(Error::Store(String::from("lock is read-only")).to_string());
    out.push(Error::Pull(String::from("registry said 401")).to_string());
    println!("{}", out.join(" | "));
}
```
:::

> `write!(f, "...")` is the macro that writes formatted text into the formatter.
> `impl fmt::Display for Error` gives the type *human-readable* printing — the same
> trait that powers `println!("{e}")`.

## `#[from]` is a conversion

The `#[from]` attribute on a variant is exactly this `impl From`:

```rust
// what #[from] generates for Io:
impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self { Error::Io(e) }
}
```

::: exercise id="from-impl" kind="code" concepts="from_display" difficulty="3" check="exact:our err: nope" hints="`from` gets a `&str` and has to build an `Error` value|The only variant is `Error::Msg`, and it holds an owned `String`|Return `Error::Msg(String::from(s))` (or `s.to_string()`)"
Write the body of `From<&str>` so `Error::from("nope")` yields `Error::Msg` holding
`nope`. Once it works, `.into()` in `main` uses it for free. Expected output:
`our err: nope`.

```rust
enum Error { Msg(String) }

impl From<&str> for Error {
    fn from(s: &str) -> Self {
        todo!() // TODO: wrap s in Error::Msg as an owned String
    }
}

fn main() {
    let e: Error = "nope".into();
    println!("our err: {}", match e { Error::Msg(m) => m });
}
```

<solution>
```rust
enum Error { Msg(String) }

impl From<&str> for Error {
    fn from(s: &str) -> Self {
        Error::Msg(String::from(s))
    }
}

fn main() {
    let e: Error = "nope".into();
    println!("our err: {}", match e { Error::Msg(m) => m });
}
```
:::

::: exercise id="from-impl" level="+" kind="code" concepts="from_display,error_handling" difficulty="4" check="exact:42 | bad number: invalid digit found in string | empty input" hints="`?` calls `From::from` on the error for you, so once `From<ParseIntError>` exists, `s.parse()?` needs no `map_err`|The empty string must come back as `Error::Msg`, not as a parse error. Check for it *before* parsing and return early|`from` is `Error::Parse(e)`, and `double` is an `if s.is_empty()` early return, then `let n: i64 = s.parse()?;` and `Ok(n * 2)`"
Now the conversion comes from a *real* foreign error. Implement `From<ParseIntError>`,
then write `double` using `?` with **no** `map_err`. One edge case: an empty input must
be reported as `Error::Msg("empty input")`, not as a parse error. Expected output:
`42 | bad number: invalid digit found in string | empty input`.

```rust
use std::num::ParseIntError;

#[derive(Debug)]
enum Error {
    Msg(String),
    Parse(ParseIntError),
}

impl From<ParseIntError> for Error {
    fn from(e: ParseIntError) -> Self {
        todo!()
    }
}

fn double(s: &str) -> Result<i64, Error> {
    todo!("let ? do the conversion")
}

fn main() {
    let show = |r: Result<i64, Error>| match r {
        Ok(n) => n.to_string(),
        Err(Error::Parse(e)) => format!("bad number: {e}"),
        Err(Error::Msg(m)) => m,
    };
    println!("{} | {} | {}", show(double("21")), show(double("x")), show(double("")));
}
```

<solution>
```rust
use std::num::ParseIntError;

#[derive(Debug)]
enum Error {
    Msg(String),
    Parse(ParseIntError),
}

impl From<ParseIntError> for Error {
    fn from(e: ParseIntError) -> Self {
        Error::Parse(e)
    }
}

fn double(s: &str) -> Result<i64, Error> {
    if s.is_empty() {
        return Err(Error::Msg(String::from("empty input")));
    }
    let n: i64 = s.parse()?;
    Ok(n * 2)
}

fn main() {
    let show = |r: Result<i64, Error>| match r {
        Ok(n) => n.to_string(),
        Err(Error::Parse(e)) => format!("bad number: {e}"),
        Err(Error::Msg(m)) => m,
    };
    println!("{} | {} | {}", show(double("21")), show(double("x")), show(double("")));
}
```
:::

::: exercise id="from-impl" level="++" kind="code" concepts="from_display,error_handling,traits" difficulty="4" check="exact:io error: gone.txt not found | parse error: invalid digit found in string | ok 42" hints="hlock's `error.rs` has one `#[from]` per foreign error. Here that means two `impl From<...> for Error` blocks, one for `io::Error` and one for `ParseIntError`|`locked_size` needs two `?`s, one after `read_file(path)` and one after the parse. Each picks its own `From` impl from the error type|The file ends with a newline, so trim before parsing: `let n: u64 = text.trim().parse()?;` and then `Ok(n)`"
hlock's `Error` wraps several foreign errors (`io`, `toml`, `json`), each with
`#[from]`, so one function body can `?` all of them. Here `ParseIntError` stands in for
`toml::de::Error`. Write both `From` impls, then `locked_size`: read the file and parse
its contents as a `u64`, with two `?`s and no `map_err`. Note that real files end with a
newline. Expected output:
`io error: gone.txt not found | parse error: invalid digit found in string | ok 42`.

```rust
use std::fmt;
use std::io;
use std::num::ParseIntError;

#[derive(Debug)]
enum Error {
    Io(io::Error),
    Parse(ParseIntError),
}

type Result<T> = std::result::Result<T, Error>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => write!(f, "io error: {e}"),
            Error::Parse(e) => write!(f, "parse error: {e}"),
        }
    }
}

// TODO: the two From impls that #[from] would generate

// Stand-in for std::fs::read_to_string.
fn read_file(path: &str) -> io::Result<String> {
    match path {
        "size.txt" => Ok(String::from("42\n")),
        "bad.txt" => Ok(String::from("4x2\n")),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, format!("{path} not found"))),
    }
}

fn locked_size(path: &str) -> Result<u64> {
    todo!("two ? and no map_err")
}

fn main() {
    let out: Vec<String> = ["gone.txt", "bad.txt", "size.txt"]
        .iter()
        .map(|p| match locked_size(p) {
            Ok(n) => format!("ok {n}"),
            Err(e) => e.to_string(),
        })
        .collect();
    println!("{}", out.join(" | "));
}
```

<solution>
```rust
use std::fmt;
use std::io;
use std::num::ParseIntError;

#[derive(Debug)]
enum Error {
    Io(io::Error),
    Parse(ParseIntError),
}

type Result<T> = std::result::Result<T, Error>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => write!(f, "io error: {e}"),
            Error::Parse(e) => write!(f, "parse error: {e}"),
        }
    }
}

impl From<io::Error> for Error {
    fn from(e: io::Error) -> Self {
        Error::Io(e)
    }
}

impl From<ParseIntError> for Error {
    fn from(e: ParseIntError) -> Self {
        Error::Parse(e)
    }
}

// Stand-in for std::fs::read_to_string.
fn read_file(path: &str) -> io::Result<String> {
    match path {
        "size.txt" => Ok(String::from("42\n")),
        "bad.txt" => Ok(String::from("4x2\n")),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, format!("{path} not found"))),
    }
}

fn locked_size(path: &str) -> Result<u64> {
    let text = read_file(path)?;
    let n: u64 = text.trim().parse()?;
    Ok(n)
}

fn main() {
    let out: Vec<String> = ["gone.txt", "bad.txt", "size.txt"]
        .iter()
        .map(|p| match locked_size(p) {
            Ok(n) => format!("ok {n}"),
            Err(e) => e.to_string(),
        })
        .collect();
    println!("{}", out.join(" | "));
}
```
:::

::: exercise id="from-impl" level="+++" kind="code" concepts="enums,from_display,error_handling,traits" difficulty="5" check="exact:ok 3 | b.txt: expected size 5, got 4 | parse: invalid digit found in string | io: gone.txt not found | sources=-,no,yes,yes" hints="Start with the types: an enum with two tuple variants that wrap the foreign errors and one struct variant `Mismatch` with `path`, `expected` and `got` fields, plus a `Result<T>` alias|Implement `Display` for the messages, `std::error::Error` with a `source()` that returns the inner error for Io and Parse, and one `From` per foreign error so `check` can use `?` twice|`check` is: read with `?`, trim and parse with `?`, then `if got != expected` return the `Mismatch`, otherwise `Ok(got)`. In `main`, call `.source().is_some()` through the `std::error::Error` trait, so import it"
**Spec only.** Design `SyncError` from scratch, the way hlock's `error.rs` would with
`thiserror`, but written by hand:

| variant | wraps | Display |
|---|---|---|
| `Io` | `std::io::Error` | `io: <inner>` |
| `Parse` | `std::num::ParseIntError` | `parse: <inner>` |
| `Mismatch` | fields `path`, `expected`, `got` | `<path>: expected size <expected>, got <got>` |

It must implement `std::error::Error`, and `source()` returns the wrapped error for `Io`
and `Parse` and `None` for `Mismatch`. Add `From` for both foreign errors and a
`Result<T>` alias. Then write `check(path, expected)`, which reads the file (use the
given `read_file`), parses the trimmed contents as a size, and fails with `Mismatch` if
the size differs. It uses no `map_err`. Run it on `a.txt` with 3, `b.txt` with 5,
`c.txt` with 1, and `gone.txt` with 1. Print each result (`ok <size>` or the error) joined
by ` | `, then `sources=` with one entry per run: `-` for ok, otherwise `yes` or `no`.
Expected output:
`ok 3 | b.txt: expected size 5, got 4 | parse: invalid digit found in string | io: gone.txt not found | sources=-,no,yes,yes`.

```rust
use std::io;

// Given: stand-in for std::fs::read_to_string. Don't change it.
fn read_file(path: &str) -> io::Result<String> {
    match path {
        "a.txt" => Ok(String::from("3\n")),
        "b.txt" => Ok(String::from("4\n")),
        "c.txt" => Ok(String::from("one\n")),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, format!("{path} not found"))),
    }
}

fn main() {
    // Build SyncError, its impls, the Result alias and check() from the spec.
    todo!()
}
```

<solution>
```rust
use std::error::Error as StdError;
use std::fmt;
use std::io;
use std::num::ParseIntError;

// Given: stand-in for std::fs::read_to_string. Don't change it.
fn read_file(path: &str) -> io::Result<String> {
    match path {
        "a.txt" => Ok(String::from("3\n")),
        "b.txt" => Ok(String::from("4\n")),
        "c.txt" => Ok(String::from("one\n")),
        _ => Err(io::Error::new(io::ErrorKind::NotFound, format!("{path} not found"))),
    }
}

#[derive(Debug)]
enum SyncError {
    Io(io::Error),
    Parse(ParseIntError),
    Mismatch { path: String, expected: u64, got: u64 },
}

type Result<T> = std::result::Result<T, SyncError>;

impl fmt::Display for SyncError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SyncError::Io(e) => write!(f, "io: {e}"),
            SyncError::Parse(e) => write!(f, "parse: {e}"),
            SyncError::Mismatch { path, expected, got } => {
                write!(f, "{path}: expected size {expected}, got {got}")
            }
        }
    }
}

impl StdError for SyncError {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            SyncError::Io(e) => Some(e),
            SyncError::Parse(e) => Some(e),
            SyncError::Mismatch { .. } => None,
        }
    }
}

impl From<io::Error> for SyncError {
    fn from(e: io::Error) -> Self {
        SyncError::Io(e)
    }
}

impl From<ParseIntError> for SyncError {
    fn from(e: ParseIntError) -> Self {
        SyncError::Parse(e)
    }
}

fn check(path: &str, expected: u64) -> Result<u64> {
    let got: u64 = read_file(path)?.trim().parse()?;
    if got != expected {
        return Err(SyncError::Mismatch { path: path.to_string(), expected, got });
    }
    Ok(got)
}

fn main() {
    let runs = [("a.txt", 3), ("b.txt", 5), ("c.txt", 1), ("gone.txt", 1)];
    let mut shown = Vec::new();
    let mut sources = Vec::new();
    for (path, expected) in runs {
        match check(path, expected) {
            Ok(n) => {
                shown.push(format!("ok {n}"));
                sources.push("-");
            }
            Err(e) => {
                shown.push(e.to_string());
                sources.push(if e.source().is_some() { "yes" } else { "no" });
            }
        }
    }
    println!("{} | sources={}", shown.join(" | "), sources.join(","));
}
```
:::

## Reading thiserror in the wild

Now that you can hand-write `Display` and `From`, the `#[from]` / `#[error]` lines in
hlock's `error.rs` read as plain English:

- `Io(#[from] std::io::Error)` → "an IO variant, auto-convertible from any io error."
- `#[error("io error: {0}")]` → "when displayed, say `io error:` then the inner error."

::: exercise id="th-century-quiz" kind="mcq" concepts="error_handling" difficulty="2" options="It converts std::io::Error into Error::Io automatically|It forces every method to return an error|It turns the enum into an exception|It has no effect" answer="0" explain="`#[from]` makes thiserror generate an `impl From<std::io::Error> for Error`, so the `?` operator turns an I/O error into `Error::Io` automatically without a manual `map_err`."
What does `#[from]` on the `Io` variant do?
:::

::: exercise id="th-century-quiz" level="++" kind="mcq" concepts="error_handling,traits" difficulty="3" options="It fails to compile: both attributes generate impl From of std::io::Error for Error, and the two impls conflict|The first variant wins, and the second is never constructed by ?|The last variant wins|The ? operator picks the variant at runtime from the io::ErrorKind" answer="0" explain="`#[from]` expands to an `impl From<std::io::Error> for Error`. Two of them for the same source type are conflicting trait impls (E0119), because `?` has to know statically which conversion to call. When you need two meanings for one source type, drop `#[from]` on at least one variant and build it explicitly with `map_err`."
Suppose you added a second I/O variant to an `error.rs` like hlock's:

```rust
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("lock io error: {0}")]
    LockIo(#[from] std::io::Error),
}
```
What happens?
:::

::: exercise id="th-century-quiz" level="+++" kind="mcq" concepts="error_handling,traits" difficulty="4" options="Error: followed by the Debug form of the value, such as Manifest with the message in quotes|Error: followed by the Display message from the #[error] attribute|Nothing is printed, and the process exits with code 1|A panic message and a backtrace" answer="0" explain="When `main` returns `Err(e)`, the `Termination` impl prints `Error: ` followed by `{:?}` of `e`, which is the *Debug* form. That's why the output looks like `Manifest(...)` and not `manifest error: ...`. The exit code is 1, and nothing panics. CLIs that want the friendly Display text handle the error in `main` themselves, or make their error type's `Debug` impl delegate to `Display`."
```rust
fn main() -> Result<(), Error> {
    Err(Error::Manifest("missing name".into()))
}
// where Error is hlock-style: #[derive(Debug, thiserror::Error)]
// with #[error("manifest error: {0}")] on Manifest
```
What does the user see on stderr?
:::

::: only level="++"
**Splunker's notes.** `thiserror` stays out of your public API. All it generates are the
`Display`, `Error` and `From` impls you just wrote. Callers see an ordinary enum, so they
can `match` on `Error::Io` and react differently to a network failure and a bad manifest.
That's the difference from `anyhow`-style boxed errors, which are fine at the very top of
a binary. A library like hlock's core keeps its own enum, so every failure stays a value
its callers can inspect.
:::
