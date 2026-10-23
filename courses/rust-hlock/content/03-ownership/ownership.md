---
title: "Ownership — the big idea Rust is famous for"
concepts: [ownership, string_vs_str]
objectives:
  - Explain ownership, moves, and copies
  - Trace moves through real hlock functions like sha256_bytes
---

## The Big Idea in one sentence

Every value in Rust has **one owner** — the variable that holds it. When the owner goes
out of scope, the value is freed. This single rule is why Rust is memory-safe *without a
garbage collector*: it can free your memory exactly when the owner dies, because there's
exactly one owner.

```rust
fn main() {
    let s = String::from("hlock"); // `s` owns the String
    println!("{s}");
} // `s` dies here -> the String is freed, automatically
```

Python's GC and JS's collector solve the same problem by *watching* for nothing left
referencing an object at runtime. Rust solves it by *tracking ownership at compile time*.
No runtime watcher needed — that's the speed win.

## Move, don't copy

Here's where it gets spicy. Assign `b = a` for a `String`:

```rust
fn main() {
    let a = String::from("hello");
    let b = a;        // a MOVE: `a` is now dead
    println!("{b}");  // ok
    // println!("{a}"); // ERROR: value moved
}
```

Rust **moved** the String from `a` to `b` rather than copied it (copying the heap data
would be expensive). After the move, using `a` is a compile error. This is the
notorious **E0382** from module 1 — now it has a name.

::: callout type="contrast" lang="python"
**For the Pythonista.** `b = a` in Python *aliases* (both names point to one object,
no copy, no error). In Rust, `b = a` *transfers* ownership to `b`. To get Python-style
aliasing you write `b = &a` (a borrow/reference) — and that's the next lesson. To get a
real copy you write `b = a.clone()`.
:::

## Strings that can be copied vs moved

Only types that are cheap trivially still implement `Copy`. Basic scalars do
(`i32`, `f64`, `bool`, `char`), so `let y = x;` for an integer *copies* and `x` stays
alive. Heaps types like `String` and `Vec` do **not** implement `Copy` — they move.

```rust
fn main() {
    let x = 5;
    let y = x;      // Copy: x still usable
    println!("{x} {y}");   // fine

    let name = String::from("rust");
    let n2 = name;  // Move: name is dead
    println!("{n2}");
}
```

## Splunk it: sha256_bytes

Here is the *real* hlock function that hashes bytes, from `hash.rs`. Notice how it takes
`&[u8]` (a **borrow**, not ownership) and returns an owned `String`:

```rust
use sha2::{Digest, Sha256};

/// `sha256:<hex>` of raw bytes.
pub fn sha256_bytes(data: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(data);
    format!("sha256:{}", hex(&h.finalize()))
}
```

Two moves worth noticing:
- `hex(&h.finalize())` *borrows* the fresh buffer from `finalize()` — it doesn't steal it.
- `format!(...)` builds and **returns** a new `String`, transferring ownership to the
  caller. The question "who owns this String?" is answered: the caller.

Now you write one that owns its output and returns it.

::: exercise id="make-owned" kind="code" concepts="ownership,expression" difficulty="2" check="exact:sha256 rules"
Write a function `brand()` that builds and returns the owned `String` `"sha256 rules"`,
then print it. Return the last expression *without* a semicolon.

```rust
fn main() {
    println!("{}", brand());
}

fn brand() -> String {
    let mut s = String::from("sha256 ");
    s.push_str("rules");
    s   // move it out to the caller
}
```

<solution>
```rust
fn main() {
    println!("{}", brand());
}

fn brand() -> String {
    let mut s = String::from("sha256 ");
    s.push_str("rules");
    s
}
```
:::

## Spot the move

::: exercise id="move-spotter" kind="mcq" concepts="ownership" difficulty="2" options="It moves and a can no longer be used|It copies and a stays usable|It borrows the same data|It panics" answer="0"
```rust
let a = String::from("rust");
let b = a;
```
What happens to `a`?
:::

::: exercise id="copy-vs-move" kind="code" concepts="ownership" difficulty="2" check="contains:5"
Add `let z = n;` for the *integer* `n` and print both `n` and `z` — this proves integers
are `Copy` and `n` survives. (Leave the String as a move.)

```rust
fn main() {
    let n = 5;
    // let z = n;  // uncomment: integers are Copy, n stays alive
    println!("{n}");
}
```

<solution>
```rust
fn main() {
    let n = 5;
    let z = n;
    println!("{n} {z}");
}
```
:::
