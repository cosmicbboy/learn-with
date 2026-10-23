---
title: "structs, derives, and the shape of harness.toml"
concepts: [structs, derives, serde]
objectives:
  - Read real serde structs from hlock and explain each derive
  - Define your own struct and derive Debug, Clone, Default
---

## A config tree made of structs

hlock's `harness.toml` is JSON-adjacent (TOML). It's loaded into **structs** in
`manifest.rs`. Here's the *real* `Budget` struct from that file — the config that says
how much an optimization search may spend:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub struct Budget {
    #[serde(alias = "max_spend_usd")]
    pub max_spend_usd: Option<f64>,
    pub max_trials: Option<usize>,
    pub strategy: String,
    pub random_seed: u64,
}
```

A `struct` is a named bundle of fields — think a Python `@dataclass` or a JS object with a
fixed shape. What makes Rust special is everything above the struct: **attributes** that
*derive* behaviour.

## Reading the derive line: what those five traits do

The line `#[derive(Debug, Clone, Serialize, Deserialize, Default)]` is Rust saying
"generate these implementations for me":

| trait | what you get | Python/JS analogue |
|---|---|---|
| `Debug` | pretty-print with `{:?}` | `repr` |
| `Clone` | `.clone()` makes an owned copy | `copy.deepcopy` |
| `Serialize` | to JSON/TOML | `json.dumps` |
| `Deserialize` | from JSON/TOML | `json.loads` / schema parsing |
| `Default` | a zero-ish default | a default constructor |

These are **traits** (interfaces) that the compiler implements *for* you. The `!` in
`println!`, `derive`, and `macro_rules!` are all macros; `#[derive(...)]` is a
*derived macro* — code that writes code.

::: callout type="contrast" lang="python"
**For the Pythonista.** `#[derive(Debug, Clone)]` ≈ `@dataclass` plus free
`__repr__` + `__deepcopy__`. But unlike Python's dynamic typing, Rust knows *exactly*
which behaviour a type has at compile time — you can't call `.clone()` on a type that
didn't opt in. That's stricter, and it's how Rust catches bugs before you run.
:::

## `Option<T>` — Rust's most honest type

Look at those fields again: `Option<f64>` and `Option<usize>`. That's Rust's way of
saying "this might be absent." It's how they represent the TOML keys being omitted.

An `Option<T>` is either `Some(value)` or `None` — and the compiler **forces** you to
handle both. If you try to use a possibly-absent value as if it were a number, Rust
refuses to compile. Python (`None`) and JS (`undefined`/`null`) let you forget; Rust
won't let you forget.

::: callout type="challenge"
`Option` is central to Splunking hlock. Everywhere a config key might be missing,
you'll meet `Option<T>` and have to unwrap it safely. We'll practice the safe ways
(`match`, `?`, `unwrap_or`) in the errors module.
:::

## Build your own struct

Let's make one that mirrors hlock's style — a struct describing a skill you'd lock in
`harness.lock`.

::: exercise id="struct-derives" kind="code" concepts="structs,derives" difficulty="2" check="contains:borrowing"
Define a `Skill` struct with fields `name: String` and `level: u8`, derive
`Debug` and `Clone`, and make it print in `main`.

```rust
// TODO: declare the struct with #[derive(Debug, Clone)]
struct Skill {
    name: String,
    level: u8,
}

fn main() {
    let s = Skill { name: String::from("borrowing"), level: 3 };
    println!("{:?}", s);      // Debug print
    let copy = s.clone();     // prove Clone works
    println!("{}", copy.name);
}
```

<solution>
```rust
#[derive(Debug, Clone)]
struct Skill {
    name: String,
    level: u8,
}

fn main() {
    let s = Skill { name: String::from("borrowing"), level: 3 };
    println!("{:?}", s);
    let copy = s.clone();
    println!("{}", copy.name);
}
```
:::

## What the compiler won't let you skip

Because `Budget.max_spend_usd` is `Option<f64>`, hlock has to consciously decide what to
do when it's `None`. You, reading that code, get an *enforced honesty*: every place a
field is read, the author had to say what "missing" means. That's `Option` doing its job.

::: exercise id="option-quiz" kind="mcq" concepts="result_option" difficulty="2" options="Some(value)|None|Ok(value)|Err(error)" answer="0"
A function returns `Option<i32>` for "how many trials have run." What value does it
return when trials are still running (a number *is* present)?
:::

> The quiz above used a concept `option-ish`; in the course model every concept gets a
> badge. Rust's real term is `Option` — shorthand that Splunkers use too.
