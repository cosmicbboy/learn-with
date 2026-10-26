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
- `unsafe_code = "forbid"` is hlock telling the toolchain: no `unsafe`. It's a *lints*
  setting, and it turns any `unsafe` into a compile error in every member crate that opts
  in with `[lints] workspace = true` in its own `Cargo.toml`. Nice to enforce in a
  safety-first project.

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

::: exercise id="use-paths" kind="code" concepts="modules,expression" difficulty="2" check="exact:{1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80}" hints="Run it a few times: `HashMap` prints its keys in an arbitrary order|`BTreeMap` lives next to `HashMap` in the standard library's `collections` module and keeps keys sorted|Change the `use` line to `use std::collections::BTreeMap;` and make `m` a `BTreeMap::new()`"
This program uses a `HashMap`, which prints its entries in arbitrary order. Change the
`use` line so it brings `BTreeMap` into scope instead, and build `m` with
`BTreeMap::new()`. BTreeMaps print in sorted key order automatically, so the output is
exactly `{1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80}`.

```rust
use std::collections::HashMap; // TODO: bring BTreeMap into scope instead

fn main() {
    let mut m = HashMap::new(); // TODO: make this a BTreeMap
    for k in [5, 3, 8, 1, 7, 2, 6, 4] {
        m.insert(k, k * 10);
    }
    println!("{m:?}");
}
```

<solution>
```rust
use std::collections::BTreeMap;

fn main() {
    let mut m = BTreeMap::new();
    for k in [5, 3, 8, 1, 7, 2, 6, 4] {
        m.insert(k, k * 10);
    }
    println!("{m:?}");
}
```
:::


::: exercise id="use-paths" kind="code" level="+" concepts="modules,expression" difficulty="3" check="exact:lock: a=1,b=2 / lock: (empty)" hints="From inside `lockfile`, `super` is the parent module `harness_core`, so its sibling is `super::hash::canonical` (`crate::harness_core::hash::canonical` works too)|Make the body a single `if` expression: `if pairs.is_empty() { ... } else { ... }`, with no `return`|Both branches produce a `String`: `String::from(...)` for the empty case and `format!(...)` with `lock: ` plus the canonical text"
Modules now, not just `use`. `render` lives in `harness_core::lockfile` and has to call
its **sibling** module's `canonical`. Reach it with a relative `super::` path. Write the
body as a single `if` expression: an empty list gives `lock: (empty)`, and anything else
gives `lock: ` plus the canonical text. `main` only goes through the `hlock` facade, which
re-exports `render` the way hlock's crates use `pub use`. Expected output:
`lock: a=1,b=2 / lock: (empty)`.

```rust
mod harness_core {
    pub mod hash {
        pub fn canonical(pairs: &[(&str, u32)]) -> String {
            let mut v = pairs.to_vec();
            v.sort();
            v.iter().map(|(k, n)| format!("{k}={n}")).collect::<Vec<_>>().join(",")
        }
    }

    pub mod lockfile {
        pub fn render(pairs: &[(&str, u32)]) -> String {
            todo!("one if expression that calls the sibling hash module via super::")
        }
    }
}

// the facade: callers never type harness_core::lockfile
mod hlock {
    pub use crate::harness_core::lockfile::render;
}

fn main() {
    println!("{} / {}", hlock::render(&[("b", 2), ("a", 1)]), hlock::render(&[]));
}
```

<solution>
```rust
mod harness_core {
    pub mod hash {
        pub fn canonical(pairs: &[(&str, u32)]) -> String {
            let mut v = pairs.to_vec();
            v.sort();
            v.iter().map(|(k, n)| format!("{k}={n}")).collect::<Vec<_>>().join(",")
        }
    }

    pub mod lockfile {
        pub fn render(pairs: &[(&str, u32)]) -> String {
            if pairs.is_empty() {
                String::from("lock: (empty)")
            } else {
                format!("lock: {}", super::hash::canonical(pairs))
            }
        }
    }
}

mod hlock {
    pub use crate::harness_core::lockfile::render;
}

fn main() {
    println!("{} / {}", hlock::render(&[("b", 2), ("a", 1)]), hlock::render(&[]));
}
```
:::

::: exercise id="use-paths" kind="code" level="++" concepts="modules,expression" difficulty="4" check="exact:hlock 0.5.0 backends=local flyte=off pins=agents/main@1a2b3c4,skills/tests@9f8e7d6" hints="`hash` is a `pub(crate)` field, so code anywhere in this file (one crate) can read it, but another crate could not. `pin` is `format!(...)` of the name, an `@` and `&skill.hash[..7]`|`cfg!(feature = ...)` is a plain `bool` evaluated at compile time. Start from `vec![...]` holding `local`, and push `flyte` only if the flag is on|The fallback is the `#[cfg(not(feature = ...))]` copy of `flyte_status`, and it returns `off`. A plain `rustc` build enables no features, so this is the copy that compiles"
This is hlock's workspace in one file: an inline `mod` per crate, and a feature flag like
`hlock`'s `flyte = ["harness-lock-core/flyte"]`. `harness_lock_core` holds the brains,
and the `hlock` facade does `pub use crate::harness_lock_core::*;` just as the real crates
re-export. Fill in the three `todo!()`s:

1. `hash::pin`: the skill's name, `@`, and the first 7 characters of its `pub(crate)` hash.
2. `backends::enabled`: always `local`, plus `flyte` only when `cfg!(feature = "flyte")`.
3. the `not(feature = "flyte")` fallback of `flyte_status`, returning `off`.

`main` talks only to the facade. Expected output:
`hlock 0.5.0 backends=local flyte=off pins=agents/main@1a2b3c4,skills/tests@9f8e7d6`.

```rust
mod harness_lock_core {
    pub const VERSION: &str = "0.5.0";

    pub mod manifest {
        pub struct Skill {
            pub name: String,
            pub(crate) hash: String, // visible in this crate only
        }
    }

    pub mod hash {
        use super::manifest::Skill;

        pub fn pin(skill: &Skill) -> String {
            todo!("name@first-7-of-hash")
        }
    }

    pub mod backends {
        pub fn enabled() -> Vec<&'static str> {
            todo!("local always, flyte only behind the feature")
        }

        #[cfg(feature = "flyte")]
        pub fn flyte_status() -> &'static str { "on" }

        // the default build has no features: this is the copy that compiles
        #[cfg(not(feature = "flyte"))]
        pub fn flyte_status() -> &'static str { todo!() }
    }
}

// the facade crate: re-export everything, like hlock's pub use
mod hlock {
    pub use crate::harness_lock_core::*;
}

fn main() {
    use hlock::manifest::Skill;
    let skills = vec![
        Skill { name: String::from("agents/main"), hash: String::from("1a2b3c4d5e") },
        Skill { name: String::from("skills/tests"), hash: String::from("9f8e7d6c5b") },
    ];
    let pins: Vec<String> = skills.iter().map(hlock::hash::pin).collect();
    println!(
        "hlock {} backends={} flyte={} pins={}",
        hlock::VERSION,
        hlock::backends::enabled().join(","),
        hlock::backends::flyte_status(),
        pins.join(",")
    );
}
```

<solution>
```rust
mod harness_lock_core {
    pub const VERSION: &str = "0.5.0";

    pub mod manifest {
        pub struct Skill {
            pub name: String,
            pub(crate) hash: String,
        }
    }

    pub mod hash {
        use super::manifest::Skill;

        pub fn pin(skill: &Skill) -> String {
            format!("{}@{}", skill.name, &skill.hash[..7])
        }
    }

    pub mod backends {
        pub fn enabled() -> Vec<&'static str> {
            let mut v = vec!["local"];
            if cfg!(feature = "flyte") {
                v.push("flyte");
            }
            v
        }

        #[cfg(feature = "flyte")]
        pub fn flyte_status() -> &'static str { "on" }

        #[cfg(not(feature = "flyte"))]
        pub fn flyte_status() -> &'static str { "off" }
    }
}

mod hlock {
    pub use crate::harness_lock_core::*;
}

fn main() {
    use hlock::manifest::Skill;
    let skills = vec![
        Skill { name: String::from("agents/main"), hash: String::from("1a2b3c4d5e") },
        Skill { name: String::from("skills/tests"), hash: String::from("9f8e7d6c5b") },
    ];
    let pins: Vec<String> = skills.iter().map(hlock::hash::pin).collect();
    println!(
        "hlock {} backends={} flyte={} pins={}",
        hlock::VERSION,
        hlock::backends::enabled().join(","),
        hlock::backends::flyte_status(),
        pins.join(",")
    );
}
```
:::

::: exercise id="use-paths" kind="code" level="+++" concepts="modules,expression" difficulty="5" check="exact:hlock 0.5.0; backend=local; agents/main: model=opus,temp=0" hints="A private `mod canon` inside the core module is visible to its parent and siblings but not to `main`, so the core needs a `pub fn` that calls `canon::canonical` for it|`pub use crate::core_mod::lock_line as render;` re-exports under a new name. Give `backend` two definitions, one under `#[cfg(feature = ...)]` and one under `#[cfg(not(feature = ...))]`"
**Spec only.** Lay out a two-crate workspace in one file, from scratch:

- A core module with a `VERSION` constant `0.5.0` and a **private** submodule `canon`
  whose `canonical(pairs: &[(&str, &str)]) -> String` sorts pairs by key and joins them as
  `k=v` with `,`.
- In the core module, a public `lock_line(name, pairs)` returning `name: ` plus the
  canonical text. It is the only door into `canon`.
- A `backend()` with **two** cfg-gated definitions: `flyte` under `feature = "flyte"`, and
  `local` otherwise.
- A facade module `hlock` that re-exports `VERSION`, `backend`, and `lock_line` renamed to
  `render`.

`main` may only use `hlock::` paths. Render `agents/main` with the pairs
`[("temp", "0"), ("model", "opus")]` and print the version, backend and lock line joined
with `; `. Expected output: `hlock 0.5.0; backend=local; agents/main: model=opus,temp=0`.

```rust
fn main() {
    todo!("core module, private canon, cfg-gated backend, hlock facade, then print")
}
```

<solution>
```rust
mod harness_lock_core {
    pub const VERSION: &str = "0.5.0";

    mod canon {
        pub fn canonical(pairs: &[(&str, &str)]) -> String {
            let mut v = pairs.to_vec();
            v.sort();
            v.iter().map(|(k, val)| format!("{k}={val}")).collect::<Vec<_>>().join(",")
        }
    }

    pub fn lock_line(name: &str, pairs: &[(&str, &str)]) -> String {
        format!("{name}: {}", canon::canonical(pairs))
    }

    #[cfg(feature = "flyte")]
    pub fn backend() -> &'static str { "flyte" }

    #[cfg(not(feature = "flyte"))]
    pub fn backend() -> &'static str { "local" }
}

mod hlock {
    pub use crate::harness_lock_core::{backend, lock_line as render, VERSION};
}

fn main() {
    let line = hlock::render("agents/main", &[("temp", "0"), ("model", "opus")]);
    println!("hlock {}; backend={}; {}", hlock::VERSION, hlock::backend(), line);
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

::: exercise id="workspace-quiz" kind="mcq" concepts="modules" difficulty="1" options="All four member crates|Only `crates/hlock`, the published CLI|Only `harness-lock-core`, the first member listed|Nothing, until you pick a crate with `-p`" answer="0" explain="A root `Cargo.toml` with no `[package]` is a *virtual* workspace, so `cargo build` there builds the workspace's default members, which in hlock is all four crates (with no `default-members` line it would be every member anyway). They share one `Cargo.lock` and one `target/` directory. Cargo doesn't pick the CLI or the first-listed crate for you, and `-p <crate>` is optional: it narrows the build to one member."
hlock's root `Cargo.toml` is a pure workspace: it lists four `members` and has no
`[package]` of its own. What does `cargo build` build when you run it in that root
directory?
:::


::: exercise id="workspace-quiz" kind="mcq" level="+" concepts="modules" difficulty="2" options="harness-lock-core is built with its own flyte feature on, because hlock's feature list turns it on|Nothing changes in harness-lock-core, because features never cross crate boundaries|harness-lock-core is built twice, once with flyte and once without|cargo refuses, because a member crate can't enable another member's features" answer="0" explain="hlock's `flyte` entry lists `harness-lock-core/flyte`, so enabling `hlock/flyte` also enables `flyte` on the dependency. Cargo then unifies features: each dependency is built once with the union of every feature anyone asked for, never twice."
With the `[features]` table above, you run `cargo build -p hlock --features flyte`. What
happens to `harness-lock-core`?
:::

::: exercise id="workspace-quiz" kind="mcq" level="++" concepts="modules" difficulty="3" options="A compile error, E0453: an `allow` can't relax a `forbid`|A clean build, because the local `allow` overrides the workspace lint|A clean build with a warning, because workspace lints are advisory|A clean debug build, with the error only under `--release`" answer="0" explain="`forbid` is `deny` that nothing further in can override. Cargo passes the workspace lint to rustc as `--forbid=unsafe_code`, so the inner `#[allow(unsafe_code)]` is itself an error, E0453 (allow incompatible with previous forbid), and the `unsafe` block is reported as an error too. A plain `deny` is the level a local `allow` *can* override. Workspace lints aren't advisory either: `forbid` is an error level, and it applies the same way in debug and release builds. Members only get workspace lints when they opt in with `[lints] workspace = true`, which this crate has."
hlock's root sets `unsafe_code = "forbid"` under `[workspace.lints.rust]`. A contributor
adds this to `crates/hlock`, whose `Cargo.toml` has `[lints] workspace = true`:

```rust
#[allow(unsafe_code)]
fn fast_copy(src: &[u8], dst: &mut [u8]) {
    unsafe { std::ptr::copy_nonoverlapping(src.as_ptr(), dst.as_mut_ptr(), src.len()) }
}
```

What happens?
:::

::: only level="++"
**Splunker's notes.** Visibility in Rust is per *module*, not per file. `pub(crate)`
means "anywhere in this crate", `pub(super)` means "my parent", and a bare item is
visible only in its own module and that module's children. A facade like
`pub use harness_lock_core::*` re-exports only what is already `pub`, so the
`pub(crate)` internals stay sealed. Feature flags are compile-time `cfg`s. Use them to
swap whole items (`#[cfg(...)]`), or as a `bool` inside code (`cfg!(...)`), and remember
features are additive across the dependency graph.
:::
