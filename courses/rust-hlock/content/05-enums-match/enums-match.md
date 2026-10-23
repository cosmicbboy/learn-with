---
title: "Enums and match — your pattern-matching superpower"
concepts: [enums, pattern_matching]
objectives:
  - Match exhaustively and destructure values
  - Use Option/Result ergonomically with match and if-let
---

## match is a switch on steroids

You saw `match` back in the manifest module. Now let's make it a reflex. `match` in Rust
is *exhaustive*: every possible value must have an arm, and each arm can
**destructure** (pull fields out). Python's `match`+`case` borrowed this idea; Rust
came first and is stricter.

```rust
fn main() {
    let opt: Option<i32> = Some(10);
    match opt {
        Some(n) => println!("got {n}"),
        None => println!("nothing"),
    }
}
```

The arms bind `n` out of `Some(n)` — that's destructuring. You can bind, ignore with
`_`, and use guards (`if n > 5`).

::: callout type="contrast" lang="python"
**For the Pythonista.** Python's `match opt: case Some(n): ...` maps 1:1. But Rust *requires*
you to cover `None` (exhaustiveness). Forgetting an arm is a compile error — a feature
you'll come to love.
:::

## if-let: match's leaner cousin

When you only care about *one* arm, `if let` is cleaner than a full `match`:

```rust
if let Some(n) = opt {
    println!("got {n}");
} // ignore None implicitly
```

## A real enum with data

Enums can carry data, like hlock's `Error` variants do. Let's build a tiny "outcome":
`Ok(count)`, `Skipped`, `Failed(reason)`.

::: exercise id="enum-data" kind="code" concepts="enums,pattern_matching" difficulty="3" check="contains:processed 4"
Match on `Outcome` and print `processed 4` for the `Processed(count)` variant. Cover all
three arms — the compiler demands it.

```rust
enum Outcome {
    Processed(u32),
    Skipped,
    Failed(String),
}

fn main() {
    let o = Outcome::Processed(4);
    match o {
        Outcome::Processed(n) => println!("processed {n}"),
        Outcome::Skipped => println!("skipped"),
        Outcome::Failed(why) => println!("failed: {why}"),
    }
}
```

<solution>
```rust
enum Outcome {
    Processed(u32),
    Skipped,
    Failed(String),
}

fn main() {
    let o = Outcome::Processed(4);
    match o {
        Outcome::Processed(n) => println!("processed {n}"),
        Outcome::Skipped => println!("skipped"),
        Outcome::Failed(why) => println!("failed: {why}"),
    }
}
```
:::

## Exhaustiveness catches you

If you delete the `Outcome::Skipped` arm above, rustc complains: "non-exhaustive
patterns." That's the guardrail. Let's prove we appreciate it:

::: exercise id="exhaustive-quiz" kind="mcq" concepts="enums" difficulty="2" options="It refuses to compile until every variant has an arm|It silently returns ()|It only compiles in debug|It adds a catch-all automatically" answer="0"
If a `match` on an enum is missing a variant arm, what does rustc do?
:::

## Option/Result ergonomics with if-let

Splunkers melt this pattern into muscle memory:

```rust
fn describe_opt(o: Option<i32>) -> &'static str {
    match o {
        Some(0) => "zero",
        Some(n) if n < 100 => "small",
        Some(_) => "big",
        None => "nothing",
    }
}
```

::: exercise id="if-let-practice" kind="code" concepts="pattern_matching,result_option" difficulty="3" check="contains:That's great"
Complete the program: if `Res::Ok(42)` use `if let` to print `The value is 42. That's
great.` — use this pattern (`if let Ok(v) = ...`).

```rust
enum Res { Ok(i32), Err(String) }

fn main() {
    let r = Res::Ok(42);
    if let Res::Ok(v) = r {
        println!("The value is {v}. That's great.");
    } else {
        println!("It failed.");
    }
}
```

<solution>
```rust
enum Res { Ok(i32), Err(String) }

fn main() {
    let r = Res::Ok(42);
    if let Res::Ok(v) = r {
        println!("The value is {v}. That's great.");
    } else {
        println!("It failed.");
    }
}
```
:::
