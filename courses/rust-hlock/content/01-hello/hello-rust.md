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

You already interpolate strings. Rust uses `{}` for *display* formatting (the
human-facing form, like Python's `str()`) and `{:?}` for *debug* formatting (like
`repr()`):

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

::: exercise id="scold-moved" kind="code" concepts="ownership,string_vs_str" difficulty="2" check="exact:made for rust, consumer says rust" hints="The error points at the line that moved `s` and the later line that still uses it|Any use of `s` has to happen before ownership passes to `consumer`|Move the `made for {s}` print above `let consumer = s;` and leave the consumer line as it is"
Run this and **read the whole error**, including the help block. Then fix it: print `s`
*before* it's moved, and keep the consumer line. (`print!` is `println!` without the line
break, so both parts land on one line.) Expected output: `made for rust, consumer says rust`.

```rust
fn main() {
    let s = String::from("rust");
    let consumer = s;
    print!("made for {s}, ");
    println!("consumer says {consumer}");
}
```

<solution>
```rust
fn main() {
    let s = String::from("rust");
    print!("made for {s}, ");
    let consumer = s;
    println!("consumer says {consumer}");
}
```
:::

::: exercise id="scold-moved" kind="code" level="+" concepts="ownership,string_vs_str" difficulty="3" check="exact:rust x3 = 12" hints="Try `let n = measure(s);` and read the error: it says `s` was moved in a *previous iteration of the loop*|A loop body runs many times, so it can't give `s` away even once. `measure` only needs to look at the text|Change `measure` to take `s: &str` and call `measure(&s)` inside the loop"
A move inside a loop is the same E0382 in disguise: the first iteration would give `s` away
and the second would have nothing left. Make `measure` borrow instead of take, then fill in
the `todo!()` so the loop measures `s` three times. No `.clone()`. Expected output:
`rust x3 = 12`.

```rust
fn measure(s: String) -> usize {
    s.len()
}

fn main() {
    let s = String::from("rust");
    let mut total: usize = 0;
    for _ in 0..3 {
        let n: usize = todo!("measure s without giving it away");
        total += n;
    }
    println!("{s} x3 = {total}");
}
```

<solution>
```rust
fn measure(s: &str) -> usize {
    s.len()
}

fn main() {
    let s = String::from("rust");
    let mut total: usize = 0;
    for _ in 0..3 {
        let n = measure(&s);
        total += n;
    }
    println!("{s} x3 = {total}");
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

::: exercise id="string-convert" kind="code" concepts="string_vs_str" difficulty="2" check="contains:borrowed: hello" hints="`owned` needs its own heap copy of the text, and `borrowed` only needs to look at `s`|`String` has a method that duplicates it, and `&` creates a reference|Use `s.clone()` for `owned` and `&s` (or `s.as_str()`) for `borrowed`"
Replace the two `todo!()`s without moving `s`: `owned` is a full copy of `s` that you own,
and `borrowed` is a view of `s` that you don't. The program should print `owned: hello`,
then `borrowed: hello`.

```rust
fn main() {
    let s = String::from("hello");
    let owned: String = todo!();   // TODO: a full copy of s that you own
    let borrowed: &str = todo!();  // TODO: a view of s that you don't own
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

::: exercise id="string-convert" kind="code" level="+" concepts="string_vs_str,ownership" difficulty="3" check="exact:hlock hlock HLOCK" hints="A `&str` you return can point into the `&str` you were given, so no new String is needed. Strip any trailing slash first|`trim_end_matches('/')` drops trailing slashes, and `rsplit('/').next()` gives the piece after the last slash. `rsplit` always yields at least one piece|Body: `url.trim_end_matches('/').rsplit('/').next().unwrap_or(url)`, and `shouty` is `name.to_uppercase()`"
Write `repo_name`, which returns the **borrowed** last path segment of a repo URL. It must
work on a `String` (borrowed with `&`) and on a plain literal, and it must survive a trailing
`/`. Then make `shouty`, an **owned** uppercase copy of `name`. Expected output:
`hlock hlock HLOCK`.

```rust
fn repo_name(url: &str) -> &str {
    todo!("return the part after the last /, ignoring a trailing /")
}

fn main() {
    let url = String::from("https://github.com/unionai-oss/hlock/");
    let name: &str = repo_name(&url);
    let bare: &str = repo_name("hlock");
    let shouty: String = todo!("an owned, uppercase copy of name");
    println!("{name} {bare} {shouty}");
}
```

<solution>
```rust
fn repo_name(url: &str) -> &str {
    url.trim_end_matches('/').rsplit('/').next().unwrap_or(url)
}

fn main() {
    let url = String::from("https://github.com/unionai-oss/hlock/");
    let name: &str = repo_name(&url);
    let bare: &str = repo_name("hlock");
    let shouty: String = name.to_uppercase();
    println!("{name} {bare} {shouty}");
}
```
:::

## Self-check

::: exercise id="macro-spotter" kind="mcq" concepts="expression" difficulty="1" options="`println!(...)`|`String::from(...)`|`name.len()`|`main()`" answer="0" explain="The `!` after the name marks a macro call, so `println!(...)` is a macro: it expands at compile time and checks its template against its arguments. `String::from(...)` is an ordinary associated function of the `String` type, `name.len()` is a method call, and `main()` calls a plain function. None of them has a `!`."
You'll read all four of these calls in Rust code. Which one is a *macro* call?
:::

::: exercise id="macro-spotter" kind="mcq" level="+" concepts="expression" difficulty="2" options="`String::from(...)`|`vec![1, 2, 3]`|`format!(...)`|`#[derive(Debug)]`" answer="0" explain="`String::from` is an ordinary associated function: it runs at run time and has no `!`. `vec!` and `format!` are function-like macros, and the `!` gives them away even with square brackets. `#[derive(Debug)]` is an attribute that invokes a *derive macro*, which generates the `Debug` impl at compile time without any `!`."
hlock's source uses all four of these. Which one is **not** a macro?
:::
