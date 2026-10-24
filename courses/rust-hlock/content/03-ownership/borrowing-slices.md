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

::: exercise id="two-borrows" kind="code" concepts="borrowing,lifetimes" difficulty="3" check="contains:now 2" hints="A shared borrow stays alive until its last use, which here is the `println!` after `count += 1`|You can't mutate `count` while `a` is still going to be read|Take both borrows and print `a={a} b={b}` first, then do `count += 1` and print `now {count}`"
This truly won't compile. Here `a` (a shared borrow) is used *after* you mutate `count`,
so the borrow really is alive across the mutation. Because `count += 1` *assigns* rather
than taking a `&mut`, the error is E0506 ("cannot assign to `count` because it is
borrowed"), the assignment cousin of E0502. Run it, read the error, then reorder so both
shared reads are printed before you mutate, and add a second line that prints the new
value. Expected output: `a=1 b=1`, then `now 2` on the next line.

```rust
fn main() {
    let mut count = 1;
    let a = &count;        // shared borrow starts
    count += 1;            // E0506: count is borrowed here
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

::: exercise id="two-borrows" level="+" kind="code" concepts="borrowing,lifetimes" difficulty="4" check="exact:first=sha256:aa len=2" hints="Uncomment the push and read the error. `first` points *into* the Vec, and a push may reallocate and move every element|Reordering won't help here, because the print needs both the old first hash and the new length after the push|Make `first` an owned copy with `hashes[0].clone()` so it no longer borrows `hashes`, then the push is allowed"
This one compiles, but it's wrong: it prints `len=1` because the push is commented out.
Uncomment the push and you get E0502, because `first` is a shared borrow *into* the
vector and `push` needs `&mut hashes` while that borrow is still used. Make it print
the original first hash *and* the new length. Expected output: `first=sha256:aa len=2`.

```rust
fn main() {
    let mut hashes = vec![String::from("sha256:aa")];
    let first = &hashes[0];
    // hashes.push(String::from("sha256:bb")); // TODO: uncomment, then fix the E0502
    println!("first={first} len={}", hashes.len());
}
```

<solution>
```rust
fn main() {
    let mut hashes = vec![String::from("sha256:aa")];
    let first = hashes[0].clone(); // an owned copy, not a borrow into hashes
    hashes.push(String::from("sha256:bb"));
    println!("first={first} len={}", hashes.len());
}
```
:::

::: exercise id="two-borrows" level="++" kind="code" concepts="borrowing,slices,lifetimes" difficulty="4" check="exact:true toy:12d91d81" hints="`files` is a shared slice, so you can't sort it in place. Collect a `Vec` of references to its entries and sort that instead|`sort_by_key` with a closure that returns the path. The key is a `&str` borrowed from `files`, not from the Vec you are sorting|Create one `let mut h = Hasher::new();`, loop over the sorted refs calling `h.update` four times per entry (path bytes, `&[0]`, content bytes, `&[0]`), then `format!` with `toy:{:08x}` around `h.finalize()`"
A directory digest shaped like hlock's `hash.rs`. Entries can arrive in any order, but
the digest must not depend on that order. Write `sha256_dir` so that it:

1. sorts the entries by path *without* cloning or mutating the borrowed input;
2. feeds every entry into **one** `&mut` hasher in order: path bytes, a `0` byte, content
   bytes, a `0` byte;
3. returns `toy:` followed by the final state as 8 lowercase hex digits.

`Hasher` stands in for `sha2::Sha256` (it's not a real hash). Both listings must give the
same digest. Expected output: `true toy:12d91d81`.

```rust
// Stand-in for sha2::Sha256. NOT a real hash, but used the same way.
struct Hasher { state: u32 }

impl Hasher {
    fn new() -> Self { Hasher { state: 17 } }
    fn update(&mut self, data: &[u8]) {
        for b in data {
            self.state = self.state.wrapping_mul(31).wrapping_add(*b as u32);
        }
    }
    fn finalize(self) -> u32 { self.state }
}

fn sha256_dir(files: &[(&str, &str)]) -> String {
    todo!()
}

fn main() {
    let a = [("skills/b.md", "two"), ("agents.md", "one"), ("skills/a.md", "")];
    let b = [("skills/a.md", ""), ("agents.md", "one"), ("skills/b.md", "two")];
    let (ha, hb) = (sha256_dir(&a), sha256_dir(&b));
    println!("{} {}", ha == hb, ha);
}
```

<solution>
```rust
// Stand-in for sha2::Sha256. NOT a real hash, but used the same way.
struct Hasher { state: u32 }

impl Hasher {
    fn new() -> Self { Hasher { state: 17 } }
    fn update(&mut self, data: &[u8]) {
        for b in data {
            self.state = self.state.wrapping_mul(31).wrapping_add(*b as u32);
        }
    }
    fn finalize(self) -> u32 { self.state }
}

fn sha256_dir(files: &[(&str, &str)]) -> String {
    let mut sorted: Vec<&(&str, &str)> = files.iter().collect();
    sorted.sort_by_key(|(path, _)| *path);
    let mut h = Hasher::new();
    for (path, content) in sorted {
        h.update(path.as_bytes());
        h.update(&[0]);
        h.update(content.as_bytes());
        h.update(&[0]);
    }
    format!("toy:{:08x}", h.finalize())
}

fn main() {
    let a = [("skills/b.md", "two"), ("agents.md", "one"), ("skills/a.md", "")];
    let b = [("skills/a.md", ""), ("agents.md", "one"), ("skills/b.md", "two")];
    let (ha, hb) = (sha256_dir(&a), sha256_dir(&b));
    println!("{} {}", ha == hb, ha);
}
```
:::

::: exercise id="two-borrows" level="+++" kind="code" concepts="borrowing,lifetimes,slices,string_vs_str" difficulty="5" check="exact:3 sha256:11 sha256:33 sha256:33 -" hints="`str::lines` and `split_once('=')` give you `&str` pieces that borrow from `text`, so no allocation is needed. Lines without `=` simply drop out|With two reference inputs, elision can't pick a lifetime for the output. Tie the result to the entries only, not to the path you look up|Try `fn latest<'a>(entries: &[(&'a str, &'a str)], path: &str) -> Option<&'a str>` and search from the end with `.iter().rev().find(...)`"
**Spec only.** Lock lines arrive as `path=hash` text, and the same path may appear more
than once. The last occurrence wins, and malformed lines are skipped. Build two
functions, without allocating any new `String`s:

- `entries(text)` returns every `(path, hash)` pair as slices **borrowed from `text`**;
- `latest(entries, path)` returns the last hash for `path`, if there is one.

The lookup key must be allowed to die before the result is used. In `main`, get one
result with a temporary key: `let found = { let key = String::from("b.md"); latest(&es, &key) };`.
Use it after the block ends. Print the entry count, then the latest hash for `a.md`,
`b.md`, the temporary-key lookup, and `c.md`, using `-` for a missing one. Expected
output: `3 sha256:11 sha256:33 sha256:33 -`.

```rust
fn main() {
    let text = String::from("b.md=sha256:22\na.md=sha256:11\nbad line\nb.md=sha256:33");
    // Build entries() and latest() from the spec, then print the line.
    todo!()
}
```

<solution>
```rust
fn entries(text: &str) -> Vec<(&str, &str)> {
    text.lines().filter_map(|line| line.split_once('=')).collect()
}

fn latest<'a>(entries: &[(&'a str, &'a str)], path: &str) -> Option<&'a str> {
    entries.iter().rev().find(|(p, _)| *p == path).map(|(_, h)| *h)
}

fn main() {
    let text = String::from("b.md=sha256:22\na.md=sha256:11\nbad line\nb.md=sha256:33");
    let es = entries(&text);
    let found = {
        let key = String::from("b.md");
        latest(&es, &key)
    };
    println!(
        "{} {} {} {} {}",
        es.len(),
        latest(&es, "a.md").unwrap_or("-"),
        latest(&es, "b.md").unwrap_or("-"),
        found.unwrap_or("-"),
        latest(&es, "c.md").unwrap_or("-"),
    );
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

::: exercise id="slices-practice" kind="code" concepts="string_vs_str,slices" difficulty="3" check="exact:foobar" hints="`out` starts empty, and `push_str` appends a `&str` to a `String`|Call `push_str` twice, once for `a` and once for `b`|After `out.push_str(a);` and `out.push_str(b);`, make `out` the last expression with no semicolon"
Complete `concat` so it takes two `&str` and returns an owned `String` holding both. Use
`push_str` to append each slice to `out`, then return it. Expected output: `foobar`.

```rust
fn concat(a: &str, b: &str) -> String {
    let mut out = String::new();
    // TODO: push a, then b, onto out, then return out
    todo!()
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

::: exercise id="slices-practice" level="+" kind="code" concepts="slices,string_vs_str,lifetimes" difficulty="4" check="exact:harness.toml toml -" hints="Both functions return a view into `path`, so no `String` is involved. Elision ties the output lifetime to the one input|`rfind('/')` gives the byte index of the last slash. Slice from just after it|Get the extension from `file_name(path)`, not from the whole path, with `rsplit_once('.')`, then keep only the right half with `.map`"
Return **slices**, not new Strings. `file_name` gives the part after the last `/`, or the
whole path if there's no slash. `extension` gives the text after the last `.` *of the
file name*, if it has one. Watch the edge case: in `v1.2/README` the dot is in the
directory, so there's no extension. Expected output: `harness.toml toml -`.

```rust
fn file_name(path: &str) -> &str {
    todo!()
}

fn extension(path: &str) -> Option<&str> {
    todo!()
}

fn main() {
    let p = String::from("skills/review/harness.toml");
    let d = String::from("v1.2/README");
    println!("{} {} {}", file_name(&p), extension(&p).unwrap_or("-"), extension(&d).unwrap_or("-"));
}
```

<solution>
```rust
fn file_name(path: &str) -> &str {
    match path.rfind('/') {
        Some(i) => &path[i + 1..],
        None => path,
    }
}

fn extension(path: &str) -> Option<&str> {
    file_name(path).rsplit_once('.').map(|(_, ext)| ext)
}

fn main() {
    let p = String::from("skills/review/harness.toml");
    let d = String::from("v1.2/README");
    println!("{} {} {}", file_name(&p), extension(&p).unwrap_or("-"), extension(&d).unwrap_or("-"));
}
```
:::

::: exercise id="slices-practice" level="++" kind="code" concepts="slices,string_vs_str,lifetimes" difficulty="4" check="exact:sha256/1a2b3c4d none none md5/FF none" hints="`split_once(':')` gives `(algo, hex)` as borrowed slices. Then reject the bad shapes before returning `Some`|A hex part is valid when it is not empty and every char passes `is_ascii_hexdigit`. Use `.chars().all(...)`|For `short`, slice `&hex[..n.min(hex.len())]`. It is safe because valid hex is ASCII, one byte per char"
hlock writes content ids as `sha256:<hex>` (see `sha256_bytes`). Parse them back
**without allocating**. `split_digest` returns borrowed `(algo, hex)` slices, or `None`
when there's no `:`, either part is empty, or the hex part has a non-hex character.
`short` returns at most the first `n` characters of the hex. Expected output:
`sha256/1a2b3c4d none none md5/FF none`.

```rust
fn split_digest(id: &str) -> Option<(&str, &str)> {
    todo!()
}

fn short(hex: &str, n: usize) -> &str {
    todo!()
}

fn main() {
    let ids = ["sha256:1a2b3c4d5e6f", "sha256:", "nocolon", "md5:FF", "sha256:xyz"];
    let out: Vec<String> = ids
        .iter()
        .map(|id| match split_digest(id) {
            Some((algo, hex)) => format!("{algo}/{}", short(hex, 8)),
            None => String::from("none"),
        })
        .collect();
    println!("{}", out.join(" "));
}
```

<solution>
```rust
fn split_digest(id: &str) -> Option<(&str, &str)> {
    let (algo, hex) = id.split_once(':')?;
    if algo.is_empty() || hex.is_empty() || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some((algo, hex))
}

fn short(hex: &str, n: usize) -> &str {
    &hex[..n.min(hex.len())]
}

fn main() {
    let ids = ["sha256:1a2b3c4d5e6f", "sha256:", "nocolon", "md5:FF", "sha256:xyz"];
    let out: Vec<String> = ids
        .iter()
        .map(|id| match split_digest(id) {
            Some((algo, hex)) => format!("{algo}/{}", short(hex, 8)),
            None => String::from("none"),
        })
        .collect();
    println!("{}", out.join(" "));
}
```
:::

::: exercise id="slices-practice" level="+++" kind="code" concepts="slices,borrowing,lifetimes" difficulty="4" check="exact:start=2 len=3 hex=616161 empty=none" hints="Return a subslice of the input such as `&data[start..start + len]`. Elision ties it to `data`, so nothing is copied|Walk the bytes once and keep the start of the current run. A run ends when the byte changes or at the end of the slice|Only replace the best run when the new one is strictly longer, which keeps the first one on ties, and handle the empty slice up front with `None`"
**Spec only.** Write `longest_run`: given a byte slice, return the start index and a
**borrowed subslice** of the longest run of identical bytes. On a tie the first run wins,
and an empty input gives `None`. Also write a `hex` helper for byte slices. Run it on
`b"hlaaabbb"`, then on an empty slice. Print one line:
`start=<i> len=<n> hex=<hex of the run> empty=<some or none>`. Expected output:
`start=2 len=3 hex=616161 empty=none`.

```rust
fn main() {
    let data = b"hlaaabbb";
    // Build longest_run() and hex() from the spec, then print the line.
    todo!()
}
```

<solution>
```rust
fn longest_run(data: &[u8]) -> Option<(usize, &[u8])> {
    if data.is_empty() {
        return None;
    }
    let (mut best_start, mut best_len) = (0, 0);
    let mut start = 0;
    for i in 1..=data.len() {
        if i == data.len() || data[i] != data[start] {
            if i - start > best_len {
                best_start = start;
                best_len = i - start;
            }
            start = i;
        }
    }
    Some((best_start, &data[best_start..best_start + best_len]))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn main() {
    let data = b"hlaaabbb";
    let line = match longest_run(data) {
        Some((start, run)) => format!("start={start} len={} hex={}", run.len(), hex(run)),
        None => String::from("none"),
    };
    let empty = if longest_run(&[]).is_none() { "none" } else { "some" };
    println!("{line} empty={empty}");
}
```
:::

## Borrowing rule memory hook

```
               many     |   one
  shared &T  ✓ ✓ ✓ ✓    |   ✗
  mutable &mut T        |   ✓
        (a read/write lock, at compile time — but always correct.)
```

::: exercise id="borrow-quiz" kind="mcq" concepts="borrowing" difficulty="2" options="No: a `&mut` must be the only live borrow|Yes: borrows of one Vec can always stack|Yes, if the `&mut` is taken before the `&`|Yes, inside an `unsafe` block" answer="0" explain="Rust allows many `&` readers or exactly one `&mut` writer at a time, never both. While a shared `&Vec<T>` is still going to be read, the borrow checker rejects a `&mut` to the same vector (E0502). Only shared borrows stack. The order doesn't matter: a live `&mut` blocks a later `&` just the same. And `unsafe` doesn't switch the borrow checker off for references; it only unlocks things like raw pointers."
Can you take and use a `&mut Vec<T>` while a shared `&Vec<T>` to the same vector is
still going to be read later?
:::

::: exercise id="borrow-quiz" level="++" kind="mcq" concepts="borrowing,lifetimes" difficulty="3" options="Compiles, prints `1` then `[1, 2, 3]`|E0502 at `v.push(3)`: `first` is still in scope|E0502 at the last `println!`: `push` still holds `&mut v`|Compiles, but `first` dangles after the push" answer="0" explain="Borrows end at their *last use*, not at the end of the block (non-lexical lifetimes). `first` is last used in the first `println!`, so by the time `push` takes `&mut v` no shared borrow is alive, even though `first` is still in scope. Move that `println!` below the push and you do get E0502. The `&mut v` that `push` takes ends when the call returns, so the last `println!` is free to borrow `v` again. And safe Rust never lets a reference dangle: if `first` were used after the push, the code wouldn't compile at all."
```rust
fn main() {
    let mut v = vec![1, 2];
    let first = &v[0];
    println!("{first}");
    v.push(3);
    println!("{:?}", v);
}
```
What happens when you build and run it?
:::

::: exercise id="borrow-quiz" level="+++" kind="mcq" concepts="borrowing,lifetimes" difficulty="4" options="A compiles; B is E0502|A is E0502; B compiles|A compiles; B compiles|A is E0499; B is E0502" answer="0" explain="`v.push(v.len())` in A works thanks to *two-phase borrows*. The `&mut v` for the method call is only reserved while the arguments are evaluated, so the shared `v.len()` finishes before the mutable borrow is activated, and A compiles (it isn't E0502, and there is only one `&mut`, so it isn't E0499 either). In B, `last` is a shared borrow into `w` that is still used by the `println!` after `push` needs `&mut w`, so non-lexical lifetimes can't end it early and the borrow checker rejects it (E0502). The fix is to copy the value out first, `let last = *w.last().unwrap();`."
```rust
// A
let mut v = vec![1usize];
v.push(v.len());

// B
let mut w = vec![1usize];
let last = w.last().unwrap();
w.push(*last);
println!("{last}");
```
How does the compiler treat snippets A and B?
:::

::: only level="++"
**Splunker's notes.** Lifetimes rarely show up in hlock's signatures, and that's because
of the elision rules. With one reference in, the output borrows from it (`file_name`).
With `&self` in, the output borrows from `self`. With two references in, you have to
write `'a` and say which input the result comes from. In functions shaped like
`hash.rs`'s, the borrow ends when the function returns: the input is read, and a fresh
owned `String` comes out. That's why those functions are so easy to call from anywhere.
:::
