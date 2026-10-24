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

::: exercise id="struct-derives" kind="code" concepts="structs,derives" difficulty="2" check="contains:borrowing" hints="Run it: rustc says `Skill` doesn't implement `Debug` (and then `Clone`)|Derives go on the line directly above the `struct` keyword|Add `#[derive(Debug, Clone)]` right above `struct Skill`"
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

::: exercise id="struct-derives" kind="code" level="+" concepts="structs,derives" difficulty="3" check="exact:Budget { max_spend_usd: None, max_trials: Some(50), random_seed: 7 } same=false" hints="Write `main` first, then let rustc tell you which traits are missing: one for `..Default::default()`, one for `.clone()`, one for `==`|`Budget { max_trials: Some(50), ..Default::default() }` fills every other field, and `Budget { random_seed: 7, ..base.clone() }` copies the rest from `base`|The derive line is `#[derive(Debug, Clone, Default, PartialEq)]`, and the print is `println!` with the template `{:?} same={}` and the arguments `tweaked, base == tweaked`"
A trimmed-down `Budget`. Nothing in `main` is written yet, and the derive line is
incomplete on purpose. Build `base` with `max_trials: Some(50)` and every other field at its
default, using **struct update syntax** (`..`). Build `tweaked` as a copy of `base` with
`random_seed: 7`. Print `tweaked` with `{:?}`, followed by whether `base == tweaked`. Derive
exactly what that needs. Expected output:
`Budget { max_spend_usd: None, max_trials: Some(50), random_seed: 7 } same=false`.

```rust
#[derive(Debug)] // TODO: derive everything main ends up needing
struct Budget {
    max_spend_usd: Option<f64>,
    max_trials: Option<usize>,
    random_seed: u64,
}

fn main() {
    // TODO: base = max_trials Some(50), everything else Default (use ..)
    // TODO: tweaked = base, but random_seed 7 (use .. again, without moving base)
    // TODO: one println! with the template {:?} same={}
    todo!()
}
```

<solution>
```rust
#[derive(Debug, Clone, Default, PartialEq)]
struct Budget {
    max_spend_usd: Option<f64>,
    max_trials: Option<usize>,
    random_seed: u64,
}

fn main() {
    let base = Budget { max_trials: Some(50), ..Default::default() };
    let tweaked = Budget { random_seed: 7, ..base.clone() };
    println!("{:?} same={}", tweaked, base == tweaked);
}
```
:::

::: exercise id="struct-derives" kind="code" level="++" concepts="structs,derives,result_option" difficulty="4" check="exact:strategy=random trials=100 spend=unlimited seed=0 / strategy=grid trials=20 spend=$5.00 seed=0" hints="`#[derive(Default)]` gives `strategy: String::new()`, which is an empty string and not a missing value, so `describe` has to treat empty as random|Use `unwrap_or(100)` for the trials and a `match` on `max_spend_usd` with `Some(usd)` formatted as `${usd:.2}` and `None` as unlimited|`main` needs `Budget::default()`, then `Budget { max_spend_usd: Some(5.0), max_trials: Some(20), strategy: String::from(...), ..defaults.clone() }`, so derive `Clone` and `Default`"
This is the real field list of hlock's `Budget` (the serde attributes are gone because we
have no serde here). Real messiness: `strategy` is a plain `String`, not an `Option`, so
an all-default `Budget` has `strategy` set to the empty string rather than "absent". Implement `describe` with these rules:
an empty strategy reads `random`, missing `max_trials` reads `100`, missing `max_spend_usd`
reads `unlimited`, and a present one is formatted with two decimals after a `$`. Then write
`main`: `defaults` is `Budget::default()`, and `tuned` is `defaults` with spend `5.0`,
trials `20` and strategy `grid`. Print `defaults.describe()` and `tuned.describe()` on one
line, separated by ` / `. Fix the derive line as needed. Expected output:
`strategy=random trials=100 spend=unlimited seed=0 / strategy=grid trials=20 spend=$5.00 seed=0`.

```rust
#[derive(Debug)] // TODO: what does main need?
pub struct Budget {
    pub max_spend_usd: Option<f64>,
    pub max_trials: Option<usize>,
    pub strategy: String,
    pub random_seed: u64,
}

impl Budget {
    fn describe(&self) -> String {
        todo!("strategy=... trials=... spend=... seed=...")
    }
}

fn main() {
    // TODO: defaults, tuned (struct update syntax), one println! joined by  /
    todo!()
}
```

<solution>
```rust
#[derive(Debug, Clone, Default)]
pub struct Budget {
    pub max_spend_usd: Option<f64>,
    pub max_trials: Option<usize>,
    pub strategy: String,
    pub random_seed: u64,
}

impl Budget {
    fn describe(&self) -> String {
        let strategy = if self.strategy.is_empty() { "random" } else { self.strategy.as_str() };
        let trials = self.max_trials.unwrap_or(100);
        let spend = match self.max_spend_usd {
            Some(usd) => format!("${usd:.2}"),
            None => String::from("unlimited"),
        };
        format!("strategy={strategy} trials={trials} spend={spend} seed={}", self.random_seed)
    }
}

fn main() {
    let defaults = Budget::default();
    let tuned = Budget {
        max_spend_usd: Some(5.0),
        max_trials: Some(20),
        strategy: String::from("grid"),
        ..defaults.clone()
    };
    println!("{} / {}", defaults.describe(), tuned.describe());
}
```
:::

::: exercise id="budget-eq" kind="mcq" level="++" concepts="derives" difficulty="4" options="f64 is PartialEq but not Eq because NaN != NaN, so Option of f64 can't be Eq and neither can Budget|Option fields can never be compared with ==, so any struct holding one can't derive equality|Eq can only be derived together with Ord, so you'd need PartialOrd and Ord too|Serialize and Deserialize already implement equality, so the extra derives conflict with them" answer="0" explain="A derive generates an impl that requires every field to implement the same trait. `Option<T>` is `Eq` only when `T` is `Eq`, and `f64` isn't, because `NaN == NaN` is false and that breaks reflexivity. So `PartialEq` alone compiles, but adding `Eq` fails on `max_spend_usd`. Equality and ordering are independent, and serde's traits have nothing to do with `==`."
You want tests to compare budgets with `assert_eq!`, so you add two derives to hlock's
`Budget`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub struct Budget {
    #[serde(alias = "max_spend_usd")]
    pub max_spend_usd: Option<f64>,
    pub max_trials: Option<usize>,
    pub strategy: String,
    pub random_seed: u64,
}
```
`PartialEq` is fine, but `Eq` makes the derive fail to compile. Why?
:::

::: exercise id="kebab-keys" kind="code" level="+" concepts="serde,result_option" difficulty="3" check="exact:max-spend-usd max-trials strategy random-seed / max_trials max_spend_usd ?" hints="`to_kebab` is a single string method that swaps every `_` for a `-`|In `field_for`, check the alias first, then search `FIELDS` for the field whose kebab form equals `key`. `iter().copied().find(...)` returns an `Option`|The alias check is `if key == ALIAS { return Some(ALIAS); }`, and the search compares `to_kebab(f) == key`. `max_trials` has no alias, so it must give `None`"
`#[serde(rename_all = "kebab-case")]` is why the TOML key is `max-trials` while the Rust field
is `max_trials`. `#[serde(alias = "max_spend_usd")]` lets *one* field also accept its
snake_case spelling. Do serde's job by hand. `to_kebab` maps a field name to its TOML key.
`field_for` maps a TOML key back to the field, accepting the kebab key for every field and the
alias only for `max_spend_usd`. Expected output:
`max-spend-usd max-trials strategy random-seed / max_trials max_spend_usd ?`.

```rust
const FIELDS: [&str; 4] = ["max_spend_usd", "max_trials", "strategy", "random_seed"];
const ALIAS: &str = "max_spend_usd"; // only this field has an alias

fn to_kebab(field: &str) -> String {
    todo!("rename_all = kebab-case")
}

fn field_for(key: &str) -> Option<&'static str> {
    todo!("kebab key for any field, or the one alias")
}

fn main() {
    let keys: Vec<String> = FIELDS.iter().map(|f| to_kebab(f)).collect();
    let back: Vec<&str> = ["max-trials", "max_spend_usd", "max_trials"]
        .iter()
        .map(|k| field_for(k).unwrap_or("?"))
        .collect();
    println!("{} / {}", keys.join(" "), back.join(" "));
}
```

<solution>
```rust
const FIELDS: [&str; 4] = ["max_spend_usd", "max_trials", "strategy", "random_seed"];
const ALIAS: &str = "max_spend_usd"; // only this field has an alias

fn to_kebab(field: &str) -> String {
    field.replace('_', "-")
}

fn field_for(key: &str) -> Option<&'static str> {
    if key == ALIAS {
        return Some(ALIAS);
    }
    FIELDS.iter().copied().find(|f| to_kebab(f) == key)
}

fn main() {
    let keys: Vec<String> = FIELDS.iter().map(|f| to_kebab(f)).collect();
    let back: Vec<&str> = ["max-trials", "max_spend_usd", "max_trials"]
        .iter()
        .map(|k| field_for(k).unwrap_or("?"))
        .collect();
    println!("{} / {}", keys.join(" "), back.join(" "));
}
```
:::

::: exercise id="parse-budget" kind="code" level="++" concepts="serde,result_option,structs" difficulty="4" check="exact:grid Some(2.5) None 7 / error: unknown field max-trails / error: max-trials: invalid digit found in string" hints="Loop over `src.lines()`, trim each line, skip blank lines and `#` comments, then `split_once('=')` and trim both halves|`match key` with one arm per TOML key, and write `max-spend-usd` and its alias `max_spend_usd` together in one arm as an or-pattern. Parse numbers with `value.parse()`, and use `map_err` plus `?` to turn the parse error into the `key: message` form|The catch-all arm is `other => return Err(format!(...))` with the text unknown field and the key. Start from `Budget::default()` so absent keys stay `None` or zero"
Write `parse_budget`, a hand-rolled version of what `#[derive(Deserialize)]` plus
`rename_all = "kebab-case"` and the `max_spend_usd` alias do for hlock's `Budget`. Input is
`key = value` lines. Skip blank lines and lines that start with `#`. Accept `max-spend-usd`
or `max_spend_usd`, `max-trials`, `strategy` and `random-seed`. Missing keys keep their
default. Errors are `Err(String)`. An unknown key gives `unknown field <key>` (serde's real
message adds the list of expected fields). A number that won't parse gives
`<key>: <the parse error's message>`. Expected output:
`grid Some(2.5) None 7 / error: unknown field max-trails / error: max-trials: invalid digit found in string`.

```rust
#[derive(Debug, Default)]
pub struct Budget {
    pub max_spend_usd: Option<f64>,
    pub max_trials: Option<usize>,
    pub strategy: String,
    pub random_seed: u64,
}

fn parse_budget(src: &str) -> Result<Budget, String> {
    todo!("Deserialize by hand")
}

fn show(src: &str) -> String {
    match parse_budget(src) {
        Ok(b) => format!("{} {:?} {:?} {}", b.strategy, b.max_spend_usd, b.max_trials, b.random_seed),
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let good = "# [budget]\nstrategy = grid\nmax_spend_usd = 2.5\n\nrandom-seed = 7";
    let typo = "strategy = grid\nmax-trails = 3";
    let bad_num = "max-trials = lots";
    println!("{} / {} / {}", show(good), show(typo), show(bad_num));
}
```

<solution>
```rust
#[derive(Debug, Default)]
pub struct Budget {
    pub max_spend_usd: Option<f64>,
    pub max_trials: Option<usize>,
    pub strategy: String,
    pub random_seed: u64,
}

fn parse_budget(src: &str) -> Result<Budget, String> {
    let mut b = Budget::default();
    for line in src.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = line
            .split_once('=')
            .ok_or_else(|| format!("expected key = value, got {line}"))?;
        let (key, value) = (key.trim(), value.trim());
        match key {
            "max-spend-usd" | "max_spend_usd" => {
                b.max_spend_usd = Some(value.parse().map_err(|e| format!("{key}: {e}"))?)
            }
            "max-trials" => b.max_trials = Some(value.parse().map_err(|e| format!("{key}: {e}"))?),
            "strategy" => b.strategy = value.to_string(),
            "random-seed" => b.random_seed = value.parse().map_err(|e| format!("{key}: {e}"))?,
            other => return Err(format!("unknown field {other}")),
        }
    }
    Ok(b)
}

fn show(src: &str) -> String {
    match parse_budget(src) {
        Ok(b) => format!("{} {:?} {:?} {}", b.strategy, b.max_spend_usd, b.max_trials, b.random_seed),
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let good = "# [budget]\nstrategy = grid\nmax_spend_usd = 2.5\n\nrandom-seed = 7";
    let typo = "strategy = grid\nmax-trails = 3";
    let bad_num = "max-trials = lots";
    println!("{} / {} / {}", show(good), show(typo), show(bad_num));
}
```
:::

::: exercise id="budget-from-scratch" kind="code" level="+++" concepts="structs,derives,serde,result_option" difficulty="5" check="exact:max-spend-usd = 3; strategy = grid; random-seed = 0 / roundtrip=true / error: max-trials must be positive" hints="Design first: a `Budget` struct with the four hlock fields, deriving `Debug`, `Clone`, `Default` and `PartialEq` (you'll compare two parse results), plus `parse` returning `Result` and `to_toml` returning `String`|Serialize in field order and skip `None` fields, as `skip_serializing_if` would. Display an `f64` with plain `{}` so `3.0` prints as `3` and parses back to the same value. Apply the `random` default for strategy *after* the parse loop, and only if it is still empty"
**Spec only.** Round-trip a `Budget` through text, doing serde's job in both directions.

- Design `Budget` with hlock's fields (`max_spend_usd: Option<f64>`,
  `max_trials: Option<usize>`, `strategy: String`, `random_seed: u64`) and derive whatever
  your code needs.
- `parse(src: &str) -> Result<Budget, String>`: `key = value` lines with kebab-case keys,
  plus the `max_spend_usd` alias. Skip blank lines. A missing strategy defaults to `random`,
  and a missing seed is `0`. `max-trials = 0` is an error: `max-trials must be positive`. An
  unknown key is an error too: `unknown field <key>`.
- `to_toml(&self) -> String`: one `key = value` line per field, in field order, kebab-case
  keys, **skipping fields that are `None`**, joined with newlines.
- In `main`, parse `A`, print its `to_toml()` with the newlines shown as `; `, then print
  `roundtrip=<bool>`, where the bool says whether parsing that TOML again gives an equal
  `Budget`. Finally print `B`'s error. Separate the three parts with ` / `.

Expected output:
`max-spend-usd = 3; strategy = grid; random-seed = 0 / roundtrip=true / error: max-trials must be positive`.

```rust
const A: &str = "max_spend_usd = 3\nstrategy = grid";
const B: &str = "max-trials = 0";

fn main() {
    todo!("design Budget, parse, to_toml, then print the three parts")
}
```

<solution>
```rust
const A: &str = "max_spend_usd = 3\nstrategy = grid";
const B: &str = "max-trials = 0";

#[derive(Debug, Clone, Default, PartialEq)]
struct Budget {
    max_spend_usd: Option<f64>,
    max_trials: Option<usize>,
    strategy: String,
    random_seed: u64,
}

fn num<T: std::str::FromStr>(key: &str, value: &str) -> Result<T, String>
where
    T::Err: std::fmt::Display,
{
    value.parse().map_err(|e| format!("{key}: {e}"))
}

impl Budget {
    fn parse(src: &str) -> Result<Budget, String> {
        let mut b = Budget::default();
        for line in src.lines().map(str::trim).filter(|l| !l.is_empty()) {
            let (key, value) = line.split_once('=').ok_or_else(|| format!("bad line {line}"))?;
            let (key, value) = (key.trim(), value.trim());
            match key {
                "max-spend-usd" | "max_spend_usd" => b.max_spend_usd = Some(num(key, value)?),
                "max-trials" => {
                    let n: usize = num(key, value)?;
                    if n == 0 {
                        return Err(String::from("max-trials must be positive"));
                    }
                    b.max_trials = Some(n);
                }
                "strategy" => b.strategy = value.to_string(),
                "random-seed" => b.random_seed = num(key, value)?,
                other => return Err(format!("unknown field {other}")),
            }
        }
        if b.strategy.is_empty() {
            b.strategy = String::from("random");
        }
        Ok(b)
    }

    fn to_toml(&self) -> String {
        let mut lines = Vec::new();
        if let Some(usd) = self.max_spend_usd {
            lines.push(format!("max-spend-usd = {usd}"));
        }
        if let Some(n) = self.max_trials {
            lines.push(format!("max-trials = {n}"));
        }
        lines.push(format!("strategy = {}", self.strategy));
        lines.push(format!("random-seed = {}", self.random_seed));
        lines.join("\n")
    }
}

fn main() {
    let a = Budget::parse(A).expect("A parses");
    let toml = a.to_toml();
    let roundtrip = Budget::parse(&toml) == Ok(a.clone());
    let b_err = Budget::parse(B).unwrap_err();
    println!("{} / roundtrip={} / error: {}", toml.replace('\n', "; "), roundtrip, b_err);
}
```
:::


::: only level="++"
**Splunker's notes: what serde's attributes actually do.** `#[derive(Serialize,
Deserialize)]` generates a visitor that matches incoming keys against a table of field
names. `rename_all = "kebab-case"` rewrites that table at compile time, and `alias` adds
extra accepted keys for one field (deserialize only, since serialization always writes the
renamed key). An `Option` field that is missing becomes `None` without any extra attribute.
A non-`Option` field that is missing is an error unless the field or struct has
`#[serde(default)]`, and that is one reason config structs like `Budget` also derive
`Default`. To read the code a derive writes, run `cargo expand` (from the `cargo-expand`
crate) on a small crate. It's the best way to stop treating derives as magic.
:::

## What the compiler won't let you skip

Because `Budget.max_spend_usd` is `Option<f64>`, hlock has to consciously decide what to
do when it's `None`. You, reading that code, get an *enforced honesty*: every place a
field is read, the author had to say what "missing" means. That's `Option` doing its job.

::: exercise id="option-quiz" kind="mcq" concepts="result_option" difficulty="2" options="Some(value)|None|Ok(value)|Err(error)" answer="0" explain="`Option<T>` is either `Some(value)` when a value is present or `None` when it is absent. Since there is a trial count to report, the function returns `Some(count)`. `Ok` and `Err` belong to `Result`."
A function returns `Option<i32>` for "how many trials have run." What value does it
return when trials are still running (a number *is* present)?
:::

::: exercise id="option-quiz" kind="mcq" level="+" concepts="result_option" difficulty="3" options="10, 10, 6|10, 0, 6|None, 0, 6|10, then a panic, then 6" answer="0" explain="`filter` turns `Some(0)` into `None` because `0 > 0` is false, `map` does nothing to a `None`, and `unwrap_or(10)` supplies the fallback. So both `None` and `Some(0)` become `10`, and `Some(3)` becomes `Some(6)` and then `6`. Nothing panics, because no step unwraps without a fallback."
Suppose you want `max-trials = 0` in `harness.toml` to mean the same as leaving the key
out. Here is one way to write that:

```rust
fn trial_cap(max_trials: Option<usize>) -> usize {
    max_trials.filter(|n| *n > 0).map(|n| n * 2).unwrap_or(10)
}
```
What do `trial_cap(None)`, `trial_cap(Some(0))` and `trial_cap(Some(3))` return, in order?
:::

> The quiz above used a concept `option-ish`; in the course model every concept gets a
> badge. Rust's real term is `Option` — shorthand that Splunkers use too.
