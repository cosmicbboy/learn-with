---
title: First blood — compile something real
concepts: [expression, string_vs_str]
objectives:
  - See a real compiler error and decode its anatomy
  - Use format strings with the {} placeholder
---

## Reading a compiler error like a Splunker

Rust errors look scary until you learn their anatomy. Here's a taste from real life —
every hlock contributor reads these daily. A typical one:

```text
error[E0382]: borrow of moved value: `s`
 --> src/main.rs:4:18
  |
4 |     println!("{s}");
  |                  ^ value borrowed here after move
```

The **third piece** is the gold: `error[E0382]` is the error *code*, and googling exactly
that code (`rustc E0382`) is how you learn Rust faster than reading docs. The line/column
tells you exactly where. Treat these codes as a map, not a wall.

::: callout type="challenge"
**Rust's errors are long on purpose.** The compiler is trying to teach you the *why*,
not just the *where*. Slow down and actually read the help block to the end — it often
spells out the fix, quote by quote.
:::

## Format strings: `{}` and the borrowed-value trap

You already know f-strings and template literals. Rust has the same idea: `println!`
takes a template and interpolates values with curly braces.

```rust
fn main() {
    let tool = "hlock";
    println!("made with {tool} and rust");
    println!("also positional: {} {}", "first", "second");
}
```

::: callout type="contrast" lang="javascript"
**For the JSer.** `print(f"{tool}")` / `${tool}` became `println!("{tool}")`. No `f`
prefix, no `$`. Subtle and important: in Rust the `{}` placeholder *knows how to display*
the value via the `Display` trait — even custom types can implement it (a whole lesson
later).
:::

Now let's make you actually hit a borrow error, because that's your Splunking destiny.

::: exercise id="moved-value" kind="code" concepts="ownership,expression" difficulty="2"
This program won't compile — it's a `E0382 borrow of moved value`. Run it and read the
error. Then fix it by using a *reference* (`&s`) in place of copying, OR by reordering so
you print before the move. Either way it must print `made for rust`.

```rust
fn main() {
    let s = String::from("rust");
    let consumer = s;            // s is moved here
    println!("made for {s}");    // boom: s was moved
    println!("consumer says {consumer}");
}
```

<solution>
```rust
fn main() {
    let s = String::from("rust");
    println!("made for {s}");
    let consumer = s;
    println!("consumer says {consumer}");
}
```
:::

> That `String::from("rust")` is worth pausing on. `"rust"` is a *string literal* (a
> `&str`); `String` is an *owned, growable* string. `String::from(...)` converts one to
> the other. This `String` vs `&str` split has *no* exact Python analogue — it's the
> owned-vs-borrowed distinction that runs through all of Rust. We'll crack it properly in
> the ownership module.

## Statements vs expressions

Here's a founder-level Rust idea, visible as early as our little programs: in Rust,
everything is an **expression** that yields a value, and a function returns the last
expression *without* a `return` keyword:

::: exercise id="func-expression" kind="output" concepts="expression" difficulty="2" check="exact:12"
Fill in the body so `double(6)` returns `12`. **Notice there's no `return`** — the last
expression (with no semicolon) is the return value. A `;` would turn the expression into
a *statement* that returns `()`, so dropping the semicolon is the whole trick.

```rust
fn double(n: i32) -> i32 {
    n * 2   // <-- no semicolon = this is the return value
}

fn main() {
    println!("{}", double(6));
}
```

<solution>
```rust
fn double(n: i32) -> i32 {
    n * 2
}

fn main() {
    println!("{}", double(6));
}
```
:::

::: callout type="contrast" lang="python"
**For the Pythonista.** You write `def double(n): return n * 2`. In Rust, the "implicit
return" is idiomatic. Watch that you don't slap a `;` after `n * 2` — that's the single
most common first-day bug (it changes the return type to `()` and the compiler scolds you
with a "mismatched types" error that's worth reading carefully).
:::

## Quick self-check

::: exercise id="expr-quiz" kind="mcq" concepts="expression" difficulty="1" options="n + 1 IS the return value (no semicolon)|A semicolon turns it into a statement returning ()|Both are valid and equivalent|Rust requires an explicit return keyword" answer="2"
```rust
fn inc(n: i32) -> i32 {
    n + 1;
}
```
Why does this function fail to compile?
:::
