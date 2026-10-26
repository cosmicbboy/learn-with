---
title: First blood — compile something real
concepts: [expression, string_vs_str]
objectives:
  - See a real compiler error and decode its anatomy
  - Use format strings with the {} placeholder
---

## Reading a compiler error like a Splunker

Rust errors look scary until you learn their anatomy. Here's a taste from real life —
every hlock contributor reads these daily. A typical one:

```text
error[E0382]: borrow of moved value: `s`
 --> src/main.rs:4:18
  |
4 |     println!("{s}");
  |                  ^ value borrowed here after move
```

The **third piece** is the gold: `error[E0382]` is the error *code*, and googling exactly
that code (`rustc E0382`) is how you learn Rust faster than reading docs. The line/column
tells you exactly where. Treat these codes as a map, not a wall.

::: callout type="challenge"
**Rust's errors are long on purpose.** The compiler is trying to teach you the *why*,
not just the *where*. Slow down and actually read the help block to the end — it often
spells out the fix, quote by quote.
:::

## Format strings: `{}` and the borrowed-value trap

You already know f-strings and template literals. Rust has the same idea: `println!`
takes a template and interpolates values with curly braces.

```rust
fn main() {
    let tool = "hlock";
    println!("made with {tool} and rust");
    println!("also positional: {} {}", "first", "second");
}
```

::: callout type="contrast" lang="javascript"
**For the JSer.** `print(f"{tool}")` / `${tool}` became `println!("{tool}")`. No `f`
prefix, no `$`. Subtle and important: in Rust the `{}` placeholder *knows how to display*
the value via the `Display` trait — even custom types can implement it (a whole lesson
later).
:::

Now let's make you actually hit a borrow error, because that's your Splunking destiny.

::: exercise id="moved-value" kind="code" concepts="ownership,expression" difficulty="2" check="contains:made for rust" hints="Read the error: it points at the line where `s` moved and the later line that still uses it|`let consumer = s;` hands ownership of the `String` to `consumer`, so `s` can't be used after that line|Either print `s` before the move, or write `let consumer = &s;` so `consumer` only borrows it"
This program won't compile — it's a `E0382 borrow of moved value`. Run it and read the
error. Then fix it by using a *reference* (`&s`) in place of the move, OR by reordering so
you print before the move. Either way it must print `made for rust`.

```rust
fn main() {
    let s = String::from("rust");
    let consumer = s;            // s is moved here
    println!("made for {s}");    // boom: s was moved
    println!("consumer says {consumer}");
}
```

<solution>
```rust
fn main() {
    let s = String::from("rust");
    println!("made for {s}");
    let consumer = s;
    println!("consumer says {consumer}");
}
```
:::

::: exercise id="moved-value" kind="code" level="+" concepts="ownership,string_vs_str" difficulty="3" check="exact:made for rust, loud: RUST" hints="Try the obvious `let loud = shout(s);` first and read the E0382 it causes: the move now happens at a function call|A function that only needs to *read* text can take `&str` and leave ownership with the caller|Change the parameter to `s: &str`, then call `shout(&s)`"
This time the move hides inside a function call. `shout` takes its argument *by value*, so
calling `shout(s)` hands `s` away and the final `println!` can't use it any more. Fix it
**without `.clone()`**: change `shout` so it only borrows, then fill in the `todo!()`.
Expected output: `made for rust, loud: RUST`.

```rust
fn shout(s: String) -> String {
    s.to_uppercase()
}

fn main() {
    let s = String::from("rust");
    // TODO: get a loud version of s from shout, and keep s usable on the next line
    let loud: String = todo!("call shout");
    println!("made for {s}, loud: {loud}");
}
```

<solution>
```rust
fn shout(s: &str) -> String {
    s.to_uppercase()
}

fn main() {
    let s = String::from("rust");
    let loud = shout(&s);
    println!("made for {s}, loud: {loud}");
}
```
:::

> That `String::from("rust")` is worth pausing on. `"rust"` is a *string literal* (a
> `&str`); `String` is an *owned, growable* string. `String::from(...)` converts one to
> the other. This `String` vs `&str` split has *no* exact Python analogue — it's the
> owned-vs-borrowed distinction that runs through all of Rust. We'll crack it properly in
> the ownership module.

## Statements vs expressions

Here's a founder-level Rust idea, visible as early as our little programs: in Rust,
everything is an **expression** that yields a value, and a function returns the last
expression *without* a `return` keyword:

::: exercise id="func-expression" kind="output" concepts="expression" difficulty="2" check="exact:12 42" hints="A function body's last expression, with no semicolon, is its return value|To double `n`, multiply it by 2|The body is just `n * 2`, with no `return` and no `;`"
Fill in the body so `double` returns `n` doubled, making `double(6)` give `12` and
`double(21)` give `42`. **Don't use `return`**: the last
expression (with no semicolon) is the return value. A `;` would turn the expression into
a *statement* that returns `()`, so leaving off the semicolon is the whole trick. Expected
output: `12 42`.

```rust
fn double(n: i32) -> i32 {
    todo!() // TODO: return n doubled, as the last expression with no semicolon
}

fn main() {
    println!("{} {}", double(6), double(21));
}
```

<solution>
```rust
fn double(n: i32) -> i32 {
    n * 2
}

fn main() {
    println!("{} {}", double(6), double(21));
}
```
:::

::: exercise id="func-expression" kind="output" level="+" concepts="expression" difficulty="3" check="exact:0 42 100" hints="`if` is an expression in Rust: each branch is a block whose last expression is its value|Chain `if n < 0 { ... } else if n > 100 { ... } else { ... }` as the whole function body, with no semicolons inside the branches|The three branch values are `0`, `100` and `n`"
Write `clamp_trials` so a trial count below 0 becomes `0`, one above 100 becomes `100`, and
anything else passes through. The rule: **no `return`, no `let`, and no `.clamp()`**. The
whole body is one `if` / `else if` / `else` expression. Expected output: `0 42 100`.

```rust
fn clamp_trials(n: i32) -> i32 {
    todo!() // TODO: one if/else-if/else expression, and it is the return value
}

fn main() {
    println!("{} {} {}", clamp_trials(-5), clamp_trials(42), clamp_trials(500));
}
```

<solution>
```rust
fn clamp_trials(n: i32) -> i32 {
    if n < 0 {
        0
    } else if n > 100 {
        100
    } else {
        n
    }
}

fn main() {
    println!("{} {} {}", clamp_trials(-5), clamp_trials(42), clamp_trials(500));
}
```
:::

::: callout type="contrast" lang="python"
**For the Pythonista.** You write `def double(n): return n * 2`. In Rust, the "implicit
return" is idiomatic. Watch that you don't slap a `;` after `n * 2` — that's the single
most common first-day bug (it changes the return type to `()` and the compiler scolds you
with a "mismatched types" error that's worth reading carefully).
:::

## Quick self-check

::: exercise id="expr-quiz" kind="mcq" concepts="expression" difficulty="1" options="The `;` makes `n + 1` a statement, so the body's value is `()`, not `i32`|Rust needs an explicit `return` keyword to send a value back|Adding 1 to `n` could overflow `i32`, so rustc refuses to compile it|`n` is an immutable parameter, so `n + 1` needs `let mut n`" answer="0" explain="The trailing `;` turns `n + 1` into a statement, so the body has no final expression and evaluates to `()`, which doesn't match the declared `i32`. rustc reports E0308 mismatched types and suggests removing the semicolon. No `return` is needed: a final expression without `;` is the return value. Overflow is checked when the program runs, not at compile time. And `n + 1` builds a new value without changing `n`, so `n` doesn't need `mut`."
```rust
fn inc(n: i32) -> i32 {
    n + 1;
}
```
Why does this function fail to compile?
:::

::: exercise id="expr-quiz" kind="mcq" level="+" concepts="expression" difficulty="2" options="() because the block's last line ends in a semicolon|6 because y * 2 is the last thing in the block|3 because y is the last binding in the block|Nothing: a block can't be assigned to a variable" answer="0" explain="A `{ ... }` block is an expression whose value is its final expression. Here the final line `y * 2;` ends in a semicolon, which makes it a statement, so the block evaluates to `()` and `x: ()`. Remove that semicolon and `x` would be `6`."
```rust
fn main() {
    let x = {
        let y = 3;
        y * 2;
    };
    println!("{:?}", x);
}
```
What is the value of `x`?
:::
