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

::: exercise id="arc-clone" kind="code" concepts="concurrency" difficulty="3" check="exact:total: 4" hints="Run it: the `todo!()` panics in `main` before the first thread is even spawned, so each loop pass needs a real handle to `shared`|`Arc::clone(&shared)` makes a new handle to the same counter and bumps the reference count|Replace the `todo!()` with `Arc::clone(&shared)`, and the `move` closure then carries `c` into its thread"
Fill in the missing line: replace the `todo!()` with an `Arc::clone` of `shared`, so each
thread gets its own handle `c`. Notice the `move` on the closure: it moves that handle
into the thread. The program spawns 4 threads that each increment the shared counter, so
it should print exactly `total: 4`.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let shared = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let c: Arc<Mutex<i32>> = todo!(); // TODO: a new Arc handle to shared
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

::: exercise id="arc-clone" kind="code" level="+" concepts="concurrency,expression" difficulty="4" check="exact:squares [0, 1, 4, 9]" hints="Each thread needs its own `Arc::clone(&shared)`, and inside the thread `lock()` the Mutex before you `push`|The threads finish in reverse order on purpose, so sort the Vec before printing|After every thread is joined, `Arc::try_unwrap(shared)` gives back the Mutex (no other handles remain), and `.into_inner()` gives back the Vec. Both return a Result, so unwrap them"
Now the threads produce **data**, not a count. Thread `i` pushes `i * i` into a shared
`Vec<u32>`. Fill in the three `todo!()`s:

1. give each thread its own handle `c` to `shared`;
2. inside the thread, lock the Mutex and push `i * i`;
3. after joining, take the `Vec` **back out** of the `Arc<Mutex<…>>` so you own it.
   Don't clone it.

The `sleep` makes later threads finish first, so the pushes land in reverse order. Your
output must not depend on thread timing. Expected output: `squares [0, 1, 4, 9]`.

```rust
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    let shared: Arc<Mutex<Vec<u32>>> = Arc::new(Mutex::new(Vec::new()));
    let mut handles = vec![];
    for i in 0..4u32 {
        let c: Arc<Mutex<Vec<u32>>> = todo!(); // TODO: this thread's handle
        handles.push(thread::spawn(move || {
            thread::sleep(Duration::from_millis(5 * (4 - i) as u64));
            let _ = &c;
            todo!() // TODO: lock c and push i * i
        }));
    }
    for h in handles { h.join().unwrap(); }
    let squares: Vec<u32> = todo!(); // TODO: recover the Vec from shared, then make the order deterministic
    println!("squares {:?}", squares);
}
```

<solution>
```rust
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    let shared: Arc<Mutex<Vec<u32>>> = Arc::new(Mutex::new(Vec::new()));
    let mut handles = vec![];
    for i in 0..4u32 {
        let c = Arc::clone(&shared);
        handles.push(thread::spawn(move || {
            thread::sleep(Duration::from_millis(5 * (4 - i) as u64));
            c.lock().unwrap().push(i * i);
        }));
    }
    for h in handles { h.join().unwrap(); }
    // Every clone died with its thread, so the Arc has exactly one owner again.
    let mut squares = Arc::try_unwrap(shared).unwrap().into_inner().unwrap();
    squares.sort();
    println!("squares {:?}", squares);
}
```
:::

::: exercise id="arc-clone" kind="code" level="++" concepts="concurrency,expression" difficulty="5" check="exact:#0 lint ok; #1 fmt ok; #2 FAIL no skill pinned; #3 test ok -- 3/4 passed" hints="Clone the sender once per trial (`let tx = tx.clone();`), move it and the trial into `thread::spawn`, and `send((t.id, run_trial(&t)))`|If Run hangs and then times out, `rx.iter()` is still waiting for a sender. `main` owns the original `tx`, so `drop(tx)` before you collect|Collect with `rx.iter().collect()` into a `mut` Vec, then `results.sort_by_key(...)` on the id, because the trials finish in reverse order"
A fan-out/fan-in worker, shaped like the job hlock's worker does: each trial runs on its
own thread and reports a `Result` back over a channel. The trials take different amounts
of time, so results arrive **out of order**, and one trial fails.

Finish the two TODOs. For the fan-out, give each thread its own sender and send
`(t.id, run_trial(&t))`. For the fan-in, collect every result and sort it back into trial
order. The formatting is done for you. Expected output:
`#0 lint ok; #1 fmt ok; #2 FAIL no skill pinned; #3 test ok -- 3/4 passed`.

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[derive(Debug)]
struct Trial {
    id: usize,
    skill: String,
}

// Later trials are faster, so results arrive in reverse order.
fn run_trial(t: &Trial) -> Result<String, String> {
    thread::sleep(Duration::from_millis(40 - 10 * t.id as u64));
    if t.skill.is_empty() {
        Err(String::from("no skill pinned"))
    } else {
        Ok(format!("{} ok", t.skill))
    }
}

fn main() {
    let trials = vec![
        Trial { id: 0, skill: String::from("lint") },
        Trial { id: 1, skill: String::from("fmt") },
        Trial { id: 2, skill: String::new() },
        Trial { id: 3, skill: String::from("test") },
    ];
    let (tx, rx) = mpsc::channel::<(usize, Result<String, String>)>();
    let mut handles: Vec<thread::JoinHandle<()>> = Vec::new();
    for t in trials {
        // TODO: fan out: one thread per trial, each with its own sender
        let _ = (&tx, &mut handles, t);
    }
    // TODO: fan in: every (id, result) from rx, in trial order
    let results: Vec<(usize, Result<String, String>)> = todo!();
    for h in handles { h.join().unwrap(); }

    let passed = results.iter().filter(|(_, r)| r.is_ok()).count();
    let lines: Vec<String> = results
        .iter()
        .map(|(id, r)| match r {
            Ok(msg) => format!("#{id} {msg}"),
            Err(e) => format!("#{id} FAIL {e}"),
        })
        .collect();
    println!("{} -- {passed}/{} passed", lines.join("; "), results.len());
}
```

<solution>
```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[derive(Debug)]
struct Trial {
    id: usize,
    skill: String,
}

// Later trials are faster, so results arrive in reverse order.
fn run_trial(t: &Trial) -> Result<String, String> {
    thread::sleep(Duration::from_millis(40 - 10 * t.id as u64));
    if t.skill.is_empty() {
        Err(String::from("no skill pinned"))
    } else {
        Ok(format!("{} ok", t.skill))
    }
}

fn main() {
    let trials = vec![
        Trial { id: 0, skill: String::from("lint") },
        Trial { id: 1, skill: String::from("fmt") },
        Trial { id: 2, skill: String::new() },
        Trial { id: 3, skill: String::from("test") },
    ];
    let (tx, rx) = mpsc::channel::<(usize, Result<String, String>)>();
    let mut handles: Vec<thread::JoinHandle<()>> = Vec::new();
    for t in trials {
        let tx = tx.clone();
        handles.push(thread::spawn(move || {
            tx.send((t.id, run_trial(&t))).unwrap();
        }));
    }
    drop(tx); // the channel closes once every sender is gone
    let mut results: Vec<(usize, Result<String, String>)> = rx.iter().collect();
    for h in handles { h.join().unwrap(); }
    results.sort_by_key(|(id, _)| *id);

    let passed = results.iter().filter(|(_, r)| r.is_ok()).count();
    let lines: Vec<String> = results
        .iter()
        .map(|(id, r)| match r {
            Ok(msg) => format!("#{id} {msg}"),
            Err(e) => format!("#{id} FAIL {e}"),
        })
        .collect();
    println!("{} -- {passed}/{} passed", lines.join("; "), results.len());
}
```
:::

::: exercise id="arc-clone" kind="code" level="+++" concepts="concurrency,expression" difficulty="5" check="exact:AGENTS.md=fnv1a:4039d7e2 README.md=fnv1a:38aa37e0 harness.toml=fnv1a:facff1bb skills/go.md=fnv1a:8a9608e6 skills/py.md=fnv1a:bdb7b3f8 skills/rust.md=fnv1a:e79b4b08 (6 files, 3 workers)" hints="Write `fnv1a(&[u8]) -> String` first and check it on one file before adding any threads|Several workers can share ONE receiver if it lives in an `Arc<Mutex<Receiver<...>>>`. Each worker loops on `rx.lock().unwrap().recv()`, and an `Err` from `recv` means the job channel closed, so break|Drop the job sender after queueing every job (or the workers never stop), drop main's copy of the result sender (or collecting never ends), then collect the results into a BTreeMap"
**Spec: a hashing worker pool.** Hash six files on a pool of **exactly 3** worker
threads. This is the classic shared-queue pool, not one thread per job.

- One job channel carries `(path, body)` pairs. All 3 workers pull from the **same**
  receiver. A worker exits when the job channel is closed.
- Each worker hashes the body and sends `(path, hash)` back on a result channel.
- Hash = 32-bit **FNV-1a** of the body's bytes: start `h = 0x811c9dc5`; for each byte,
  `h ^= byte`, then `h = h.wrapping_mul(0x01000193)`. Format it as `fnv1a:` plus 8
  lowercase hex digits, the same `algo:hex` shape as hlock's `sha256:<hex>`.
- Collect into a `BTreeMap<String, String>` and print **one line**: `path=hash` pairs
  in the map's order, separated by spaces, then ` (6 files, 3 workers)`. Both counts
  come from your data, not literals.

The map's order is byte order, so `AGENTS.md` and `README.md` sort before `harness.toml`.
Expected output:
`AGENTS.md=fnv1a:4039d7e2 README.md=fnv1a:38aa37e0 harness.toml=fnv1a:facff1bb skills/go.md=fnv1a:8a9608e6 skills/py.md=fnv1a:bdb7b3f8 skills/rust.md=fnv1a:e79b4b08 (6 files, 3 workers)`

```rust
fn main() {
    let files = vec![
        ("skills/rust.md", "own it"),
        ("AGENTS.md", "be kind"),
        ("skills/py.md", "import this"),
        ("harness.toml", "version = 1"),
        ("skills/go.md", "if err != nil"),
        ("README.md", "hlock"),
    ];
    let _ = files;
    todo!("build the pool")
}
```

<solution>
```rust
use std::collections::BTreeMap;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

fn fnv1a(data: &[u8]) -> String {
    let mut h: u32 = 0x811c9dc5;
    for b in data {
        h ^= *b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    format!("fnv1a:{h:08x}")
}

fn main() {
    let files = vec![
        ("skills/rust.md", "own it"),
        ("AGENTS.md", "be kind"),
        ("skills/py.md", "import this"),
        ("harness.toml", "version = 1"),
        ("skills/go.md", "if err != nil"),
        ("README.md", "hlock"),
    ];
    let (job_tx, job_rx) = mpsc::channel::<(String, String)>();
    let job_rx = Arc::new(Mutex::new(job_rx));
    let (res_tx, res_rx) = mpsc::channel::<(String, String)>();

    let mut workers = Vec::new();
    for _ in 0..3 {
        let rx = Arc::clone(&job_rx);
        let tx = res_tx.clone();
        workers.push(thread::spawn(move || loop {
            // The guard is a temporary: the lock is released at the end of this
            // statement, so hashing below runs in parallel.
            let job = rx.lock().unwrap().recv();
            match job {
                Ok((path, body)) => tx.send((path, fnv1a(body.as_bytes()))).unwrap(),
                Err(_) => break, // job channel closed: no more work
            }
        }));
    }
    drop(res_tx);

    for (path, body) in &files {
        job_tx.send((path.to_string(), body.to_string())).unwrap();
    }
    drop(job_tx);

    let lock: BTreeMap<String, String> = res_rx.iter().collect();
    let n_workers = workers.len();
    for w in workers { w.join().unwrap(); }

    let pairs: Vec<String> = lock.iter().map(|(p, h)| format!("{p}={h}")).collect();
    println!("{} ({} files, {n_workers} workers)", pairs.join(" "), lock.len());
}
```
:::

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

::: exercise id="chan-quiz" kind="mcq" concepts="concurrency" difficulty="2" options="`std::sync::Arc`|`std::sync::Mutex`|`std::sync::mpsc::channel`|`std::thread::spawn`" answer="2" explain="`mpsc::channel()` returns a `(Sender, Receiver)` pair: one thread calls `send`, another calls `recv`, and the value moves across. `Arc` and `Mutex` are for *shared state*: both threads touch the same value, rather than one handing a message to the other. `thread::spawn` starts a thread but gives it no way to talk back, apart from the single value its `JoinHandle` returns."
You want one thread to hand values to another, like Python's `queue.Queue`. Which std
item do you reach for?
:::

::: exercise id="chan-quiz" kind="mcq" level="+" concepts="concurrency" difficulty="3" options="Compile error: `Rc<i32>` cannot be sent between threads|Compile error: the closure must borrow `r`, not move it|Compiles and prints `5`, since `Rc` and `Arc` are interchangeable|Compiles, but the count may be corrupted at runtime" answer="0" explain="`thread::spawn` requires everything the closure captures to be `Send`. `Rc` updates its count with plain, non-atomic arithmetic, so two threads cloning it could corrupt the count. Rust marks `Rc` as `!Send` and rejects the program with E0277, so the runtime corruption never gets a chance to happen. `Arc` is the atomic version, which is why threaded code uses it. Borrowing instead of moving wouldn't help either, because a spawned thread may outlive the function, so `spawn` demands a `'static` closure."
What does the compiler say about this program?

```rust
use std::rc::Rc;
use std::thread;

fn main() {
    let r = Rc::new(5);
    let h = thread::spawn(move || println!("{r}"));
    h.join().unwrap();
}
```
:::

::: exercise id="chan-quiz" kind="mcq" level="++" concepts="concurrency" difficulty="4" options="Hangs: `rx.iter()` never finishes|Prints `[0, 1, 2]` and exits|Prints the three ids in some order, then exits|Panics: three senders can't share one receiver" answer="0" explain="`rx.iter()` ends only when **every** `Sender` has been dropped. Each thread drops its clone when it finishes, but `main` still holds the original `tx`, so the receiver waits forever after the third value and nothing is printed. Worker code calls `drop(tx)` before collecting, or moves the original sender into the last job. mpsc is multi-producer by design, so three senders are fine."
A worker fans out three jobs and collects the results. What happens when it runs?

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();
    for id in 0..3 {
        let tx = tx.clone();
        thread::spawn(move || tx.send(id).unwrap());
    }
    let all: Vec<i32> = rx.iter().collect();
    println!("{all:?}");
}
```
:::

::: exercise id="chan-quiz" kind="mcq" level="+++" concepts="concurrency,expression" difficulty="5" options="Deadlocks (or panics) on the `let total` line|Prints `5 3`|Deadlocks on the `push` line|Fails to compile: a Mutex can be locked only once per scope" answer="0" explain="A guard that is never bound to a name is a **temporary**, and it drops at the end of its statement. So the `let n` and `push` lines each lock and unlock, which is why the `push` line is fine. `let g = ...` binds a guard, which lives to the end of the block. The `let total` line then tries to lock again on the same thread while `g` is held. std's `Mutex` is not re-entrant, so that deadlocks or panics (std only promises it won't return). It does compile, because the borrow checker can't see lock state. The fix is to sum through the guard you already hold (`g.iter().sum()`), which prints `5 3`, or to read `g.len()` and `drop(g)` before locking again. This is the same temporary rule that lets a worker write `rx.lock().unwrap().recv()` without holding the lock while it works."
Single thread, no spawn. What happens?

```rust
use std::sync::Mutex;

fn main() {
    let m = Mutex::new(vec![1, 2]);
    let n = m.lock().unwrap().len();
    m.lock().unwrap().push(n as i32);
    let g = m.lock().unwrap();
    let total: i32 = m.lock().unwrap().iter().sum();
    println!("{total} {}", g.len());
}
```
:::

::: only level="++"
### Splunker's notes: worker shapes

- **The drop-the-sender idiom.** A channel closes when its *last* `Sender` drops. Fan-out
  code clones one sender per job, so `main` has to drop its own copy, or the fan-in
  loop never ends.
- **Lock scope is expression scope.** `rx.lock().unwrap().recv()` holds the lock only for
  that statement. Bind the guard with `let` and you hold it until the block ends, which
  turns a pool back into a queue that runs one job at a time.
- **Ordering is your job.** Threads finish when they finish. Anything you print or hash
  must be sorted first (`sort_by_key`, or collect into a `BTreeMap`). Otherwise you'd
  hit the same nondeterminism that hlock's canonical JSON exists to remove.
- **`thread::scope`** (std, Rust 1.63+) lets threads *borrow* from the stack, with no
  `Arc` needed, because the scope joins them before it returns. An async runtime such
  as tokio uses the same fan-out/fan-in shape with tasks instead of OS threads.
:::
