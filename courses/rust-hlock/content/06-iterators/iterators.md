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

::: exercise id="iter-basics" kind="code" concepts="iterators" difficulty="2" check="exact:12"
Build one lazy chain — no `for` loops, no manual accumulator. `.filter()` the even
numbers from `[1,2,3,4]`, `.map()` each to double it, then `.sum()` the result.
Evens are 2 and 4; doubled they're 4 and 8; total = **12**.

```rust
fn main() {
    let nums = vec![1, 2, 3, 4];
    let total: i32 = nums.iter().filter(|n| *n % 2 == 0).map(|n| n * 2).sum();
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

::: exercise id="func-by-name" kind="code" concepts="iterators,expression" difficulty="3" check="exact:[1, 4, 9]"
Use `vec![1,2,3].iter().map(square).collect()` — pass `square` *by name* like hlock's
`.map(sorted)` — so it prints `[1, 4, 9]`. Print with `{:?}`.

```rust
fn square(n: &i32) -> i32 { n * n }

fn main() {
    let squares: Vec<i32> = vec![1, 2, 3].iter().map(square).collect();
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

## Wrap-up check

::: exercise id="iter-quiz" kind="mcq" concepts="iterators" difficulty="1" options=".filter()|.collect()|.iter()|.new()" answer="2"
To turn a `Vec<T>` into an iterator, which method do you call first?
:::
