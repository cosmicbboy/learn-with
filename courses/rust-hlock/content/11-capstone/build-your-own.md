---
title: "Capstone — build your own mini-hlock"
concepts: [structs, enums, iterators, result_option, error_handling, traits, expression]
objectives:
  - Compose every concept to build a tiny harness.lock reader from scratch
---

## The mission

You've Splunked the real hlock: structs and derives, `Option`/`Result`, enums and
`match`, iterators, traits, and errors. Now put it all together. You're going to build a
**mini-hlock**: a small program that reads a fictional `harness.lock` (a `BTreeMap` of
skill names → level) and reports on it — the same job the read path of real hlock does,
scaled to fit a quiz.

Work through the checkpoints in order. Each one is a small exercise; combine your
answers into the final program in the last exercise. The harness grades each step's real
output.

### Checkpoint 1 — model it with a struct

::: exercise id="cap-model" kind="code" concepts="structs" difficulty="2" check="contains:rust"
Define `Skill` with `name: String` and `level: u8`, plus `#[derive(Debug, Clone)]`, and
print it with `{:?}` in `main`.

```rust
#[derive(Debug, Clone)]
struct Skill {
    name: String,
    level: u8,
}

fn main() {
    let s = Skill { name: String::from("rust"), level: 3 };
    println!("{:?}", s);
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
    let s = Skill { name: String::from("rust"), level: 3 };
    println!("{:?}", s);
}
```
:::

### Checkpoint 2 — a Result-based look-up

::: exercise id="cap-lookup" kind="code" concepts="result_option,error_handling" difficulty="3" check="exact:found level 3"
Write `find` that looks up `level` by `name` in a `&Vec<Skill>` and returns
`Option<u8>`, then print `found level 3`.

```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

fn find<'a>(skills: &'a [Skill], name: &str) -> Option<u8> {
    skills.iter().find(|s| s.name == name).map(|s| s.level)
}

fn main() {
    let skills = vec![
        Skill { name: String::from("rust"), level: 3 },
        Skill { name: String::from("py"), level: 4 },
    ];
    let lvl = find(&skills, "rust").unwrap();
    println!("found level {lvl}");
}
```

<solution>
```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

fn find<'a>(skills: &'a [Skill], name: &str) -> Option<u8> {
    skills.iter().find(|s| s.name == name).map(|s| s.level)
}

fn main() {
    let skills = vec![
        Skill { name: String::from("rust"), level: 3 },
        Skill { name: String::from("py"), level: 4 },
    ];
    let lvl = find(&skills, "rust").unwrap();
    println!("found level {lvl}");
}
```
:::

### Checkpoint 3 — report with iterators

::: exercise id="cap-report" kind="code" concepts="iterators,expression" difficulty="3" check="contains:rust:3"
Build a `&str` report of `name: level` lines joined by `\n`, using iterator `.map` +
`.collect::<Vec<_>>().join("\n")`, and print it.

```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

fn report(skills: &[Skill]) -> String {
    skills.iter().map(|s| format!("{}:{}", s.name, s.level)).collect::<Vec<_>>().join("\n")
}

fn main() {
    let skills = vec![
        Skill { name: String::from("rust"), level: 3 },
        Skill { name: String::from("py"), level: 4 },
    ];
    println!("{}", report(&skills));
}
```

<solution>
```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

fn report(skills: &[Skill]) -> String {
    skills.iter().map(|s| format!("{}:{}", s.name, s.level)).collect::<Vec<_>>().join("\n")
}

fn main() {
    let skills = vec![
        Skill { name: String::from("rust"), level: 3 },
        Skill { name: String::from("py"), level: 4 },
    ];
    println!("{}", report(&skills));
}
```
:::

## The final build: pull it together

Now the grand finale — open-ended. Combine the pieces and add a `Display` impl so you can
`println!("{skill}")`.

::: exercise id="cap-final" kind="code" concepts="traits,enums,result_option" difficulty="4" check="contains:Skill(rust, lvl 3)"
Add a `Display` impl for `Skill` so `println!("{s}")` prints `Skill(rust, lvl 3)`, then
print the first skill.

```rust
use std::fmt;

#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

impl fmt::Display for Skill {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Skill({}, lvl {})", self.name, self.level)
    }
}

fn main() {
    let s = Skill { name: String::from("rust"), level: 3 };
    println!("{s}");
}
```

<solution>
```rust
use std::fmt;

#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

impl fmt::Display for Skill {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Skill({}, lvl {})", self.name, self.level)
    }
}

fn main() {
    let s = Skill { name: String::from("rust"), level: 3 };
    println!("{s}");
}
```
:::

## You did it.

You Splunked a real production Rust codebase and rebuilt a slice of it from scratch.
You've met structs, derives, enums, match, iterators, traits, errors, `?`, ownership,
borrowing, threads, and tests — the shape of Rust. From here, `cargo build` on real hlock
is just putting the same pieces on a bigger table.

**Next steps with real hlock:**
```bash
git clone https://github.com/unionai-oss/hlock.git
cd hlock && cargo build          # builds all 4 crates
cargo test -p harness-lock-core  # run the real test suite you studied
```

Then pick a file you understand (`hash.rs`, `error.rs`, a piece of `manifest.rs`) and
change it. That's the Splunker's graduation.

> **Review this capstone's concepts** via the concept map on Home — the adaptive engine
> tracked them, and anything you missed will resurface there for spaced practice.
