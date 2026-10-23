---
title: "Traits — shared behaviour with zero inheritance"
concepts: [traits, from_display, derives]
objectives:
  - Implement Display/Clone and write a generic function
  - Spot derive-vs-impl in hlock
---

## Traits are interfaces, not inheritance

A **trait** declares a set of methods a type must provide. Any type can implement any
trait — there's **no class hierarchy**. Python's ABCs and JS's interfaces/duck-typing are
the spirit; Rust makes it explicit and static.

You've already *used* traits constantly:
- `{:?}` needs `Debug`
- `println!("{x}")` needs `Display`
- `.clone()` needs `Clone`
- serde's `to_string` needs `Serialize`

hlock mixes two ways of giving a type a trait:
1. **`#[derive(...)]`** — the compiler writes it (best for mechanical traits like
   `Debug`, `Clone`, `PartialEq`).
2. **`impl Trait for Type { ... }`** — you write the behaviour (needed for `Display`,
   which is human-meaningful, and for `From`).

::: callout type="contrast" lang="python"
**For the Pythonista.** `trait Speak { fn speak(&self); }` ≈ an ABC with an abstract
method. `impl Speak for Dog` ≈ subclassing `Speak`. But there's no single root object;
unrelated types can each implement `Speak`. Composition over inheritance, taken far.
:::

## A generic function with a trait bound

Generics let a function work over *any* type that satisfies a trait bound. This is how
the standard library writes `.sum()`, `.sort()`, and how hlock's `Display`-based
printing works:

```rust
use std::fmt::Display;

fn announce<T: Display>(name: T) {
    println!("loading {name}");
}
```

`T: Display` means "any type `T` that can be displayed." Pass a `&str`, `String`, `i32`
— all work. This is Rust's version of Python's structural duck-typing, but checked at
compile time.

::: exercise id="generic-display" kind="code" concepts="traits" difficulty="3" check="contains:hlock"
Complete `announce<T: Display>` and call it with both a `&str` ("hlock") and an `i32`
(`7`). It should print `item: hlock` then `item: 7`. Change the call lines if needed so
`item: hlock` appears in the output.

```rust
use std::fmt::Display;

fn announce<T: Display>(name: T) -> String {
    format!("item: {name}")
}

fn main() {
    println!("{}", announce("hlock"));
    println!("{}", announce(7));
}
```

<solution>
```rust
use std::fmt::Display;

fn announce<T: Display>(name: T) -> String {
    format!("item: {name}")
}

fn main() {
    println!("{}", announce("hlock"));
    println!("{}", announce(7));
}
```
:::

## Implement Display yourself (again, for real traits)

Back in the errors module you wrote a `Display` impl by hand. Now generalize: `Display`
is *the* way to make a custom type pretty-printable with `{}`.

::: exercise id="impl-display" kind="code" concepts="traits,from_display" difficulty="3" check="exact:Version 0.5.0"
Add a `Display` impl for `Version` so `println!("{v}")` prints `Version 0.5.0`.

```rust
use std::fmt;

struct Version { major: u32, minor: u32, patch: u32 }

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Version {}.{}.{}", self.major, self.minor, self.patch)
    }
}

fn main() {
    let v = Version { major: 0, minor: 5, patch: 0 };
    println!("{v}");
}
```

<solution>
```rust
use std::fmt;

struct Version { major: u32, minor: u32, patch: u32 }

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Version {}.{}.{}", self.major, self.minor, self.patch)
    }
}

fn main() {
    let v = Version { major: 0, minor: 5, patch: 0 };
    println!("{v}");
}
```
:::

## Derive vs impl — when which?

- **Derive** when the behaviour is mechanical: `Debug`, `Clone`, `Copy`, `PartialEq`,
  `Default`, serde's `Serialize`/`Deserialize`.
- **Impl** when it's opinionated: `Display` (what should print?),
  `From` (what converts?), and the `Error` trait.

hlock's `Budget` *derives* most things but hand-`impl Default` because "a zero budget"
has strategy `"grid"` and seed `0` — a choice, not an accident.

::: exercise id="derive-quiz" kind="mcq" concepts="traits,derives" difficulty="2" options="Debug and Clone|Display and From|Both|Neither" answer="0"
Which pair would you normally get via `#[derive(...)]` rather than writing `impl`?
:::
