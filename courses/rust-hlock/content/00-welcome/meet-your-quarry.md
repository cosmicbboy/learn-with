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

::: exercise id="workspace-verbs" kind="mcq" concepts="cargo" difficulty="1" options="It compiles and runs the binary|It only checks types without running|It fetches dependencies|It runs the test suite" answer="0"
Which command would you use, as a Splunker, to *build and then execute* hlock's CLI
binary on a new machine?
:::

::: exercise id="workspace-count" kind="predict" concepts="modules" difficulty="1"
Point at the `[workspace]` block in hlock's root `Cargo.toml` above. Predict how many
member crates the workspace declares, then flip to the source on GitHub to verify.

```text:expected
4
```
:::

## Your first Rust program — no, *your* first one

Don't just read prose. Paste this into the editor and **Run**. Change the greeting. Add a
second `println!`. The harness compiles it with real `rustc` and shows you the real
output or the real error.

::: exercise id="hello-hlock" kind="code" concepts="expression" difficulty="1" check="contains:hello"
Modify the program so it prints a friendly `hello from hlock` message (keep it lowercase).
The harness checks that your output contains `hello`.

```rust
fn main() {
    println!("hello from hlock");
}
```

<solution>
```rust
fn main() {
    println!("hello from hlock");
}
```
:::

Notice that `fn main()` is the entry point — just like `def main():` in Python or
`main` in most JS apps. And `println!` has a `!` because it's a *macro*, not a function
(more on that in the traits module). For now, read `!` as "this is a macro call."
