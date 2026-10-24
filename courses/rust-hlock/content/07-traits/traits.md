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

::: exercise id="generic-display" kind="code" concepts="traits" difficulty="3" check="contains:item: 7" hints="`T: Display` means anything you pass can be shown with `{}` in a format string|`format!` works like `println!` but returns the `String` instead of printing it|The body is `format!(...)` with the text `item: {name}`, and no semicolon"
Complete `announce<T: Display>` so it returns `item: ` followed by its argument. `main`
already calls it with a `&str` (`hlock`) and an `i32` (`7`), so the output should be
`item: hlock` then `item: 7`. One generic function, two types.

```rust
use std::fmt::Display;

fn announce<T: Display>(name: T) -> String {
    todo!() // TODO: return item: followed by name
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


::: exercise id="generic-display" kind="code" level="+" concepts="traits" difficulty="4" check="exact:3 items, max 9.5; 2 items, max worker; 0 items" hints="Comparing with `>` needs a second bound, so add `PartialOrd` to the where clause: `T: Display + PartialOrd`|`f64` is only `PartialOrd`, not `Ord`, so `.max()` won't work. `items.iter().reduce(...)` with a closure that keeps whichever of `a` and `b` is larger works for both types|`reduce` returns an `Option<&T>`, so match it: `Some(m)` formats `N items, max M` and `None` gives `0 items`"
One generic function, now with **two** bounds and an empty-input edge case. Complete
`summary` so it reports how many items there are and the largest one. You'll need to
add a bound to the `where` clause: `f64` can be compared but isn't `Ord`, so the bound
must be `PartialOrd`, and `Iterator::max` (which needs `Ord`) is off the table. An empty
slice prints `0 items`. Expected output: `3 items, max 9.5; 2 items, max worker; 0 items`.

```rust
use std::fmt::Display;

fn summary<T>(items: &[T]) -> String
where
    T: Display, // TODO: comparing items needs one more bound
{
    todo!()
}

fn main() {
    let a = summary(&[2.0, 9.5, 4.25]);
    let b = summary(&["hash", "worker"]);
    let c = summary::<i32>(&[]);
    println!("{a}; {b}; {c}");
}
```

<solution>
```rust
use std::fmt::Display;

fn summary<T>(items: &[T]) -> String
where
    T: Display + PartialOrd,
{
    match items.iter().reduce(|a, b| if b > a { b } else { a }) {
        Some(m) => format!("{} items, max {m}", items.len()),
        None => String::from("0 items"),
    }
}

fn main() {
    let a = summary(&[2.0, 9.5, 4.25]);
    let b = summary(&["hash", "worker"]);
    let c = summary::<i32>(&[]);
    println!("{a}; {b}; {c}");
}
```
:::

::: exercise id="generic-display" kind="code" level="++" concepts="traits" difficulty="4" check="exact:skills/tests@9f8e7d6,skills/lint@0a1b2c3 / mcp/fs@1a2b3c4,agents/main@abcdef0" hints="A default method can call the trait's other methods: `pin` is `format!(...)` of `self.name()` and the first 7 characters of `self.hash()`|For `McpServer`, `name` returns `format!(...)` of `mcp/` and the command, and `hash` returns `&self.version_hash`|Both list functions are `items.iter().map(...)` calling `.pin()` on each item, collected into a `Vec<String>` and joined with commas. The `Box<dyn Pinned>` version is written the same way"
A lockfile holds several *kinds* of thing: skills, MCP servers, agents. This exercise is
shaped like that: one `Pinned` trait, implemented by two unrelated structs. Fill in:

1. the **default method** `pin`, giving `name@` plus the first 7 characters of the hash,
   written once for every implementor;
2. `Pinned for McpServer`, where the name is `mcp/` plus the command;
3. `lock_line`, which is generic (static dispatch, one concrete type), and `mixed`, which
   takes `Box<dyn Pinned>` (dynamic dispatch, mixed types). Both join pins with `,`.

Expected output: `skills/tests@9f8e7d6,skills/lint@0a1b2c3 / mcp/fs@1a2b3c4,agents/main@abcdef0`.

```rust
trait Pinned {
    fn name(&self) -> String;
    fn hash(&self) -> &str;
    // default method: every implementor gets it for free
    fn pin(&self) -> String {
        todo!("name, an @, then the first 7 chars of the hash")
    }
}

struct Skill { path: String, sha: String }
struct McpServer { command: String, version_hash: String }

impl Pinned for Skill {
    fn name(&self) -> String { self.path.clone() }
    fn hash(&self) -> &str { &self.sha }
}

impl Pinned for McpServer {
    fn name(&self) -> String { todo!() }
    fn hash(&self) -> &str { todo!() }
}

fn lock_line<T: Pinned>(items: &[T]) -> String {
    todo!()
}

fn mixed(items: &[Box<dyn Pinned>]) -> String {
    todo!()
}

fn skill(path: &str, sha: &str) -> Skill {
    Skill { path: path.to_string(), sha: sha.to_string() }
}

fn main() {
    let skills = vec![skill("skills/tests", "9f8e7d6c5b"), skill("skills/lint", "0a1b2c3d4e")];
    let all: Vec<Box<dyn Pinned>> = vec![
        Box::new(McpServer { command: String::from("fs"), version_hash: String::from("1a2b3c4d5e") }),
        Box::new(skill("agents/main", "abcdef0123")),
    ];
    println!("{} / {}", lock_line(&skills), mixed(&all));
}
```

<solution>
```rust
trait Pinned {
    fn name(&self) -> String;
    fn hash(&self) -> &str;
    fn pin(&self) -> String {
        format!("{}@{}", self.name(), &self.hash()[..7])
    }
}

struct Skill { path: String, sha: String }
struct McpServer { command: String, version_hash: String }

impl Pinned for Skill {
    fn name(&self) -> String { self.path.clone() }
    fn hash(&self) -> &str { &self.sha }
}

impl Pinned for McpServer {
    fn name(&self) -> String { format!("mcp/{}", self.command) }
    fn hash(&self) -> &str { &self.version_hash }
}

fn lock_line<T: Pinned>(items: &[T]) -> String {
    items.iter().map(|i| i.pin()).collect::<Vec<_>>().join(",")
}

fn mixed(items: &[Box<dyn Pinned>]) -> String {
    items.iter().map(|i| i.pin()).collect::<Vec<_>>().join(",")
}

fn skill(path: &str, sha: &str) -> Skill {
    Skill { path: path.to_string(), sha: sha.to_string() }
}

fn main() {
    let skills = vec![skill("skills/tests", "9f8e7d6c5b"), skill("skills/lint", "0a1b2c3d4e")];
    let all: Vec<Box<dyn Pinned>> = vec![
        Box::new(McpServer { command: String::from("fs"), version_hash: String::from("1a2b3c4d5e") }),
        Box::new(skill("agents/main", "abcdef0123")),
    ];
    println!("{} / {}", lock_line(&skills), mixed(&all));
}
```
:::

::: exercise id="generic-display" kind="code" level="+++" concepts="traits,derives" difficulty="5" check="exact:Budget { max_trials: Some(3), strategy: Grid, random_seed: 0 } grid=[0, 10, 20] random=[9, 3, 6] same=true" hints="`#[derive(Default)]` works on an enum when one variant is marked `#[default]`. The struct needs a hand-written `impl Default` because its default trial count is `Some(3)`, not `None`|Struct update syntax builds the random budget: `Budget { strategy: Strategy::Random, random_seed: 42, ..b.clone() }`. Then `run` is `(0..n).map(...)` calling `s.next_trial()`, collected"
**Spec only.** Model a search budget like hlock's `Budget`, plus pluggable samplers.

1. `enum Strategy { Grid, Random }` deriving `Debug, Clone, Copy, PartialEq, Default`,
   with `Grid` as the default.
2. `struct Budget { max_trials: Option<usize>, strategy: Strategy, random_seed: u64 }`
   deriving `Debug, Clone, PartialEq`, with a **hand-written** `Default` of
   `Some(3)` trials, the default strategy and seed `0`.
3. `trait Sampler { fn next_trial(&mut self) -> u64; }` with two impls. `GridSampler`
   yields `0, 10, 20, ...`. `LcgSampler` starts from the seed and, on each call, sets
   `state = state * 6364136223846793005 + 1442695040888963407` (both wrapping) and
   returns `state >> 60`.
4. A generic `run<S: Sampler>(s: &mut S, n: usize) -> Vec<u64>`.

In `main`, print the default budget with `{:?}`, then `grid=` (a grid run for its
`max_trials`), `random=` (an LCG run for a copy of it with strategy `Random` and seed `42`),
and `same=` (whether the budget equals its own clone). Expected output:
`Budget { max_trials: Some(3), strategy: Grid, random_seed: 0 } grid=[0, 10, 20] random=[9, 3, 6] same=true`.

```rust
fn main() {
    todo!("Strategy, Budget, Sampler + two impls, run(), then one println")
}
```

<solution>
```rust
#[derive(Debug, Clone, Copy, PartialEq, Default)]
enum Strategy {
    #[default]
    Grid,
    Random,
}

#[derive(Debug, Clone, PartialEq)]
struct Budget {
    max_trials: Option<usize>,
    strategy: Strategy,
    random_seed: u64,
}

impl Default for Budget {
    fn default() -> Self {
        Budget { max_trials: Some(3), strategy: Strategy::default(), random_seed: 0 }
    }
}

trait Sampler {
    fn next_trial(&mut self) -> u64;
}

struct GridSampler { i: u64 }
struct LcgSampler { state: u64 }

impl Sampler for GridSampler {
    fn next_trial(&mut self) -> u64 {
        let v = self.i * 10;
        self.i += 1;
        v
    }
}

impl Sampler for LcgSampler {
    fn next_trial(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.state >> 60
    }
}

fn run<S: Sampler>(s: &mut S, n: usize) -> Vec<u64> {
    (0..n).map(|_| s.next_trial()).collect()
}

fn main() {
    let b = Budget::default();
    let r = Budget { strategy: Strategy::Random, random_seed: 42, ..b.clone() };
    let grid = run(&mut GridSampler { i: 0 }, b.max_trials.unwrap_or(1));
    let random = run(&mut LcgSampler { state: r.random_seed }, r.max_trials.unwrap_or(1));
    println!("{b:?} grid={grid:?} random={random:?} same={}", b == b.clone());
}
```
:::

## Implement Display yourself (again, for real traits)

Back in the errors module you wrote a `Display` impl by hand. Now generalize: `Display`
is *the* way to make a custom type pretty-printable with `{}`.

::: exercise id="impl-display" kind="code" concepts="traits,from_display" difficulty="3" check="exact:Version 0.5.0" hints="`fmt` writes into the formatter `f` and returns the `fmt::Result`|Use `write!(f, ...)` with three `{}` placeholders|The format string is `Version {}.{}.{}`, followed by `self.major, self.minor, self.patch`"
Fill in the `Display` impl for `Version`: replace the `todo!()` with a `write!` call so
`println!("{v}")` prints exactly `Version 0.5.0`.

```rust
use std::fmt;

struct Version { major: u32, minor: u32, patch: u32 }

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!() // TODO: write!(f, ...) the three numbers as Version 0.5.0
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


::: exercise id="impl-display" kind="code" level="+" concepts="traits,from_display" difficulty="4" check="exact:[     0.5.0] [0.6.0-rc.1]" hints="Optional data first: build the text in a `String` with `format!`, then `if let Some(p) = &self.pre` appends `-` and the pre-release|Run it after using `write!`: the `{:>10}` width is ignored, because `write!` doesn't apply the caller's padding|`f.pad(&s)` writes `s` while honouring width and alignment, so make it the last expression of `fmt`"
Two twists on `Version`. There's an optional pre-release (`0.6.0-rc.1`), and the caller
formats with a **width**: `{a:>10}`. A plain `write!` ignores the caller's width and
alignment, so the padding silently disappears. Make both work. Expected output:
`[     0.5.0] [0.6.0-rc.1]`.

```rust
use std::fmt;

struct Version { major: u32, minor: u32, patch: u32, pre: Option<String> }

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("build the text, add -pre if present, and respect the caller's width")
    }
}

fn main() {
    let a = Version { major: 0, minor: 5, patch: 0, pre: None };
    let b = Version { major: 0, minor: 6, patch: 0, pre: Some(String::from("rc.1")) };
    println!("[{a:>10}] [{b}]");
}
```

<solution>
```rust
use std::fmt;

struct Version { major: u32, minor: u32, patch: u32, pre: Option<String> }

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut s = format!("{}.{}.{}", self.major, self.minor, self.patch);
        if let Some(p) = &self.pre {
            s.push('-');
            s.push_str(p);
        }
        f.pad(&s)
    }
}

fn main() {
    let a = Version { major: 0, minor: 5, patch: 0, pre: None };
    let b = Version { major: 0, minor: 6, patch: 0, pre: Some(String::from("rc.1")) };
    println!("[{a:>10}] [{b}]");
}
```
:::

::: exercise id="impl-display" kind="code" level="++" concepts="from_display,traits" difficulty="4" check="exact:io error: harness.lock missing (source: harness.lock missing); manifest error: no [harness] table (source: none); agents/main: 404 (source: none)" hints="`Display` is one `match self` with `write!(f, ...)` per variant, using the same messages as hlock's `#[error(...)]` lines|`source` returns `Some(e)` for the `Io(e)` variant (the wrapped error is the cause) and `None` for the rest|`From` is just `Error::Io(e)`. That one impl is what lets the `?` in `read_lock` turn an `io::Error` into your `Error`"
Write by hand what `#[derive(thiserror::Error)]` generates for hlock's `error.rs`, for
three of its variants:

1. `Display` with hlock's messages: `manifest error: {0}`, `io error: {0}`, and plain `{0}`
   for `Pull`.
2. `std::error::Error` with `source()`, so callers can walk to the underlying `io::Error`
   (what `#[from]` sets up). Only `Io` has a source.
3. `From<io::Error>`, so the `?` in `read_lock` compiles into a conversion.

The `type Result<T>` alias is hlock's own. Expected output:
`io error: harness.lock missing (source: harness.lock missing); manifest error: no [harness] table (source: none); agents/main: 404 (source: none)`.

```rust
use std::{error, fmt, io};

#[derive(Debug)]
enum Error {
    Manifest(String),
    Io(io::Error),
    Pull(String),
}

type Result<T> = std::result::Result<T, Error>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("one write! per variant")
    }
}

impl error::Error for Error {
    fn source(&self) -> Option<&(dyn error::Error + 'static)> {
        todo!("only Io has an underlying cause")
    }
}

impl From<io::Error> for Error {
    fn from(e: io::Error) -> Self {
        todo!()
    }
}

fn open(present: bool) -> io::Result<String> {
    if present { Ok(String::from("[harness]")) } else { Err(io::Error::new(io::ErrorKind::NotFound, "harness.lock missing")) }
}

fn read_lock(present: bool) -> Result<String> {
    let text = open(present)?; // io::Error -> Error via From
    Ok(text)
}

fn main() {
    let errs = vec![
        read_lock(false).unwrap_err(),
        Error::Manifest(String::from("no [harness] table")),
        Error::Pull(String::from("agents/main: 404")),
    ];
    let out: Vec<String> = errs
        .iter()
        .map(|e| {
            let src = match error::Error::source(e) {
                Some(s) => s.to_string(),
                None => String::from("none"),
            };
            format!("{e} (source: {src})")
        })
        .collect();
    println!("{}", out.join("; "));
}
```

<solution>
```rust
use std::{error, fmt, io};

#[derive(Debug)]
enum Error {
    Manifest(String),
    Io(io::Error),
    Pull(String),
}

type Result<T> = std::result::Result<T, Error>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Manifest(m) => write!(f, "manifest error: {m}"),
            Error::Io(e) => write!(f, "io error: {e}"),
            Error::Pull(p) => write!(f, "{p}"),
        }
    }
}

impl error::Error for Error {
    fn source(&self) -> Option<&(dyn error::Error + 'static)> {
        match self {
            Error::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<io::Error> for Error {
    fn from(e: io::Error) -> Self {
        Error::Io(e)
    }
}

fn open(present: bool) -> io::Result<String> {
    if present { Ok(String::from("[harness]")) } else { Err(io::Error::new(io::ErrorKind::NotFound, "harness.lock missing")) }
}

fn read_lock(present: bool) -> Result<String> {
    let text = open(present)?;
    Ok(text)
}

fn main() {
    let errs = vec![
        read_lock(false).unwrap_err(),
        Error::Manifest(String::from("no [harness] table")),
        Error::Pull(String::from("agents/main: 404")),
    ];
    let out: Vec<String> = errs
        .iter()
        .map(|e| {
            let src = match error::Error::source(e) {
                Some(s) => s.to_string(),
                None => String::from("none"),
            };
            format!("{e} (source: {src})")
        })
        .collect();
    println!("{}", out.join("; "));
}
```
:::

::: exercise id="impl-display" kind="code" level="+++" concepts="traits,from_display,derives" difficulty="5" check="exact:0.5.0 < 0.5.1 < 0.10.0; rejected: bad, 1.2" hints="`#[derive(PartialOrd, Ord, PartialEq, Eq)]` compares fields top to bottom, so declaring `major, minor, patch` in that order gives numeric version ordering, unlike sorting the strings|Implement `std::str::FromStr` with `type Err = String`, then `s.parse::<Version>()` works. Split on `.`, require exactly three parts, and parse each as `u32`"
**Spec only.** Versions sort wrong as strings (`0.10.0` sorts before `0.5.0`). Build a
`Version` type that sorts right:

- three `u32` fields, **deriving** its ordering (no hand-written `cmp`)
- `FromStr`, accepting exactly `MAJOR.MINOR.PATCH`; anything else is an `Err`
- `Display`, printing `MAJOR.MINOR.PATCH`

Parse the inputs in `main`, sort the good ones and join them with ` < `, then list the
rejected inputs in their original order after `; rejected: `, joined with `, `. Expected
output: `0.5.0 < 0.5.1 < 0.10.0; rejected: bad, 1.2`.

```rust
fn main() {
    let inputs = ["0.10.0", "0.5.1", "bad", "0.5.0", "1.2"];
    todo!("Version with derived ordering, FromStr and Display, then print")
}
```

<solution>
```rust
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Version {
    major: u32,
    minor: u32,
    patch: u32,
}

impl FromStr for Version {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = s.split('.').collect();
        let bad = || format!("{s} (expected MAJOR.MINOR.PATCH)");
        if parts.len() != 3 {
            return Err(bad());
        }
        let n = |p: &str| p.parse::<u32>().map_err(|_| bad());
        Ok(Version { major: n(parts[0])?, minor: n(parts[1])?, patch: n(parts[2])? })
    }
}

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

fn main() {
    let inputs = ["0.10.0", "0.5.1", "bad", "0.5.0", "1.2"];
    let mut good: Vec<Version> = Vec::new();
    let mut rejected: Vec<&str> = Vec::new();
    for s in inputs {
        match s.parse::<Version>() {
            Ok(v) => good.push(v),
            Err(_) => rejected.push(s),
        }
    }
    good.sort();
    let sorted: Vec<String> = good.iter().map(|v| v.to_string()).collect();
    println!("{}; rejected: {}", sorted.join(" < "), rejected.join(", "));
}
```
:::

## Derive vs impl — when which?

- **Derive** when the behaviour is mechanical: `Debug`, `Clone`, `Copy`, `PartialEq`,
  `Default`, serde's `Serialize`/`Deserialize`.
- **Impl** when it's opinionated: `Display` (what should print?),
  `From` (what converts?), and the `Error` trait.

hlock's `Budget` derives `Default` too (see its `#[derive(...)]` in the manifest
lesson): each field's own default (`None`, `""`, `0`) is a fine starting budget.
Hand-write `impl Default` the moment a default is a *choice*, say a budget that should
start at three trials, because a derive can only produce each field's own default.

::: exercise id="derive-quiz" kind="mcq" concepts="traits,derives" difficulty="2" options="Debug and Clone|Display and From|Both|Neither" answer="0" explain="`Debug` and `Clone` have mechanical, field-by-field implementations, so `#[derive(Debug, Clone)]` writes them for you. `Display` is human-facing text and `From` is a conversion you design, so both are written as an `impl` by hand (or generated by a crate like thiserror)."
Which pair would you normally get via `#[derive(...)]` rather than writing `impl`?
:::


::: exercise id="derive-quiz" kind="mcq" level="+" concepts="derives,traits" difficulty="3" options="It fails to compile: Copy needs every field to be Copy, and String is not|It compiles, and copying Skill deep-copies the String|It compiles, but each copy shares the same String buffer|It compiles because Clone is derived too, which makes Copy safe" answer="0" explain="`Copy` means a plain bit-for-bit copy is a complete, safe duplicate. A `String` owns a heap buffer, so copying its bits would leave two owners of one allocation. `#[derive(Copy)]` therefore requires every field to be `Copy` and fails with E0204 here. `Clone` alone is fine, because `.clone()` allocates a new buffer."
What happens with this derive?

```rust
#[derive(Debug, Clone, Copy)]
struct Skill {
    name: String,
    level: u8,
}
```
:::

::: exercise id="derive-quiz" kind="mcq" level="++" concepts="derives" difficulty="3" options="It fails to compile: f64 implements neither Eq nor Hash, so neither can be derived|It compiles, because Option wraps the f64 and Option is Hash|It compiles, but hashing a NaN budget panics at runtime|Only Hash fails, because Eq is just a marker trait" answer="0" explain="Derives require every field to implement the trait. `f64` is `PartialEq` but not `Eq` (NaN is not equal to itself) and not `Hash`, and `Option<f64>` inherits those gaps. So E0277 fires for both. So a struct with an `f64` field, like `Budget`, can derive `PartialEq` at most, and can't be a `HashSet` member or `HashMap` key without a wrapper type."
You try to put hlock's `Budget` in a `HashSet`, so you extend its derive. What happens?

```rust
#[derive(Debug, Clone, Default, PartialEq, Eq, Hash)]
pub struct Budget {
    pub max_spend_usd: Option<f64>,
    pub max_trials: Option<usize>,
    pub strategy: String,
    pub random_seed: u64,
}
```
:::

::: only level="++"
**Splunker's notes.** A derive is a code generator with a rule: *every field must already
implement the trait*. Generic structs get a bound added too, so `#[derive(Clone)] struct
Pin<T>` is only `Clone` when `T: Clone`. When you need something the rule can't express,
like a non-zero default, ordering on one field only, or padding-aware `Display`, write the
`impl` yourself. That is exactly the split you see in hlock: derives on the data, and
hand-written impls where there's a decision to make.
:::
