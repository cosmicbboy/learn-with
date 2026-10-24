---
title: "Iterators, closures, and collecting without loops"
concepts: [iterators, collections, expression]
objectives:
  - Compose map/filter/fold and closures
  - Read hlock's recursive sorted() through an iterator lens
---

## Iterators: lazy pipelines

In Python you have list comprehensions; in JS you have `.map`/`.filter`/`.reduce`.
Rust iterators are the same idea, expressed as a lazy chain ending in a **consumer**
like `.collect()`, `.sum()`, `.count()`, or `.for_each()`:

```rust
fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6];
    let evens_x10: Vec<i32> = nums.iter().filter(|n| *n % 2 == 0).map(|n| n * 10).collect();
    println!("{evens_x10:?}"); // [20, 40, 60]
}
```

Read it right-to-left: iterate, keep evens, times ten, collect into a Vec. No loops, no
mutation, and the whole thing is *lazy* — nothing runs until `.collect()` pulls.

::: callout type="contrast" lang="python"
**For the Pythonista.** `.filter(...)` maps to Python's `filter(lambda ...)`, `.map` to a
*comprehension expression*, `.collect()` to `list(...)`. Closures are `|x| x * 10` —
Python lambdas' prouder, leaner cousin (no `lambda` keyword).
:::

::: exercise id="iter-basics" kind="code" concepts="iterators" difficulty="2" check="exact:12" hints="Run it: the chain sums every number, giving 10, so the odd ones need dropping first|Add a `.filter(...)` before `.sum()` whose closure keeps only the evens, testing `*n % 2 == 0`|Then add a `.map(...)` between the filter and the sum whose closure returns `n * 2`"
This chain sums *all* the numbers, so it prints `10`. Extend it into one lazy chain (no
`for` loops, no manual accumulator): `.filter()` the even numbers, `.map()` each to double
it, then `.sum()`. Evens are 2 and 4; doubled they're 4 and 8; total = **12**.

```rust
fn main() {
    let nums = vec![1, 2, 3, 4];
    // TODO: add .filter(...) and .map(...) before .sum()
    let total: i32 = nums.iter().sum();
    println!("{total}");
}
```

<solution>
```rust
fn main() {
    let nums = vec![1, 2, 3, 4];
    let total: i32 = nums.iter().filter(|n| *n % 2 == 0).map(|n| n * 2).sum();
    println!("{total}");
}
```
:::


::: exercise id="iter-basics" kind="code" level="+" concepts="iterators,collections" difficulty="3" check="exact:borrow=2 rust=3 trait=1" hints="`fold` takes a starting value, here `BTreeMap::new()`, and a closure that receives the accumulator and one item and returns the new accumulator|Make the accumulator parameter `mut m`, bump the count with `*m.entry(w.to_lowercase()).or_insert(0) += 1`, then return `m` as the closure's last expression|The whole thing is `words.iter().fold(BTreeMap::new(), ...)` where the closure takes `mut m` and `w`"
A twist on the pipeline: instead of a number, fold into a **collection**. Count how often
each word appears, case-insensitively, using one `.fold(...)` into a `BTreeMap` (no `for`
loop). The `BTreeMap` keeps the keys sorted, and the print line is already written.
Expected output: `borrow=2 rust=3 trait=1`.

```rust
use std::collections::BTreeMap;

fn main() {
    let words = vec!["Rust", "borrow", "rust", "Trait", "borrow", "RUST"];
    // TODO: one fold that counts lowercase words into a BTreeMap
    let counts: BTreeMap<String, usize> = todo!();
    let line: Vec<String> = counts.iter().map(|(w, n)| format!("{w}={n}")).collect();
    println!("{}", line.join(" "));
}
```

<solution>
```rust
use std::collections::BTreeMap;

fn main() {
    let words = vec!["Rust", "borrow", "rust", "Trait", "borrow", "RUST"];
    let counts: BTreeMap<String, usize> = words.iter().fold(BTreeMap::new(), |mut m, w| {
        *m.entry(w.to_lowercase()).or_insert(0) += 1;
        m
    });
    let line: Vec<String> = counts.iter().map(|(w, n)| format!("{w}={n}")).collect();
    println!("{}", line.join(" "));
}
```
:::

::: exercise id="iter-basics" kind="code" level="++" concepts="iterators,collections" difficulty="4" check="exact:pinned: agents/main@a1b2c3d,skills/tests@b2c3d4e missing: mcp/fs,prompts/sys" hints="`filter_map` keeps only the entries whose hash is `Some`: its closure can return `h.map(...)` to turn `Some(hash)` into `Some((name, hash))`|Collect the pairs into a `Vec`, call `.sort()` on it (tuples sort by their first field), then `map` each pair to `format!(...)` with `&h[..7]`|For `missing`, `filter` on `h.is_none()` and `map` each entry to its name, keeping the input order"
A lockfile writer sees messy input: entries arrive unsorted, and some have no hash yet
because they were never pulled. From `entries`, build two lists with iterator chains:

- `pinned`: every entry **with** a hash, sorted by name, written `name@` plus the first
  7 characters of the hash
- `missing`: the names **without** a hash, in their original order

Expected output: `pinned: agents/main@a1b2c3d,skills/tests@b2c3d4e missing: mcp/fs,prompts/sys`.

```rust
fn main() {
    let entries: Vec<(&str, Option<&str>)> = vec![
        ("skills/tests", Some("b2c3d4e5f6")),
        ("mcp/fs", None),
        ("agents/main", Some("a1b2c3d4e5")),
        ("prompts/sys", None),
    ];
    // TODO: pins with a hash, sorted by name, hash cut to 7 chars
    let pinned: Vec<String> = todo!();
    // TODO: names without a hash, input order
    let missing: Vec<&str> = todo!();
    println!("pinned: {} missing: {}", pinned.join(","), missing.join(","));
}
```

<solution>
```rust
fn main() {
    let entries: Vec<(&str, Option<&str>)> = vec![
        ("skills/tests", Some("b2c3d4e5f6")),
        ("mcp/fs", None),
        ("agents/main", Some("a1b2c3d4e5")),
        ("prompts/sys", None),
    ];
    let mut pins: Vec<(&str, &str)> = entries.iter().filter_map(|(n, h)| h.map(|h| (*n, h))).collect();
    pins.sort();
    let pinned: Vec<String> = pins.iter().map(|(n, h)| format!("{n}@{}", &h[..7])).collect();
    let missing: Vec<&str> = entries.iter().filter(|(_, h)| h.is_none()).map(|(n, _)| *n).collect();
    println!("pinned: {} missing: {}", pinned.join(","), missing.join(","));
}
```
:::

::: exercise id="iter-basics" kind="code" level="+++" concepts="iterators,collections,expression" difficulty="5" check="exact:agents/main=a1,skills/tests=b2 / err: line 3 has no =" hints="`.lines().enumerate()` gives you the 0-based index, so the line number is `i + 1`. Filter out blank and comment lines after enumerating, so the numbers stay true|An iterator of `Result<(String, String), String>` can `collect()` straight into `Result<BTreeMap<String, String>, String>`, and it stops at the first `Err`"
**Spec only.** Write `parse(text: &str) -> Result<BTreeMap<String, String>, String>`
for a tiny lock format, with no `for` loops:

- trim each line, and skip blank lines and lines starting with `#`
- every other line is `name = hash`, split at the first `=`, with both sides trimmed
- a line without `=` fails the whole parse with `line N has no =`, where N is its
  1-based line number in the original text

Then print the good file as `name=hash` pairs joined with `,` (in sorted order), a ` / `,
and the bad file's error prefixed with `err: `. Expected output:
`agents/main=a1,skills/tests=b2 / err: line 3 has no =`.

```rust
const GOOD: &str = "# harness.lock\nskills/tests = b2\n\nagents/main = a1\n";
const BAD: &str = "agents/main = a1\n# ok so far\nskills/tests b2\n";

fn main() {
    todo!("write parse(), then print GOOD and BAD on one line")
}
```

<solution>
```rust
use std::collections::BTreeMap;

const GOOD: &str = "# harness.lock\nskills/tests = b2\n\nagents/main = a1\n";
const BAD: &str = "agents/main = a1\n# ok so far\nskills/tests b2\n";

fn parse(text: &str) -> Result<BTreeMap<String, String>, String> {
    text.lines()
        .enumerate()
        .map(|(i, l)| (i + 1, l.trim()))
        .filter(|(_, l)| !l.is_empty() && !l.starts_with('#'))
        .map(|(n, l)| match l.split_once('=') {
            Some((k, v)) => Ok((k.trim().to_string(), v.trim().to_string())),
            None => Err(format!("line {n} has no =")),
        })
        .collect()
}

fn show(r: Result<BTreeMap<String, String>, String>) -> String {
    match r {
        Ok(m) => m.iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join(","),
        Err(e) => format!("err: {e}"),
    }
}

fn main() {
    println!("{} / {}", show(parse(GOOD)), show(parse(BAD)));
}
```
:::

> The exercise above is intentionally awkward — the *goal* text and the *expected* output
> must line up. When authoring, keep the check value and the starter code consistent. The
> harness grades on real stdout.

## Closures: capturing, not just lambdas

Closures can **capture** variables from their surroundings (like Python's closures or JS
arrows):

```rust
fn main() {
    let factor = 3;
    let scaled: Vec<i32> = vec![1,2,3].iter().map(|n| n * factor).collect();
    println!("{scaled:?}"); // [3, 6, 9]
}
```

## Splunk it: hash.rs's sorted() through a new lens

Remember hlock's `sorted()` — the recursive canonical-sorting function? Here it is, and
notice it's basically mapping over an enum's variants:

```rust
fn sorted(v: &serde_json::Value) -> serde_json::Value {
    match v {
        serde_json::Value::Object(map) => {
            let mut out = serde_json::Map::new();
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for k in keys {
                out.insert(k.clone(), sorted(&map[k]));
            }
            serde_json::Value::Object(out)
        }
        serde_json::Value::Array(items) =>
            serde_json::Value::Array(items.iter().map(sorted).collect()),
        other => other.clone(),
    }
}
```

Two iterator moves to notice as a Splunker:
- `map.keys().collect()` gathers keys into a `Vec` so we can `sort()` them.
- `items.iter().map(sorted).collect()` — **`.map(sorted)`** passes the function *by
  name*! A function is a first-class value; `.map` calls it on each element and
  `collect()` reassembles the array.

::: exercise id="func-by-name" kind="code" concepts="iterators,expression" difficulty="3" check="exact:[1, 4, 9]" hints="Start from `vec![1, 2, 3].iter()` to get an iterator over `&i32`|`.map()` accepts a function directly, so you don't need a closure|Write `vec![1, 2, 3].iter().map(square).collect()` and the `Vec<i32>` annotation tells `collect` what to build"
Replace the `todo!()` with `vec![1,2,3].iter().map(square).collect()`, passing `square`
*by name* like hlock's `.map(sorted)`. It should print `[1, 4, 9]` (the `{:?}` print is
already there).

```rust
fn square(n: &i32) -> i32 { n * n }

fn main() {
    // TODO: iterate over vec![1, 2, 3], map square by name, and collect
    let squares: Vec<i32> = todo!();
    println!("{squares:?}");
}
```

<solution>
```rust
fn square(n: &i32) -> i32 { n * n }

fn main() {
    let squares: Vec<i32> = vec![1, 2, 3].iter().map(square).collect();
    println!("{squares:?}");
}
```
:::


::: exercise id="func-by-name" kind="code" level="+" concepts="iterators,expression" difficulty="4" check="exact:[7, 9, 8] max=9" hints="`files.iter()` yields `&&str`, and `String::from` has no impl for that, so add `.copied()` before `.map(String::from)`|Methods are functions too: `String::len` takes `&String`, which is exactly what `owned.iter()` yields|`lens.iter().max()` returns an `Option<&usize>`, so match it with a `Some(n)` arm giving `*n` and a `None` arm giving `0`"
No closures this time. Pass **paths** to `.map` by name, the way hlock passes `sorted`:

1. `owned`: map `String::from` over `files` to get a `Vec<String>`.
2. `lens`: map `String::len` over `owned`.
3. `longest`: a `match` *expression* on `lens.iter().max()`, giving `0` for an empty list.

Expected output: `[7, 9, 8] max=9`.

```rust
fn main() {
    let files = ["hash.rs", "worker.rs", "error.rs"];
    // TODO: no closures: map String::from by name
    let owned: Vec<String> = todo!();
    // TODO: no closures: map String::len by name
    let lens: Vec<usize> = todo!();
    // TODO: a match expression on lens.iter().max()
    let longest: usize = todo!();
    println!("{lens:?} max={longest}");
}
```

<solution>
```rust
fn main() {
    let files = ["hash.rs", "worker.rs", "error.rs"];
    let owned: Vec<String> = files.iter().copied().map(String::from).collect();
    let lens: Vec<usize> = owned.iter().map(String::len).collect();
    let longest: usize = match lens.iter().max() {
        Some(n) => *n,
        None => 0,
    };
    println!("{lens:?} max={longest}");
}
```
:::

::: exercise id="func-by-name" kind="code" level="++" concepts="iterators,expression,collections" difficulty="4" check="exact:{a:[{x:1,y:2},3],b:hi}" hints="Follow hash.rs: one `match v` with an `Object` arm, an `Array` arm and an `other => other.clone()` arm|In the `Object` arm, map each pair to `(k.clone(), sorted(v))`, collect into a `Vec`, then sort it by key with `sort_by` comparing `a.0` to `b.0`|The `Array` arm is the hlock line almost word for word: `Value::Array(items.iter().map(sorted).collect())`"
This is hlock's `hash.rs` `sorted()` with `serde_json` swapped for a small homemade
`Value`. Here `Object` keeps pairs in **insertion order** (a `Vec`), so sorting the keys
is your job. Write `sorted` recursively: objects get their keys sorted and every value
sorted, arrays keep their order but sort each element via `.map(sorted)`, and everything
else is cloned. `render` is given. Expected output: `{a:[{x:1,y:2},3],b:hi}`.

```rust
#[derive(Debug, Clone)]
enum Value {
    Num(i64),
    Str(String),
    Array(Vec<Value>),
    Object(Vec<(String, Value)>), // insertion order, like unsorted JSON
}

fn sorted(v: &Value) -> Value {
    todo!("Object: sort keys and recurse. Array: map sorted. Else: clone")
}

fn render(v: &Value) -> String {
    match v {
        Value::Num(n) => n.to_string(),
        Value::Str(s) => s.clone(),
        Value::Array(items) => format!("[{}]", items.iter().map(render).collect::<Vec<_>>().join(",")),
        Value::Object(pairs) => {
            let parts: Vec<String> = pairs.iter().map(|(k, v)| format!("{k}:{}", render(v))).collect();
            format!("{{{}}}", parts.join(","))
        }
    }
}

fn main() {
    let inner = Value::Object(vec![
        (String::from("y"), Value::Num(2)),
        (String::from("x"), Value::Num(1)),
    ]);
    let doc = Value::Object(vec![
        (String::from("b"), Value::Str(String::from("hi"))),
        (String::from("a"), Value::Array(vec![inner, Value::Num(3)])),
    ]);
    println!("{}", render(&sorted(&doc)));
}
```

<solution>
```rust
#[derive(Debug, Clone)]
enum Value {
    Num(i64),
    Str(String),
    Array(Vec<Value>),
    Object(Vec<(String, Value)>),
}

fn sorted(v: &Value) -> Value {
    match v {
        Value::Object(pairs) => {
            let mut out: Vec<(String, Value)> = pairs.iter().map(|(k, v)| (k.clone(), sorted(v))).collect();
            out.sort_by(|a, b| a.0.cmp(&b.0));
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.iter().map(sorted).collect()),
        other => other.clone(),
    }
}

fn render(v: &Value) -> String {
    match v {
        Value::Num(n) => n.to_string(),
        Value::Str(s) => s.clone(),
        Value::Array(items) => format!("[{}]", items.iter().map(render).collect::<Vec<_>>().join(",")),
        Value::Object(pairs) => {
            let parts: Vec<String> = pairs.iter().map(|(k, v)| format!("{k}:{}", render(v))).collect();
            format!("{{{}}}", parts.join(","))
        }
    }
}

fn main() {
    let inner = Value::Object(vec![
        (String::from("y"), Value::Num(2)),
        (String::from("x"), Value::Num(1)),
    ]);
    let doc = Value::Object(vec![
        (String::from("b"), Value::Str(String::from("hi"))),
        (String::from("a"), Value::Array(vec![inner, Value::Num(3)])),
    ]);
    println!("{}", render(&sorted(&doc)));
}
```
:::

::: exercise id="func-by-name" kind="code" level="+++" concepts="iterators,expression,collections" difficulty="5" check="exact:{a:[{x:1,y:2}],b:hi} d5723b2b6fe77937 same=true" hints="Design an enum with `Num`, `Str`, `Array` and `Object` variants and write one recursive function that returns the canonical string, sorting object keys as it goes|FNV-1a is a single `fold` over `s.bytes()`: start from the offset basis, XOR in each byte as `u64`, then `wrapping_mul` by the prime. Print with the `016x` format"
**Spec only.** Build the core of a content hash from scratch:

1. Design a `Value` type for nested data: numbers, strings, arrays and objects.
2. Write a canonical encoder. Objects become `{k:v,...}` with keys **sorted**, arrays
   become `[a,b,...]` in order, numbers print in decimal and strings print raw (no quotes).
3. Hash the canonical string with 64-bit **FNV-1a**: start at `0xcbf29ce484222325`; for
   each byte, XOR it in, then `wrapping_mul` by `0x100000001b3`.
4. Build the same document twice with keys in different orders,
   `{b: "hi", a: [{y: 2, x: 1}]}` and `{a: [{x: 1, y: 2}], b: "hi"}`, and print the first
   one's canonical form, its hash as 16 lowercase hex digits, and whether both hashes match.

Expected output: `{a:[{x:1,y:2}],b:hi} d5723b2b6fe77937 same=true`.

```rust
fn main() {
    todo!("design Value, canonicalize, FNV-1a hash, compare")
}
```

<solution>
```rust
enum Value {
    Num(i64),
    Str(String),
    Array(Vec<Value>),
    Object(Vec<(String, Value)>),
}

fn canon(v: &Value) -> String {
    match v {
        Value::Num(n) => n.to_string(),
        Value::Str(s) => s.clone(),
        Value::Array(items) => format!("[{}]", items.iter().map(canon).collect::<Vec<_>>().join(",")),
        Value::Object(pairs) => {
            let mut keyed: Vec<&(String, Value)> = pairs.iter().collect();
            keyed.sort_by(|a, b| a.0.cmp(&b.0));
            let parts: Vec<String> = keyed.iter().map(|(k, v)| format!("{k}:{}", canon(v))).collect();
            format!("{{{}}}", parts.join(","))
        }
    }
}

fn fnv1a(s: &str) -> u64 {
    s.bytes().fold(0xcbf29ce484222325u64, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3))
}

fn obj(pairs: Vec<(&str, Value)>) -> Value {
    Value::Object(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
}

fn main() {
    let one = obj(vec![
        ("b", Value::Str(String::from("hi"))),
        ("a", Value::Array(vec![obj(vec![("y", Value::Num(2)), ("x", Value::Num(1))])])),
    ]);
    let two = obj(vec![
        ("a", Value::Array(vec![obj(vec![("x", Value::Num(1)), ("y", Value::Num(2))])])),
        ("b", Value::Str(String::from("hi"))),
    ]);
    let (c1, c2) = (canon(&one), canon(&two));
    println!("{c1} {:016x} same={}", fnv1a(&c1), fnv1a(&c1) == fnv1a(&c2));
}
```
:::

## Wrap-up check

::: exercise id="iter-quiz" kind="mcq" concepts="iterators" difficulty="1" options=".filter()|.collect()|.iter()|.new()" answer="2" explain="`.iter()` borrows the `Vec` and gives you an iterator over `&T`. Adapters like `.filter()` and consumers like `.collect()` are then chained onto that iterator."
To turn a `Vec<T>` into an iterator, which method do you call first?
:::


::: exercise id="iter-quiz" kind="mcq" level="+" concepts="iterators" difficulty="2" options="Only done, because map is lazy and nothing ever consumes it|saw 1, saw 2, saw 3, then done|done, then saw 1, saw 2, saw 3|Nothing: it fails to compile because doubled is never used" answer="0" explain="Iterator adapters like `.map` only build a description of the work. The closure runs when a consumer such as `.collect()`, `.sum()` or a `for` loop pulls items. Here nothing pulls, so only `done` prints (rustc warns that `doubled` is unused, which is a warning, not an error)."
What does this program print?

```rust
fn main() {
    let v = vec![1, 2, 3];
    let doubled = v.iter().map(|n| {
        println!("saw {n}");
        n * 2
    });
    println!("done");
}
```
:::

::: exercise id="iter-quiz" kind="mcq" level="++" concepts="iterators,collections" difficulty="3" options="A compile error: the for loop called into_iter() and moved pins|It prints a1, b2, then 2|It prints a1, b2, then 0, because the loop drained the Vec|It panics at runtime with a use-after-move" answer="0" explain="`for p in pins` desugars to `IntoIterator::into_iter(pins)`, which takes the `Vec` by value and hands out owned `String`s. After the loop `pins` has been moved, so `pins.len()` is E0382 (borrow of moved value). Write `for p in &pins` (which calls `.iter()`) to keep the Vec."
hlock walks its pins all the time. What happens here?

```rust
fn main() {
    let pins = vec![String::from("a1"), String::from("b2")];
    for p in pins {
        println!("{p}");
    }
    println!("{}", pins.len());
}
```
:::

::: only level="++"
**Splunker's notes.** `collect()` is driven entirely by the type you ask for. The same
chain can build a `Vec`, a `BTreeMap`, a `String`, or a `Result<Vec<_>, E>` that stops
at the first error, which is how a parser can bail out without a loop. And `.map(sorted)`
only works because `sorted` takes `&Value` and `.iter()` yields `&Value`. If the types
don't line up exactly, reach for `.copied()`, `.cloned()` or a closure.
:::
