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

Only types that are trivially cheap to duplicate implement `Copy`. Basic scalars do
(`i32`, `f64`, `bool`, `char`), so `let y = x;` for an integer *copies* and `x` stays
alive. Heap types like `String` and `Vec` do **not** implement `Copy` — they move.

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

::: exercise id="make-owned" kind="code" concepts="ownership,expression" difficulty="2" check="exact:sha256 rules" hints="`String` has a method that appends a `&str` to the end of it|After appending, the function still has to hand `s` back to its caller|Call `s.push_str(...)` with the text rules, then make `s` the last line with no semicolon"
Finish `brand()` so it builds and returns the owned `String` `sha256 rules`: append
`rules` to `s`, then return `s` as the last expression *without* a semicolon. Expected
output: `sha256 rules`.

```rust
fn main() {
    println!("{}", brand());
}

fn brand() -> String {
    let mut s = String::from("sha256 ");
    // TODO: append rules to s, then move s out to the caller
    todo!()
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

::: exercise id="make-owned" level="+" kind="code" concepts="ownership,expression,string_vs_str" difficulty="3" check="exact:sha256:abc raw" hints="`with_prefix` owns `s`, so it can edit that buffer in place and hand the same String back. No `format!` needed|The body can be one `if` expression: each branch ends with `s` and no semicolon|If `algo.is_empty()` return `s` untouched, otherwise call `s.insert(0, ':')` and then `s.insert_str(0, algo)` before ending with `s`"
`with_prefix` takes ownership of a `String` and a borrowed `&str` algorithm name, and
gives back an owned `String`. If `algo` is empty it must return `s` unchanged. Otherwise
it must put `algo:` in front of the existing text. Reuse the buffer you were given: no
`format!`, no new `String`, and make the whole body a single `if` expression. Expected
output: `sha256:abc raw`.

```rust
fn main() {
    let a = with_prefix(String::from("abc"), "sha256");
    let b = with_prefix(String::from("raw"), "");
    println!("{a} {b}");
}

fn with_prefix(mut s: String, algo: &str) -> String {
    todo!("empty algo: hand s back untouched; else put algo: in front of s")
}
```

<solution>
```rust
fn main() {
    let a = with_prefix(String::from("abc"), "sha256");
    let b = with_prefix(String::from("raw"), "");
    println!("{a} {b}");
}

fn with_prefix(mut s: String, algo: &str) -> String {
    if algo.is_empty() {
        s
    } else {
        s.insert(0, ':');
        s.insert_str(0, algo);
        s
    }
}
```
:::

::: exercise id="make-owned" level="++" kind="code" concepts="ownership,expression,string_vs_str" difficulty="4" check="exact:00ff10 sha256:036c6f63" hints="`hex` borrows the bytes and builds one owned String. Pad each byte to two lowercase hex digits with the format spec `02x`|`sha256_bytes` has the same shape as hlock's: hash, then borrow the fresh buffer with `&` and wrap it with `format!`|`sha256_bytes` is `format!(...)` around `hex(&toy_finalize(data))`, and `sha256_text` calls `sha256_bytes(s.as_bytes())`"
Rebuild hlock's `hash.rs` trio by hand. `toy_finalize` stands in for
`Sha256::new()` / `update()` / `finalize()`. It is not a real hash, but it returns an
owned `Vec<u8>` just like `finalize()` does. Write:

- `hex(bytes: &[u8]) -> String`: lowercase hex, exactly two characters per byte
  (`0` must print as `00`);
- `sha256_bytes(data: &[u8]) -> String`: `sha256:` followed by the hex of the digest.
  Borrow the temporary digest, don't clone it;
- `sha256_text(s: &str) -> String`: reuse `sha256_bytes`, the way hlock does.

Expected output: `00ff10 sha256:036c6f63`.

```rust
// Stand-in for Sha256::new()/update()/finalize(). NOT a real hash.
fn toy_finalize(data: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; 4];
    for (i, b) in data.iter().enumerate() {
        out[i % 4] = out[i % 4].wrapping_mul(31).wrapping_add(*b);
    }
    out
}

/// Lowercase hex of raw bytes, two characters per byte.
fn hex(bytes: &[u8]) -> String {
    todo!()
}

/// `sha256:<hex>` of raw bytes.
fn sha256_bytes(data: &[u8]) -> String {
    todo!()
}

fn sha256_text(s: &str) -> String {
    todo!()
}

fn main() {
    println!("{} {}", hex(&[0, 255, 16]), sha256_text("hlock"));
}
```

<solution>
```rust
// Stand-in for Sha256::new()/update()/finalize(). NOT a real hash.
fn toy_finalize(data: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; 4];
    for (i, b) in data.iter().enumerate() {
        out[i % 4] = out[i % 4].wrapping_mul(31).wrapping_add(*b);
    }
    out
}

/// Lowercase hex of raw bytes, two characters per byte.
fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// `sha256:<hex>` of raw bytes.
fn sha256_bytes(data: &[u8]) -> String {
    format!("sha256:{}", hex(&toy_finalize(data)))
}

fn sha256_text(s: &str) -> String {
    sha256_bytes(s.as_bytes())
}

fn main() {
    println!("{} {}", hex(&[0, 255, 16]), sha256_text("hlock"));
}
```
:::

::: exercise id="make-owned" level="+++" kind="code" concepts="ownership,expression,string_vs_str" difficulty="4" check="exact:longest=agents.md rest=a.md,b.md,skills.md empty=none" hints="Find the index first while only reading the Vec, then move the String out with `Vec::remove`, which keeps the order of the rest. Watch out: `max_by_key` returns the LAST maximum on ties|A signature like `fn take_longest(mut v: Vec<String>) -> Option<(String, Vec<String>)>` covers the empty case with `None`|Track the best index in a loop and only replace it when a strictly longer entry shows up, then `let s = v.remove(i);` and return `Some((s, v))`"
**Spec only.** Lock entries arrive as an owned `Vec<String>`. Write a function that takes
the vector by value and *moves* the longest entry out of it. Return that entry together
with the remaining entries in their original order. Don't use `.clone()`. If two entries
tie, the first one wins. An empty vector gives no result. Design the signature yourself.

In `main`, run it on `a.md`, `agents.md`, `b.md`, `skills.md`, then on an empty vector,
and print one line: `longest=<entry> rest=<comma-joined rest> empty=<some or none>`.
Expected output: `longest=agents.md rest=a.md,b.md,skills.md empty=none`.

```rust
fn main() {
    // Build it from the spec: your own function, your own signature.
    todo!()
}
```

<solution>
```rust
fn take_longest(mut v: Vec<String>) -> Option<(String, Vec<String>)> {
    let mut best: Option<usize> = None;
    for (i, s) in v.iter().enumerate() {
        best = match best {
            Some(b) if v[b].len() >= s.len() => Some(b),
            _ => Some(i),
        };
    }
    let i = best?;
    let longest = v.remove(i);
    Some((longest, v))
}

fn main() {
    let entries: Vec<String> = ["a.md", "agents.md", "b.md", "skills.md"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    let line = match take_longest(entries) {
        Some((longest, rest)) => format!("longest={longest} rest={}", rest.join(",")),
        None => String::from("none"),
    };
    let empty = match take_longest(Vec::new()) {
        Some(_) => "some",
        None => "none",
    };
    println!("{line} empty={empty}");
}
```
:::

## Spot the move

::: exercise id="move-spotter" kind="mcq" concepts="ownership" difficulty="2" options="Moved: any later use of `a` is a compile error|Copied: `a` keeps its own `rust` and stays usable|Aliased: `a` and `b` share one String, like Python|Dropped: the String is freed as soon as `b` exists" answer="0" explain="`String` owns heap memory and is not `Copy`, so `let b = a;` *moves* ownership to `b`. `a` still exists as a name, but any later use of it is a compile error (E0382), the same error you fixed at the start of the course. It is not copied: only `Copy` types such as integers duplicate on assignment, and a `String` would need an explicit `.clone()`. It is not aliased: sharing without moving is what a borrow, `&a`, is for. And nothing is dropped, because the String now lives on in `b` and is freed when `b` goes out of scope."
```rust
let a = String::from("rust");
let b = a;
```
After these two lines, what is the state of `a`?
:::

::: exercise id="move-spotter" level="++" kind="mcq" concepts="ownership" difficulty="3" options="It compiles and prints `agents.md sha256:11`|E0382 on the `println!`: `entry` was moved|E0507 on `let path`: a field can't be moved out|E0277 on `let path`: `String` is not `Copy`" answer="0" explain="Moving `entry.path` out is a *partial move*, and it is allowed. Only the whole `entry` becomes unusable: printing `entry` or passing it to a function would fail with E0382. Its other fields are still owned and usable, so reading `entry.hash` is fine and the program prints `agents.md sha256:11`. E0507 only applies when you move a field out from *behind a reference* such as `&Entry`, and here `entry` is owned. Nothing asks for `Copy` either: a non-`Copy` value simply moves instead of being copied."
A lock entry shaped like the ones hlock writes to `harness.lock`:

```rust
struct Entry { path: String, hash: String }

fn main() {
    let entry = Entry { path: "agents.md".into(), hash: "sha256:11".into() };
    let path = entry.path;
    println!("{path} {}", entry.hash);
}
```
What happens when you build and run it?
:::

::: exercise id="move-spotter" level="+++" kind="mcq" concepts="ownership" difficulty="4" options="E0382: `hashes` was moved into the loop|Prints 2: a `for` loop borrows the Vec|Prints 0: the loop drained the Vec|E0502: the loop still borrows `hashes` mutably" answer="0" explain="`for h in hashes` calls `IntoIterator::into_iter(hashes)`, which takes the `Vec` *by value*. Each `String` is moved into `h` and the vector is gone after the loop, so `hashes.len()` is a use of a moved value (E0382). A `for` loop only borrows when you write `for h in &hashes`, which yields `&String` and would print 2. It can't print 0, because the program never compiles to run. And there is no mutable borrow anywhere, so it isn't E0502; borrows also end when the loop does."
```rust
fn main() {
    let hashes = vec![String::from("sha256:11"), String::from("sha256:22")];
    for h in hashes {
        println!("{h}");
    }
    println!("{}", hashes.len());
}
```
What happens at the last line?
:::

::: exercise id="copy-vs-move" kind="code" concepts="ownership" difficulty="2" check="exact:5 5" hints="Integers are `Copy`, so `let z = n;` copies the value and `n` stays usable|Add the `let z = n;` line before the `println!`|Change the `println!` so its format string has both `{n}` and `{z}`, separated by one space"
Add `let z = n;` for the *integer* `n`, then print both `n` and `z` on one line,
separated by a space. This proves integers are `Copy`: `n` survives the assignment.
Expected output: `5 5`.

```rust
fn main() {
    let n = 5;
    // TODO: add let z = n;  (integers are Copy, so n stays alive)
    println!("{n}"); // TODO: print both n and z
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

::: exercise id="copy-vs-move" level="+" kind="code" concepts="ownership,string_vs_str" difficulty="3" check="exact:5 rust 9" hints="`n` is a `u32`, so it is copied into `measure` for free. `s` is a String, so passing it by value moves it and the `println!` can no longer use it|Change what `measure` asks for: it only needs to read the text, so it should borrow it|Make the parameter `s: &str` and call `measure(n, &s)`"
`measure` takes a `u32` and a `String` by value. `main` wants to keep using *both*
afterwards. The integer is fine because it's `Copy`. The `String` would be moved into
`measure` and die there. Change `measure`'s signature so it only borrows the text, then
replace the `todo!()` with the right argument. Don't use `.clone()`. Expected output:
`5 rust 9`.

```rust
fn measure(n: u32, s: String) -> usize {
    s.len() + n as usize
}

fn main() {
    let n = 5;
    let s = String::from("rust");
    let total = measure(n, todo!("pass s without giving it away"));
    println!("{n} {s} {total}");
}
```

<solution>
```rust
fn measure(n: u32, s: &str) -> usize {
    s.len() + n as usize
}

fn main() {
    let n = 5;
    let s = String::from("rust");
    let total = measure(n, &s);
    println!("{n} {s} {total}");
}
```
:::

::: only level="++"
**Splunker's notes.** `hash.rs` takes `&[u8]` and returns `String` because that split is
the cheapest contract there is. The caller keeps its bytes, and the function's one
allocation, the `format!` result, has exactly one owner, which is whoever called it.
When you read a signature in hlock, ask where each argument's memory ends up. Values
passed by value are consumed. References are only looked at. Return values are new
owners. Most borrow-checker fights go away once those three lines are clear.
:::
