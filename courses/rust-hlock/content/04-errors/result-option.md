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

::: exercise id="question-mark" kind="code" concepts="result_option,error_handling" difficulty="3" check="contains:Ok(16)"
Use `?` inside `twice_maybe` so it returns `Err("nope")` when parsing fails and
`Ok(n*2)` when it succeeds. It currently panics on bad input — fix that.

```rust
fn twice_maybe(s: &str) -> Result<i32, String> {
    let n: i32 = s.parse().map_err(|_| String::from("nope"))?;
    Ok(n * 2)
}

fn main() {
    println!("{:?}", twice_maybe("8"));   // want Ok(16)
    println!("{:?}", twice_maybe("wat")); // want Err("nope")
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

::: exercise id="unwrap-or" kind="code" concepts="result_option" difficulty="2" check="exact:0"
Make `safe` return a default `0` when the Option is `None`, using `unwrap_or_default()` —
no panic allowed.

```rust
fn safe(m: Option<i32>) -> i32 {
    m.unwrap_or_default()
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

> **A word on `unwrap()`.** You'll see `unwrap()` and `expect()` in hlock where the author
> is *sure* it can't fail. They panic if wrong. As a learner, prefer `?`,
> `unwrap_or*`, or a `match` — they force you to think about failure, which is the
> Splunker's virtue.

## Quick check

::: exercise id="result-vs-option" kind="mcq" concepts="result_option" difficulty="1" options="It carries a value | It carries an error type E as well as a value | It never carries an error | It is the same as Option" answer="1"
`Result<T, E>` differs from `Option<T>` because…
:::
