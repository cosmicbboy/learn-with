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

::: exercise id="hand-display" kind="code" concepts="from_display,traits" difficulty="3" check="exact:Error: boom"
Complete the `Display` impl so `e.to_string()` produces `Error: boom`. Set the error's
inner `String` to `"boom"` here.

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

::: exercise id="from-impl" kind="code" concepts="from_display" difficulty="3" check="exact:our err: nope"
Write the `From<&str>` impl so `Error::from("nope")` yields `Error::Msg("nope")` — then
the `?`-style call below works.

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

## Reading thiserror in the wild

Now that you can hand-write `Display` and `From`, the `#[from]` / `#[error]` lines in
hlock's `error.rs` read as plain English:

- `Io(#[from] std::io::Error)` → "an IO variant, auto-convertible from any io error."
- `#[error("io error: {0}")]` → "when displayed, say `io error:` then the inner error."

::: exercise id="th-century-quiz" kind="mcq" concepts="error_handling" difficulty="2" options="It converts std::io::Error into Error::Io automatically|It forces every method to return an error|It turns the enum into an exception|It has no effect" answer="0"
What does `#[from]` on the `Io` variant do?
:::
