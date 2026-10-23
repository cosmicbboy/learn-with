---
title: "fn main, println!, and the borrow-checker's first scoldings"
concepts: [expression, string_vs_str, ownership]
objectives:
  - Decode the anatomy of a Rust compiler error
  - Use format strings and understand an E0382 borrow error
---

## Every Rust program has a door: `fn main()`

Like `def main():` in Python or the default export in JS, Rust starts at `fn main()`.
Everything you Splunk in hlock — the resolver, the worker, the sync engine — hangs off
functions that eventually get called from some `main` (or a CLI shim).

```rust
fn main() {
    println!("hello from the hlock garage");
}
```

`println!` prints a line. The `!` is the tell: **it's a macro**, not a plain function.
Macros let you write `println!("{name}")` with a template the compiler understands at
compile time. You don't need to write macros yet — you just need to recognise their
shape (`name!`) when Splunking, because hlock is full of them (`println!`, `format!`,
`vec!`, `#[derive(...)]`).

## The template placeholder: `{}`

You already interpolate strings; Rust uses `{}` for *display* anyway it can pretty-print
a value, and `{:?}` for *debug* formatting:

```rust
fn main() {
    let name = "hlock";
    let n = 7;
    println!("{name} has {n} crates");     // display
    println!("{n:?}");                       // debug (same here)
}
```

::: callout type="contrast" lang="javascript"
**JSer move.** `${name}` became `{name}` inside the template — no `$`, no backticks.
`{n:?}` is new: the `:?` asks for the `Debug` representation, which works on *any* type
that derives it. You'll rely on `{:?}` constantly while Splunking structs.
:::

## Decoding the compiler's essay: E0382

Rust errors are famously long. Here is the shape you'll see most, the **borrow/move**
error, straight from real pain:

```text
error[E0382]: borrow of moved value: `s`
 --> src/garage.rs:4:18
  |
4 |     println!("made for {s}");
  |                  ^ value borrowed here after move
  |
help: to fix the error, you can borrow the value...
```

Three things to do, in order:
1. Note the **error code** `E0382`. Google `rustc E0382` — StackOverflow has your back.
2. Read the **help** block to the end; rustc usually prints a fix.
3. Fix it, and notice how quickly the pattern becomes familiar.

The concept behind E0382 is *ownership* — the Big Idea we formally unlock next module.
For now, feel it out hands-on.

::: exercise id="scold-moved" kind="code" concepts="ownership,string_vs_str" difficulty="2"
Run this and **read the whole error** including the help block. Then fix it: print `s`
*before* it's moved, and keep the consumer line. Expected output: `made for rust`, then
`consumer says rust`.

```rust
fn main() {
    let s = String::from("rust");
    let consumer = s;
    println!("made for {s}");
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

## String vs &str — the split Python never had

Python has one `str`. Rust has **two**, and the distinction is the skeleton of the whole
language:

| | `&str` | `String` |
|---|---|---|
| what | a *borrowed* view of string data | *owns* its bytes, can grow/shrink |
| where | a literal `"flat"` or a borrow | the heap, via `String::from`/`to_string` |
| analogy | a readonly `buffer` you don't own | a `mv`-able live buffer |

In Python terms: a `String` is the actual str object you own; a `&str` is *a reference to
str data that lives somewhere else* (like passing `chars: bytes` without the list).

::: exercise id="string-convert" kind="code" concepts="string_vs_str" difficulty="2" check="contains:borrowed: hello"
Complete the function so it prints `owned: hello` then `borrowed: hello`. Use
`s.clone()` for the owned move and `&s` (or `s.as_str()`) for the borrowed view.

```rust
fn main() {
    let s = String::from("hello");
    let owned = s.clone();   // a full copy you own
    let borrowed = &s;       // a view you don't own
    println!("owned: {owned}");
    println!("borrowed: {borrowed}");
}
```

<solution>
```rust
fn main() {
    let s = String::from("hello");
    let owned = s.clone();
    let borrowed = &s;
    println!("owned: {owned}");
    println!("borrowed: {borrowed}");
}
```
:::

## Self-check

::: exercise id="macro-spotter" kind="mcq" concepts="expression" difficulty="1" options="println!|main|fn String|format" answer="0"
Which of these is a *macro* (notice the `!`)?
:::
