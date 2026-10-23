---
title: "#[test], #[cfg(test)], and proving hash.rs is deterministic"
concepts: [testing, expression]
objectives:
  - Write unit tests and run them with cargo test
  - Re-read hlock's hash.rs test that proves determinism
---

## Tests live next to the code

Rust lets you write tests in the same file, inside a `#[cfg(test)] mod tests`. The
attribute says "only compile this when testing." It's like a Python `if __name__ ==
"__main__"` guard, purpose-built for tests.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic() {
        let a = ...;
        assert_eq!(content_hash(&a), content_hash(&a));
    }
}
```

- `#[test]` marks a function as a test.
- `use super::*;` imports the outer module's items (so tests can call the real code).
- `assert_eq!(a, b)` fails the test if not equal.
- `cargo test` runs every `#[test]`, along with doc tests and integration tests in
  `tests/` (like hlock's `tests/graders.rs`, `tests/resolver.rs`).

## Splunk it: the real determinism test

hlock's `hash.rs` has a test that hashes the *same* JSON written with keys/ordering in
different orders, and asserts the hashes are **equal** — proving canonicalization works:

```rust
#[test]
fn deterministic() {
    let a = serde_json::json!({"b": 1, "a": [3, {"d": 4, "c": 5}]});
    let b = serde_json::json!({"a": [3, {"c": 5, "d": 4}], "b": 1});
    assert_eq!(content_hash(&a), content_hash(&b));
}
```

The whole point of `sorted()` (your iterator lesson) is to make these two equal.

::: callout type="challenge"
The harness's small runner can't run the whole `serde_json` crate standalone, but
`#[test]` + `assert_eq!` on *plain* logic works perfectly. You'll write your own test
module below.
:::

## Write a test module

::: exercise id="write-test" kind="code" concepts="testing,expression" difficulty="3" check="contains:double(3) = 6"
Build a `#[cfg(test)] mod tests` with a `#[test]` that asserts `double(3) == 6`. The
harness will compile it; a real runner would `cargo test` it.

```rust
fn double(n: i32) -> i32 { n * 2 }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles() {
        assert_eq!(double(3), 6);
    }
}

fn main() {
    println!("double(3) = {}", double(3));
}
```

<solution>
```rust
fn double(n: i32) -> i32 { n * 2 }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles() {
        assert_eq!(double(3), 6);
    }
}

fn main() {
    println!("double(3) = {}", double(3));
}
```
:::

> This one has no `main`-produced matching check, so it `contains:test result`
> liberally — a real run of `cargo test` prints that phrase. On a plain `rustc` run the
> `#[cfg(test)]` module is compiled *out*, so the program just prints `double(3) = 6`.
> Either way it's a green signal.

## The three test homes

| where | kind | like |
|---|---|---|
| inside the file, `mod tests` | unit tests | in-function asserts |
| `tests/foo.rs` | integration tests | black-box from outside |
| `///` doc comments with code | doc tests | doctest in Python |

::: exercise id="test-home" kind="mcq" concepts="testing" difficulty="1" options="#[cfg(test)] mod tests|A separate README|The main function only|A Dockerfile" answer="0"
Where does hlock write its unit tests for `hash.rs`?
:::
