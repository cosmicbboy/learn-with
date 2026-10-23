---
title: "Threads, Arc, and async — running things in parallel"
concepts: [concurrency, expression]
objectives:
  - Explain Arc<T>, Mutex, and channels at a high level
  - See the concurrency shapes hlock's worker uses
---

## Why concurrency is a *type* in Rust

Python has the GIL; JS is single-threaded. Rust lets you use all cores *safely*, and it
makes sharing data between threads a **type-level** concern. If you try to touch shared
data from two threads without the right wrapper, the compiler stops you — a whole class
of race conditions removed before runtime.

The two stars you'll meet while reading hlock:
- **`Arc<T>`** — *atomic reference count*. Share an owned value across threads by
  counting references. (Python's `refcount` for immutable data, made thread-safe.)
- **`Mutex<T>`** — *mutual exclusion*. Guard mutable data so only one thread at a time
  touches it (like a `threading.Lock`).

## The ownership dance

To hand the *same* `Vec<String>` to two threads, each thread needs to own a reference —
that's `Arc`. And if they mutate it, each wraps it in `Mutex`. So hlock-type code reads:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let shared = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let c = Arc::clone(&shared);
        handles.push(thread::spawn(move || {
            let mut g = c.lock().unwrap();
            *g += 1;
        }));
    }
    for h in handles { h.join().unwrap(); }
    println!("total {}", *shared.lock().unwrap()); // 4
}
```

Deconstruct it:
- `Arc::clone(&shared)` — hand each thread its own *counted* reference.
- `move ||` — the closure **moves** its captured `Arc` into the thread.
- `c.lock().unwrap()` — grab the mutex guard; `*g += 1` mutates through it.

::: callout type="contrast" lang="python"
**For the Pythonista.** `Arc<Mutex<T>>` ≈ passing an object guarded by a lock around a
`Thread`. Python's GIL hides the danger; Rust's compiler refuses to let you race.
:::

## Channels: pipes between threads

The other core tool is a **channel** — one thread `send`s, another `recv`s. Think
`queue.Queue` or JS `postMessage`:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        tx.send("done").unwrap();
    });
    println!("got: {}", rx.recv().unwrap());
}
```

This is how a *worker* pattern (like hlock's `worker.rs`) fans tasks out and collects
results: spawn threads, send each a job over a channel, collect the `Ok`/`Err` results.

::: exercise id="arc-clone" kind="code" concepts="concurrency" difficulty="3" check="contains:total: 4"
Fill the two missing lines (an `Arc::clone` and the `move` closure capture) so the
program spawns 4 threads which each increment the shared counter, printing
`total: 4`. It already compiles-skeleton — just complete the pattern.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let shared = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let c = Arc::clone(&shared);
        handles.push(thread::spawn(move || {
            let mut g = c.lock().unwrap();
            *g += 1;
        }));
    }
    for h in handles { h.join().unwrap(); }
    let final_n = *shared.lock().unwrap();
    println!("total: {final_n}");
}
```

<solution>
```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let shared = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let c = Arc::clone(&shared);
        handles.push(thread::spawn(move || {
            let mut g = c.lock().unwrap();
            *g += 1;
        }));
    }
    for h in handles { h.join().unwrap(); }
    let final_n = *shared.lock().unwrap();
    println!("total: {final_n}");
}
```
:::

> **Why `4 threads` in the check but the code prints `total: 4`?** The `contains:4`
> check would match either. Authoring hint: be precise — here `contains:total: 4` lines
> up the goal with reality. We use `contains:4` above for lenience; in real courses,
> match exactly.

## Async: when waiting, don't block

Rust's async (`async fn` + `.await`) lets thousands of in-flight tasks share a few
threads — great for I/O-heavy worker loops. The model: an `async fn` is a *coroutine*;
`.await` yields control while waiting. hlock's worker uses async + channels under the
hood to stay responsive while executing trials.

You don't need to write async to Splunk hlock — you need to *recognise* it:

```rust
async fn fetch_status(url: &str) -> String {
    format!("checked {url}")
}
```

::: exercise id="chan-quiz" kind="mcq" concepts="concurrency" difficulty="2" options="Arc<T>|Mutex<T>|mpsc::channel|Vec<T>" answer="2"
To send messages from one thread to another, which primitive do you use?
:::
