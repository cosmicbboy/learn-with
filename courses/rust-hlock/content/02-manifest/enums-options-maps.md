---
title: "enums, Option, and maps — modeling a config tree"
concepts: [enums, collections, serde]
objectives:
  - Define an enum and know its alternatives
  - Use BTreeMap and Option the way hlock's manifest does
---

## Enums: a closed set of choices

An **enum** says "this value is *one* of a fixed list of alternatives." Unlike Python's
loose strings, Rust enums are exhaustive and type-safe. From hlock's manifest, the
harness candidates are one of several kinds — a perfect enum shape:

```rust
enum HarnessKind {
    Cli,
    Server,
    Library,
}
```

Splunkers meet three enums constantly: `Option` (`Some`/`None`), `Result`
(`Ok`/`Err`), and the many project-specific ones. Because they're *exhaustive*, a
`match` must cover every arm or the compiler complains — which means you can't forget a
case.

::: callout type="contrast" lang="python"
**For the Pythonista.** Python enums (or string constants) allow any string; a typo like
`"cli"` vs `"Cli"` is a runtime surprise. In Rust an unknown variant is a *compile-time
error*. Pain now, safety forever.
:::

## BTreeMap — a sorted, ordered map

hlock's `Objective` uses `BTreeMap<String, String>` for `constraints`. A `BTreeMap` is a
map like Python's `dict` or a JS `Map`, but **keeps keys in sorted order**, which makes
output deterministic (great for lockfiles that get committed to git!).

| | behavior |
|---|---|
| `HashMap<K,V>` | fast lookup, unordered (like a Python `dict`) |
| `BTreeMap<K,V>` | ordered by key (like a sorted dict) |

::: callout type="challenge"
Why does a lockfile writer care about ordering? A `HashMap` iterates in *arbitrary*
order per run, so hashing it would produce different bytes every time. hlock wants
cryptographically **deterministic** output for git — hence `BTreeMap` and the sorted
canonical-JSON code in `hash.rs`. Ordering bugs are a whole class of bug HashMaps hide.
:::

## `Option` inside maps: "key may be missing"

`BTreeMap::get` returns `Option<&V>` — it's `None` if the key isn't there. This is the
*only* way Rust lets you look something up, and it forces you to handle absence:

```rust
let mut m = std::collections::BTreeMap::new();
m.insert(String::from("select"), String::from("min-cost"));
match m.get("select") {
    Some(v) => println!("select = {v}"),
    None => println!("no select key"),
}
```

::: exercise id="map-lookup" kind="code" concepts="collections,result_option" difficulty="2" check="exact:found min-cost"
Fill in the `match` so the program prints `found min-cost` when the key exists. Use the
`Some`/`None` arms like above.

```rust
use std::collections::BTreeMap;

fn main() {
    let mut m = BTreeMap::new();
    m.insert(String::from("select"), String::from("min-cost"));
    match m.get("select") {
        Some(v) => println!("found {v}"),
        None => println!("missing"),
    }
}
```

<solution>
```rust
use std::collections::BTreeMap;

fn main() {
    let mut m = BTreeMap::new();
    m.insert(String::from("select"), String::from("min-cost"));
    match m.get("select") {
        Some(v) => println!("found {v}"),
        None => println!("missing"),
    }
}
```
:::

## Your turn: an enum for harness kinds

::: exercise id="enum-match-practice" kind="code" concepts="enums,pattern_matching" difficulty="2" check="exact:cli is local-first"
Declare an enum `HarnessKind` with `Cli`, `Server`, `Library` variants, and match on it
so it prints `cli is local-first`.

```rust
enum HarnessKind {
    Cli,
    Server,
    Library,
}

fn main() {
    let k = HarnessKind::Cli;
    let msg = match k {
        HarnessKind::Cli => "cli is local-first",
        HarnessKind::Server => "server is remote",
        HarnessKind::Library => "library is embeddable",
    };
    println!("{msg}");
}
```

<solution>
```rust
enum HarnessKind {
    Cli,
    Server,
    Library,
}

fn main() {
    let k = HarnessKind::Cli;
    let msg = match k {
        HarnessKind::Cli => "cli is local-first",
        HarnessKind::Server => "server is remote",
        HarnessKind::Library => "library is embeddable",
    };
    println!("{msg}");
}
```
:::

> Notice the `match` produced a *value* (`let msg = match ...`), and the last arm
> `Library` was required — remove it and the compiler refuses. Exhaustiveness is the
> feature.
