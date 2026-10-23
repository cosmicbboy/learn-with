---
title: "Crates, mods, and a tour of hlock's workspace"
concepts: [modules, expression]
objectives:
  - Navigate a multi-crate workspace and its feature flags
  - Use use/mod paths to pull in items
---

## The workspace map, decoded

You met the root `Cargo.toml` back in module 0. Let's read the parts that matter:

```toml
[workspace]
resolver = "2"
members = [
    "crates/harness-lock-core",   # the brains (manifest, lockfile, resolver, worker)
    "crates/harness-lock-py",     # PyO3 bindings -> the `hlock` PyPI package
    "crates/harness-lock",        # rust facade crate
    "crates/hlock",               # the published Rust CLI/lib entry point
]

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
thiserror = "2"
pyo3 = { version = "0.24", features = ["extension-module", "abi3-py39"] }

[workspace.lints.rust]
unsafe_code = "forbid"
```

- **`members`** lists each crate. `cargo build` at the root builds *all* of them.
- **`[workspace.dependencies]`** centralises shared dependency versions — like a
  monorepo's shared `devDependencies`, so every crate pins the *same* serde.
- `unsafe_code = "forbid"` is hlock telling the toolchain: no `unsafe` anywhere. That's
  a *lints* setting that becomes a compile error if you write `unsafe`. Nice to enforce
  in a safety-first project.

## Crates, modules, and paths

- A **crate** is a compilation unit (one library or binary).
- A **module** (`mod`) is a file or block inside a crate (≈ a Python module/file).
- `use` imports items — like `from x import y` or `import { y } from "x"`:

```rust
use std::collections::BTreeMap;   // bring BTreeMap into scope

fn main() {
    let mut m = BTreeMap::new();
    m.insert("a", 1);
    println!("{m:?}");
}
```

hlock's crates do `pub use harness_lock_core::*;` — re-exporting everything, so consumers
of the `hlock` crate get the whole API under one roof. Same idea as a Python package's
`__init__.py` re-exporting a module.

::: callout type="contrast" lang="python"
**For the Pythonista.** `use std::collections::BTreeMap` ≈
`from collections import ... something`. `pub use other_crate::*` ≈
`from .module import *` in your `__init__.py`.
:::

::: exercise id="use-paths" kind="code" concepts="modules,expression" difficulty="2" check="contains:9"
Write a `use` that brings `BTreeMap` into scope so the program compiles and prints a
sorted map (BTreeMaps print in sorted key order automatically).

```rust
use std::collections::BTreeMap;

fn main() {
    let mut m = BTreeMap::new();
    m.insert("z", 1);
    m.insert("a", 9);
    println!("{m:?}");
}
```

<solution>
```rust
use std::collections::BTreeMap;

fn main() {
    let mut m = BTreeMap::new();
    m.insert("z", 1);
    m.insert("a", 9);
    println!("{m:?}");
}
```
:::

## Feature flags

The `[features]` table toggles optional behaviour. hlock's `hlock` crate has:

```toml
[features]
default = []
flyte = ["harness-lock-core/flyte"]
```

`default = []` means by default nothing extra; `--features flyte` switches on the
optional Flyte backend (and *propagates* that feature to the core crate — `harness-lock-core/flyte`).
It's like an optional-dependency flag: `pip install hlock[flyte]`.

::: exercise id="workspace-quiz" kind="mcq" concepts="modules" difficulty="1" options="Modify each member crate's puzzle|Build or test all crates in the workspace|Only build the root crate|Create a new git repo" answer="1"
Running `cargo build` at the workspace root will…?
:::
