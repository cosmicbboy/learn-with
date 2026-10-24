---
title: Meet your quarry (and the toolchain)
concepts: [cargo, modules, expression]
objectives:
  - Explain what hlock is and how a Rust workspace is laid out
  - Map cargo's three verbs onto things you already know
---

## What we're Splunking

hlock is a **Rust workspace** that makes your *agent harness* portable. You know that
sinking feeling: you've tuned Claude Code, Codex, or Pi on one machine with the perfect
MCP servers, skills, and config — and then you want it on another. hlock pins all of that
into a `harness.lock` (like `package-lock.json` or `uv.lock`), lets you commit it, and
rehydrates it anywhere:

| You know this | hlock calls it |
|---|---|
| `package-lock.json` / `uv.lock` | `harness.lock` |
| `pip freeze` | `hlock pin` |
| `npm ci` / `uv sync` | `hlock sync` |
| `npx` / `uv run` | `hlock launch` |

It's written in Rust (🦀). Which means: to really understand and extend it, you want to
read and write Rust. That's the whole point of this course.

> **Splunker's rule.** You learn a concept by finding it in *real hlock source*, then
> you prove it with your own little program in the editor. Read the real thing, then
> run your own thing.

## How the codebase is shaped (a workspace)

Open hlock's root `Cargo.toml` and you'll see this — a **workspace** with four member
crates:

```toml
[workspace]
resolver = "2"
members = [
    "crates/harness-lock-core",
    "crates/harness-lock-py",
    "crates/harness-lock",
    "crates/hlock",
]
```

If you've used an npm or Python monorepo, this is familiar: multiple packages living in
one repo, sharing a lockfile and build. In Rust, the equivalent unit is a **crate**, and
a *workspace* is a set of crates built together.

::: callout type="contrast" lang="python"
**For the Pythonista.** A crate ≈ a Python *package* (+ a `pyproject.toml`-ish manifest).
A workspace ≈ a monorepo with several packages and one shared lock. The real star is
`crates/harness-lock-core` — it holds the brains: the manifest, lockfile, resolver, and
worker.
:::

## The three cargo verbs

`cargo` is to Rust what `pip`+`npm`+`make` are mashed into one tool. You'll live in three
of its commands:

```bash
cargo build   # compile (like make; or `tsc`, or `nvcc`)
cargo run     # build AND run the binary
cargo test    # run the test suite
```

One mental shift vs. Python: Rust **compiles before it runs**. There's no interactive
`python -i` where typos slide by — the compiler is strict and dramatic, and that's a
feature. Errors you learn here are the *main* thing you'll read while Splunking.

::: exercise id="workspace-verbs" kind="mcq" concepts="cargo" difficulty="1" options="`cargo run`|`cargo build`|`cargo check`|`cargo test`" answer="0" explain="`cargo run` compiles the crate if it needs to and then executes the binary, which is exactly build-then-execute. `cargo build` stops after compiling, leaving the binary in `target/` without running it. `cargo check` only type-checks and produces no binary at all. `cargo test` builds and runs the test suite, not the program."
Which command would you use, as a Splunker, to *build and then execute* hlock's CLI
binary on a new machine?
:::

::: exercise id="workspace-verbs" kind="mcq" level="+" concepts="cargo" difficulty="2" options="`cargo test -p harness-lock-core`|`cargo test harness-lock-core`|`cargo run --bin harness-lock-core`|`cd crates && cargo test`" answer="0" explain="In a workspace, `-p <crate>` (short for `--package`) picks one member crate, so only `harness-lock-core` is built and tested. `cargo test harness-lock-core` still builds and tests every member, because a bare argument filters test *names*, not crates. `cargo run --bin` picks a binary target and runs it, so no tests run at all. `crates/` has no `Cargo.toml` of its own, so cargo walks up to the workspace root and tests every member again."
You're working only on the brains of hlock and want to run the tests of the
`crates/harness-lock-core` member, and only that member, from the workspace root. Which command
does it?
:::

::: exercise id="workspace-count" kind="predict" concepts="modules" difficulty="1"
Each workspace member is a path like `crates/hlock`. Without running it, predict exactly
what this program prints — then paste it into any editor below to check yourself.

```rust
fn main() {
    let members = ["crates/harness-lock-core", "crates/harness-lock-py", "crates/harness-lock", "crates/hlock"];
    let python_facing = members.iter().filter(|m| m.ends_with("-py")).count();
    println!("{} members, {} for Python", members.len(), python_facing);
}
```

```text:expected
4 members, 1 for Python
```
:::

::: exercise id="workspace-count" kind="predict" level="+" concepts="modules" difficulty="2"
Same workspace, sneakier filter. Strip the `crates/` prefix, then keep the members whose
name *starts with* `harness-lock`. Predict exactly what this prints. Watch the prefix
closely, because it matches more than you might think.

```rust
fn main() {
    let members = ["crates/harness-lock-core", "crates/harness-lock-py", "crates/harness-lock", "crates/hlock"];
    let core: Vec<&str> = members
        .iter()
        .map(|m| m.trim_start_matches("crates/"))
        .filter(|m| m.starts_with("harness-lock"))
        .collect();
    println!("{} {}", core.len(), core[core.len() - 1]);
}
```

```text:expected
3 harness-lock
```
:::

## Your first Rust program — no, *your* first one

Don't just read prose. Paste this into the editor and **Run**. Change the greeting. Add a
second `println!`. The harness compiles it with real `rustc` and shows you the real
output or the real error.

::: exercise id="hello-hlock" kind="code" concepts="expression" difficulty="1" check="exact:hello from hlock" hints="The text inside the quotes of `println!` is exactly what gets printed|Replace `change me` with the new greeting, but keep the surrounding quotes and the `;`|The line should print the three words hello from hlock, all lowercase, with nothing else"
This starter runs, but it prints the wrong thing. Change the message inside `println!` so
the program prints exactly `hello from hlock` (all lowercase), then hit Run again to go
from red to green.

```rust
fn main() {
    // TODO: change the message so it reads: hello from hlock
    println!("change me");
}
```

<solution>
```rust
fn main() {
    println!("hello from hlock");
}
```
:::

::: exercise id="hello-hlock" kind="code" level="+" concepts="expression" difficulty="2" check="exact:hello from hlock (4 crates) / hello from pi (2 crates)" hints="`format!` takes the same template syntax as `println!` but returns a `String` instead of printing|Inline the tool name as `{tool}` and use an empty `{}` with `members.len()` as the argument after the template|The whole body is `format!(...)` with the template `hello from {tool} ({} crates)` and `members.len()`, and no semicolon"
No hard-coded greeting this time. Finish `greeting` with `format!`, taking the tool name from
`tool` and the crate count from `members.len()`. `main` calls it for two different workspaces,
so typing the `4` yourself won't work. Expected output:
`hello from hlock (4 crates) / hello from pi (2 crates)`.

```rust
fn greeting(tool: &str, members: &[&str]) -> String {
    // TODO: build the greeting from `tool` and `members.len()`
    todo!("format! the greeting")
}

fn main() {
    let members = ["crates/harness-lock-core", "crates/harness-lock-py", "crates/harness-lock", "crates/hlock"];
    println!("{} / {}", greeting("hlock", &members), greeting("pi", &members[..2]));
}
```

<solution>
```rust
fn greeting(tool: &str, members: &[&str]) -> String {
    format!("hello from {tool} ({} crates)", members.len())
}

fn main() {
    let members = ["crates/harness-lock-core", "crates/harness-lock-py", "crates/harness-lock", "crates/hlock"];
    println!("{} / {}", greeting("hlock", &members), greeting("pi", &members[..2]));
}
```
:::

Notice that `fn main()` is the entry point — just like `def main():` in Python or
`main` in most JS apps. And `println!` has a `!` because it's a *macro*, not a function
(more on that in the traits module). For now, read `!` as "this is a macro call."
