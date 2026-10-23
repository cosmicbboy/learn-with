---
title: "Borrowing, references, slices, and String vs &str"
concepts: [borrowing, slices, lifetimes, string_vs_str]
objectives:
  - Share data without moving it, with &T and &mut T
  - Read slices &[u8]/&str and know when to borrow vs own
---

## Borrowing: pass a view, not the thing

Passing a `String` to a function *moves* it (see the last lesson). Often you don't want
that — you just want to *look at it*. For that, **borrow** with `&`:

```rust
fn len_upper(s: &String) -> usize {
    s.len()
}

fn main() {
    let name = String::from("rust");
    let n = len_upper(&name); // borrow -> name stays alive
    println!("{name} is {n} bytes"); // still usable!
}
```

The borrow rule, memorized (the borrow checker enforces it):
> **At any moment, you may have EITHER any number of shared borrows (`&T`)
> OR one mutable borrow (`&mut T`), but not both.**

It's a compile-time version of a real correctness rule. Python/JS let you mutate an
object through every reference silently — a classic source of bugs. Rust *freezes* the
world while you hold the only mutable key.

::: callout type="contrast" lang="javascript"
**For the JSer.** `const a = { x: 1 }; const b = a; b.x = 2;` — in JS, `a.x` changed too,
surprise. In Rust you'd write `let b = &mut a;` and being explicit that you're mutating
*through a borrow* is the whole point. No hidden aliasing.
:::

## `&mut T` — exactly one mutable borrower

Here's hlock-real correctness: you cannot hold a shared `&` and a mutable `&mut` to the
same data at the same time. That's an `E0502` "cannot borrow as mutable" — googling
that code gets you straight to a fix.

::: exercise id="two-borrows" kind="code" concepts="borrowing,lifetimes" difficulty="3"
This truly won't compile — E0502. Here `a` (a shared borrow) is used *after* you mutate
`count`, so the borrow really is alive across the mutation. Run it, read the error, then
reorder so both shared prints happen before you mutate. Output: `a=1 b=1` then `now 2`.

```rust
fn main() {
    let mut count = 1;
    let a = &count;        // shared borrow starts
    count += 1;            // E0502: count is borrowed here
    let b = &count;
    println!("a={a} b={b}"); // a is used after the mutation
}
```

<solution>
```rust
fn main() {
    let mut count = 1;
    let a = &count;
    let b = &count;
    println!("a={a} b={b}");   // shared reads finish
    count += 1;
    println!("now {count}");
}
```
:::

## Slices: a view into a contiguous run

hlock's `sha256_bytes(data: &[u8])` takes a **slice** — a borrowed view of some bytes
(`&[T]`). And `&str` is the *string* special case (a slice of `u8` guaranteed to be UTF-8).

| syntax | name | you own it? |
|---|---|---|
| `Vec<u8>` | vector | yes |
| `&[u8]` | byte slice | no — a view |
| `String` | owned string | yes |
| `&str` | string slice | no — a view |

The lifetime `&'a` in signatures (like `fn f<'a>(s: &'a str)`) is Rust telling *who
lives as long as the borrow*. When you Splunk hlock you'll see `&str` everywhere — the
idiomatic choice when a function only needs to *read* a string. That's why the real
`sha256_text` takes `&str`:

```rust
pub fn sha256_text(s: &str) -> String {
    sha256_bytes(s.as_bytes())
}
```

::: exercise id="slices-practice" kind="code" concepts="string_vs_str,slices" difficulty="3" check="exact:foobar"
Complete `concat` to take two `&str` and return an owned `String`, using `.clone()` /
`to_string()` / `push_str` as needed.

```rust
fn concat(a: &str, b: &str) -> String {
    let mut out = String::new();
    out.push_str(a);
    out.push_str(b);
    out
}

fn main() {
    let result = concat("foo", "bar");
    println!("{result}");
}
```

<solution>
```rust
fn concat(a: &str, b: &str) -> String {
    let mut out = String::new();
    out.push_str(a);
    out.push_str(b);
    out
}

fn main() {
    let result = concat("foo", "bar");
    println!("{result}");
}
```
:::

## Borrowing rule memory hook

```
               many     |   one
  shared &T  ✓ ✓ ✓ ✓    |   ✗
  mutable &mut T        |   ✓
        (a reversed/write lock, at compile time — but always correct.)
```

::: exercise id="borrow-quiz" kind="mcq" concepts="borrowing" difficulty="2" options="Yes — shared borrows stack|No — a mutable borrow must be exclusive|Only once|Yes but only on the same line" answer="1"
Can you hold a `&mut Vec<T>` while a shared `&Vec<T>` is still in scope?
:::
