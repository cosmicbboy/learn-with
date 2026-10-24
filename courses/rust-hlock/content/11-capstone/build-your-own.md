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

::: only until="++"
Work through the checkpoints in order. Each one is a small exercise; combine your
answers into the final program in the last exercise. The harness grades each step's real
output.
:::

::: callout type="challenge" level="+++" title="Bedrock"
No checkpoints this time. On this pass the capstone is two spec-only builds: a
`harness.lock` parser with real error messages, then a full `hlock check` that verifies
every locked skill against the files on disk. You design every type. There are no
hints and no solution, only the spec and the expected output.
:::

::: only until="++"
### Checkpoint 1 — model it with a struct
:::

::: exercise id="cap-model" kind="code" until="++" concepts="structs" difficulty="2" check="contains:level: 3 }" hints="`{:?}` only works on types that implement `Debug`, and you get that from a derive|Derives go on the line directly above `struct Skill`|Add `#[derive(Debug, Clone)]` above the struct, then print `s` with `println!` and the `{:?}` placeholder"
`Skill` has `name: String` and `level: u8`. Add `#[derive(Debug, Clone)]` to it, then
print `s` with `{:?}` in `main`. Expected output: `Skill { name: "rust", level: 3 }`.

```rust
// TODO: add #[derive(Debug, Clone)] to Skill
struct Skill {
    name: String,
    level: u8,
}

fn main() {
    let s = Skill { level: 3, name: String::from("rust") };
    // TODO: print s with the {:?} placeholder
    let _ = &s;
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
    let s = Skill { level: 3, name: String::from("rust") };
    println!("{:?}", s);
}
```
:::

::: exercise id="cap-model" kind="code" level="+" until="++" concepts="structs,enums" difficulty="3" check="contains:}, level: Some(3) } equal=false" hints="Write `enum Source` with a tuple variant `Local(String)` and a struct-like variant `Git { url: String, rev: String }`, and derive the same three traits on it and on `Skill`|Comparing with `==` needs `PartialEq` on `Skill` *and* on every field type inside it, and that includes `Source`|`let mut pinned = draft.clone();` then `pinned.level = Some(3);`. The clone is independent, so `draft == pinned` is false"
Model a skill the way a lock file sees it. A skill may be **unpinned** (no level yet) and
comes from somewhere:

- `enum Source` has `Local(String)` and `Git { url: String, rev: String }`.
- `Skill` has `name: String`, `source: Source`, `level: Option<u8>`, in that order.
- Derive `Debug`, `Clone` and `PartialEq` on both.

In `main`, build `draft`: `rust`, from git `github.com/acme/skills` at rev `a1b2`, with no
level. Clone it into `pinned`, set the clone's level to `3`, and print
`println!("{:?} equal={}", pinned, draft == pinned)`. Expected output:
`Skill { name: "rust", source: Git { url: "github.com/acme/skills", rev: "a1b2" }, level: Some(3) } equal=false`

```rust
// TODO: derive Debug, Clone and PartialEq on both types
// TODO: an enum Source with Local(String) and Git { url: String, rev: String }

struct Skill {
    name: String,
    // TODO: source: Source, then level: Option<u8>
}

fn main() {
    // TODO: build `draft` (rust, unpinned, from git), clone it into `pinned`,
    // pin the clone at level 3, then print pinned with {:?} and equal=<draft == pinned>
    todo!()
}
```

<solution>
```rust
#[derive(Debug, Clone, PartialEq)]
enum Source {
    Local(String),
    Git { url: String, rev: String },
}

#[derive(Debug, Clone, PartialEq)]
struct Skill {
    name: String,
    source: Source,
    level: Option<u8>,
}

fn main() {
    let draft = Skill {
        name: String::from("rust"),
        source: Source::Git { url: String::from("github.com/acme/skills"), rev: String::from("a1b2") },
        level: None,
    };
    let mut pinned = draft.clone();
    pinned.level = Some(3);
    println!("{:?} equal={}", pinned, draft == pinned);
}
```
:::

::: exercise id="cap-model" kind="code" level="++" until="++" concepts="structs,enums,result_option" difficulty="4" check="exact:LockEntry { name: 'py', source: Local('./skills/py'), hash: None }; LockEntry { name: 'rust', source: Git { url: 'github.com/acme/skills', rev: 'a1b2' }, hash: Some('sha256:9f2c') }; 2 of 4 lines valid" hints="`strip_prefix` returns an Option, so `if let Some(rest) = s.strip_prefix(...)` picks the source kind. Inside a fn returning Option, `?` on an Option returns None early|A git URL could contain an @, so split on the LAST one with `rsplit_once`. `git:...` with no @ at all must be None|In `from_line`, collect `split_whitespace()` into a Vec and require exactly 3 parts (`let [name, source, hash] = parts.as_slice() else ...`), use `Source::parse(source)?`, and map a `-` hash to None"
Lock entries, shaped like the read path of hlock. Each line of this fictional
`harness.lock` is `name source hash`:

- `source` is `git:<url>@<rev>` or `local:<path>`. Anything else, including a git
  source without `@rev`, is invalid.
- `hash` is `-` when the skill hasn't been hashed yet, so it's an `Option`.

Write `Source::parse` and `LockEntry::from_line`. Both return `None` for a bad line, and
`main` silently skips those. `main` swaps `"` for `'` in the Debug text so the check can
hold it. Expected output:
`LockEntry { name: 'py', source: Local('./skills/py'), hash: None }; LockEntry { name: 'rust', source: Git { url: 'github.com/acme/skills', rev: 'a1b2' }, hash: Some('sha256:9f2c') }; 2 of 4 lines valid`

```rust
#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone, PartialEq)]
struct LockEntry {
    name: String,
    source: Source,
    hash: Option<String>,
}

impl Source {
    fn parse(s: &str) -> Option<Source> {
        todo!("git:URL@REV or local:PATH, anything else is None")
    }
}

impl LockEntry {
    fn from_line(line: &str) -> Option<LockEntry> {
        todo!("name source hash, where - means no hash")
    }
}

fn main() {
    let lock = [
        "rust git:github.com/acme/skills@a1b2 sha256:9f2c",
        "py local:./skills/py -",
        "go svn:old/repo sha256:0000",
        "zig git:github.com/acme/skills sha256:1234",
    ];
    let entries: Vec<LockEntry> = lock.iter().filter_map(|l| LockEntry::from_line(l)).collect();
    let shown = format!("{:?}; {:?}", entries[1], entries[0]).replace('"', "'"); // ' so the check can match it
    println!("{shown}; {} of {} lines valid", entries.len(), lock.len());
}
```

<solution>
```rust
#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone, PartialEq)]
struct LockEntry {
    name: String,
    source: Source,
    hash: Option<String>,
}

impl Source {
    fn parse(s: &str) -> Option<Source> {
        if let Some(rest) = s.strip_prefix("git:") {
            let (url, rev) = rest.rsplit_once('@')?;
            Some(Source::Git { url: url.to_string(), rev: rev.to_string() })
        } else if let Some(path) = s.strip_prefix("local:") {
            Some(Source::Local(path.to_string()))
        } else {
            None
        }
    }
}

impl LockEntry {
    fn from_line(line: &str) -> Option<LockEntry> {
        let parts: Vec<&str> = line.split_whitespace().collect();
        let [name, source, hash] = parts.as_slice() else { return None };
        Some(LockEntry {
            name: name.to_string(),
            source: Source::parse(source)?,
            hash: if *hash == "-" { None } else { Some(hash.to_string()) },
        })
    }
}

fn main() {
    let lock = [
        "rust git:github.com/acme/skills@a1b2 sha256:9f2c",
        "py local:./skills/py -",
        "go svn:old/repo sha256:0000",
        "zig git:github.com/acme/skills sha256:1234",
    ];
    let entries: Vec<LockEntry> = lock.iter().filter_map(|l| LockEntry::from_line(l)).collect();
    let shown = format!("{:?}; {:?}", entries[1], entries[0]).replace('"', "'"); // ' so the check can match it
    println!("{shown}; {} of {} lines valid", entries.len(), lock.len());
}
```
:::

::: only until="++"
### Checkpoint 2 — a Result-based look-up
:::

::: exercise id="cap-lookup" kind="code" until="++" concepts="result_option,error_handling" difficulty="3" check="exact:found level 3" hints="Iterators have a `.find(...)` method that returns the first matching item as an `Option`|Call `skills.iter().find(...)` with a closure that compares `s.name == name`, which gives an `Option<&Skill>`|Then a `.map(...)` whose closure returns `s.level` turns the `Option<&Skill>` into the `Option<u8>` you need"
Write the body of `find` so it looks up a skill's `level` by `name` in the slice and
returns `Option<u8>` (`None` if there's no such skill). `main` looks up `rust`, so the
output should be exactly `found level 3`.

```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

fn find<'a>(skills: &'a [Skill], name: &str) -> Option<u8> {
    todo!() // TODO: find the skill with this name and return its level
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

::: exercise id="cap-lookup" kind="code" level="+" until="++" concepts="result_option,error_handling" difficulty="4" check="exact:total 7; error: skill go is not pinned; error: no skill named zig" hints="Two different things can go wrong, so two variants: no such skill, or a skill whose level is None|`.find(...)` gives an Option. `.ok_or_else(...)` turns it into a Result carrying a LookupError, and then `?` returns early|In `total`, loop over the names and write `sum += level_of(skills, name)? as u32;`. The first error stops the loop, which is why rust + go + zig only reports go"
A lookup that explains **why** it failed. `level_of` returns `Result<u8, LookupError>`:
`Missing(name)` when there's no such skill, and `Unpinned(name)` when the skill exists
but its level is `None`. `total` sums the levels of several skills with `?`, so it
stops at the **first** error. The error type and its `Display` are done for you.
Expected output:
`total 7; error: skill go is not pinned; error: no skill named zig`

```rust
use std::fmt;

#[derive(Debug, Clone)]
struct Skill { name: String, level: Option<u8> }

#[derive(Debug)]
enum LookupError {
    Missing(String),
    Unpinned(String),
}

impl fmt::Display for LookupError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LookupError::Missing(n) => write!(f, "no skill named {n}"),
            LookupError::Unpinned(n) => write!(f, "skill {n} is not pinned"),
        }
    }
}

fn level_of(skills: &[Skill], name: &str) -> Result<u8, LookupError> {
    todo!("find the skill, then its level")
}

fn total(skills: &[Skill], names: &[&str]) -> Result<u32, LookupError> {
    todo!("sum the levels, stopping at the first error")
}

fn show(r: Result<u32, LookupError>) -> String {
    match r {
        Ok(n) => format!("total {n}"),
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let skills = vec![
        Skill { name: String::from("rust"), level: Some(3) },
        Skill { name: String::from("py"), level: Some(4) },
        Skill { name: String::from("go"), level: None },
    ];
    println!(
        "{}; {}; {}",
        show(total(&skills, &["rust", "py"])),
        show(total(&skills, &["rust", "go", "zig"])),
        show(total(&skills, &["zig", "go"]))
    );
}
```

<solution>
```rust
use std::fmt;

#[derive(Debug, Clone)]
struct Skill { name: String, level: Option<u8> }

#[derive(Debug)]
enum LookupError {
    Missing(String),
    Unpinned(String),
}

impl fmt::Display for LookupError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LookupError::Missing(n) => write!(f, "no skill named {n}"),
            LookupError::Unpinned(n) => write!(f, "skill {n} is not pinned"),
        }
    }
}

fn level_of(skills: &[Skill], name: &str) -> Result<u8, LookupError> {
    let skill = skills
        .iter()
        .find(|s| s.name == name)
        .ok_or_else(|| LookupError::Missing(name.to_string()))?;
    skill.level.ok_or_else(|| LookupError::Unpinned(name.to_string()))
}

fn total(skills: &[Skill], names: &[&str]) -> Result<u32, LookupError> {
    let mut sum = 0;
    for name in names {
        sum += level_of(skills, name)? as u32;
    }
    Ok(sum)
}

fn show(r: Result<u32, LookupError>) -> String {
    match r {
        Ok(n) => format!("total {n}"),
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let skills = vec![
        Skill { name: String::from("rust"), level: Some(3) },
        Skill { name: String::from("py"), level: Some(4) },
        Skill { name: String::from("go"), level: None },
    ];
    println!(
        "{}; {}; {}",
        show(total(&skills, &["rust", "py"])),
        show(total(&skills, &["rust", "go", "zig"])),
        show(total(&skills, &["zig", "go"]))
    );
}
```
:::

::: exercise id="cap-lookup" kind="code" level="++" until="++" concepts="result_option,error_handling,enums" difficulty="5" check="exact:rust -> a1b2; manifest error: line 3: unknown source svn:old/repo; manifest error: line 1: expected 3 fields, got 2; store error: zig is not in harness.lock; store error: py is local, it has no rev" hints="Line numbers count every raw line, comments and blanks included, so `enumerate()` the lines before you skip anything, and add 1|Each failure is a different `Error` variant with a message. Build it with `ok_or_else` (missing source, missing skill) or return it early (wrong field count), and let `?` carry it up|`rev_of` is three `?`-able steps: `parse_lock(text)?`, then find the entry or `Error::Store`, then `match &entry.source`, where Git gives the rev and Local is a Store error"
This error enum is shaped like hlock's real `error.rs`: one enum, a `Display` message
per variant (`manifest error: {0}`, `store error: {0}`), and a crate-wide
`type Result<T>` alias. Implement:

1. `Display for Error`, using exactly those two message formats.
2. `parse_lock(text)`, which reads `name source hash` lines and skips blank lines and
   `#` comments. Line numbers start at 1 and count every line. Wrong field count:
   `line N: expected 3 fields, got K`. Bad source: `line N: unknown source S`. Both are
   `Manifest` errors.
3. `rev_of(text, name)`, which uses `?` throughout. A missing skill is
   `Store("NAME is not in harness.lock")`, and a local skill is
   `Store("NAME is local, it has no rev")`.

Expected output:
`rust -> a1b2; manifest error: line 3: unknown source svn:old/repo; manifest error: line 1: expected 3 fields, got 2; store error: zig is not in harness.lock; store error: py is local, it has no rev`

```rust
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone, PartialEq)]
struct LockEntry { name: String, source: Source, hash: Option<String> }

impl Source {
    fn parse(s: &str) -> Option<Source> {
        if let Some(rest) = s.strip_prefix("git:") {
            let (url, rev) = rest.rsplit_once('@')?;
            Some(Source::Git { url: url.to_string(), rev: rev.to_string() })
        } else {
            s.strip_prefix("local:").map(|p| Source::Local(p.to_string()))
        }
    }
}

// Shaped like hlock's error.rs: one enum, a Display message per variant, a Result alias.
#[derive(Debug)]
enum Error {
    Manifest(String),
    Store(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("manifest error: ... or store error: ...")
    }
}

type Result<T> = std::result::Result<T, Error>;

fn parse_lock(text: &str) -> Result<Vec<LockEntry>> {
    todo!("skip blanks and comments, number lines from 1")
}

fn rev_of(text: &str, name: &str) -> Result<String> {
    todo!("parse, find, then match on the source")
}

fn main() {
    let good = "# harness.lock\nrust git:github.com/acme/skills@a1b2 sha256:9f2c\n\npy local:./skills/py -\n";
    let bad = "# harness.lock\nrust git:github.com/acme/skills@a1b2 sha256:9f2c\ngo svn:old/repo sha256:0000\n";
    let short = "rust git:github.com/acme/skills@a1b2\n";
    let out: Vec<String> = [(good, "rust"), (bad, "rust"), (short, "rust"), (good, "zig"), (good, "py")]
        .iter()
        .map(|(text, name)| match rev_of(text, name) {
            Ok(rev) => format!("{name} -> {rev}"),
            Err(e) => e.to_string(),
        })
        .collect();
    println!("{}", out.join("; "));
}
```

<solution>
```rust
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone, PartialEq)]
struct LockEntry { name: String, source: Source, hash: Option<String> }

impl Source {
    fn parse(s: &str) -> Option<Source> {
        if let Some(rest) = s.strip_prefix("git:") {
            let (url, rev) = rest.rsplit_once('@')?;
            Some(Source::Git { url: url.to_string(), rev: rev.to_string() })
        } else {
            s.strip_prefix("local:").map(|p| Source::Local(p.to_string()))
        }
    }
}

// Shaped like hlock's error.rs: one enum, a Display message per variant, a Result alias.
#[derive(Debug)]
enum Error {
    Manifest(String),
    Store(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Manifest(m) => write!(f, "manifest error: {m}"),
            Error::Store(m) => write!(f, "store error: {m}"),
        }
    }
}

type Result<T> = std::result::Result<T, Error>;

fn parse_lock(text: &str) -> Result<Vec<LockEntry>> {
    let mut out = Vec::new();
    for (i, raw) in text.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let n = i + 1;
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() != 3 {
            return Err(Error::Manifest(format!("line {n}: expected 3 fields, got {}", parts.len())));
        }
        let source = Source::parse(parts[1])
            .ok_or_else(|| Error::Manifest(format!("line {n}: unknown source {}", parts[1])))?;
        let hash = if parts[2] == "-" { None } else { Some(parts[2].to_string()) };
        out.push(LockEntry { name: parts[0].to_string(), source, hash });
    }
    Ok(out)
}

fn rev_of(text: &str, name: &str) -> Result<String> {
    let entries = parse_lock(text)?;
    let entry = entries
        .iter()
        .find(|e| e.name == name)
        .ok_or_else(|| Error::Store(format!("{name} is not in harness.lock")))?;
    match &entry.source {
        Source::Git { rev, .. } => Ok(rev.clone()),
        Source::Local(_) => Err(Error::Store(format!("{name} is local, it has no rev"))),
    }
}

fn main() {
    let good = "# harness.lock\nrust git:github.com/acme/skills@a1b2 sha256:9f2c\n\npy local:./skills/py -\n";
    let bad = "# harness.lock\nrust git:github.com/acme/skills@a1b2 sha256:9f2c\ngo svn:old/repo sha256:0000\n";
    let short = "rust git:github.com/acme/skills@a1b2\n";
    let out: Vec<String> = [(good, "rust"), (bad, "rust"), (short, "rust"), (good, "zig"), (good, "py")]
        .iter()
        .map(|(text, name)| match rev_of(text, name) {
            Ok(rev) => format!("{name} -> {rev}"),
            Err(e) => e.to_string(),
        })
        .collect();
    println!("{}", out.join("; "));
}
```
:::

::: only until="++"
### Checkpoint 3 — report with iterators
:::

::: exercise id="cap-report" kind="code" until="++" concepts="iterators,expression" difficulty="3" check="contains:rust:3" hints="Turn each `Skill` into one line of text first, then glue the lines together|`skills.iter().map(...)` with a closure that calls `format!` on `s.name` and `s.level` gives you an iterator of `String`s like `rust:3`|Finish with `.collect::<Vec<_>>().join(...)`, joining on a newline"
Write `report` so it returns a `String` of `name:level` lines joined by `\n`, using
iterator `.map` + `.collect::<Vec<_>>().join("\n")`. Expected output: `rust:3` then
`py:4`.

```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

fn report(skills: &[Skill]) -> String {
    todo!() // TODO: one name:level line per skill, joined by newlines
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

::: exercise id="cap-report" kind="code" level="+" until="++" concepts="iterators,expression" difficulty="4" check="exact:py:4, c:3, rust:3 (3 pinned, 2 unpinned)" hints="`filter_map` keeps only the pinned skills and unwraps their level in one go: the closure returns `s.level.map(...)`|Sort by level descending, then name ascending: `sort_by` with `b.1.cmp(&a.1).then(a.0.cmp(b.0))`|The unpinned count is the total length minus the pinned length. Build the final String with `format!` around `.join(...)` on a comma and a space"
A report with the edge cases left in. Some skills are **unpinned** (`level: None`).
Write `report` so that it:

- lists only pinned skills as `name:level`, joined by `, `;
- orders them by level, **highest first**, and breaks ties by name (`c` before `rust`);
- ends with ` (P pinned, U unpinned)`.

Expected output: `py:4, c:3, rust:3 (3 pinned, 2 unpinned)`

```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: Option<u8> }

fn report(skills: &[Skill]) -> String {
    todo!("pinned skills only, highest level first, then the counts")
}

fn main() {
    let skill = |n: &str, l: Option<u8>| Skill { name: n.to_string(), level: l };
    let skills = vec![
        skill("rust", Some(3)),
        skill("go", None),
        skill("py", Some(4)),
        skill("c", Some(3)),
        skill("zig", None),
    ];
    println!("{}", report(&skills));
}
```

<solution>
```rust
#[derive(Debug, Clone)]
struct Skill { name: String, level: Option<u8> }

fn report(skills: &[Skill]) -> String {
    let mut pinned: Vec<(&str, u8)> = skills
        .iter()
        .filter_map(|s| s.level.map(|l| (s.name.as_str(), l)))
        .collect();
    pinned.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
    let unpinned = skills.len() - pinned.len();
    let body: Vec<String> = pinned.iter().map(|(n, l)| format!("{n}:{l}")).collect();
    format!("{} ({} pinned, {unpinned} unpinned)", body.join(", "), pinned.len())
}

fn main() {
    let skill = |n: &str, l: Option<u8>| Skill { name: n.to_string(), level: l };
    let skills = vec![
        skill("rust", Some(3)),
        skill("go", None),
        skill("py", Some(4)),
        skill("c", Some(3)),
        skill("zig", None),
    ];
    println!("{}", report(&skills));
}
```
:::

::: exercise id="cap-report" kind="code" level="++" until="++" concepts="iterators,expression,enums" difficulty="5" check="exact:ai local sha256:00ff; py local UNHASHED; rust git@a1b2 sha256:9f2c; zig git@ff00 sha256:1234 -- git=2 local=2, 1 unhashed" hints="Sort a Vec of references (`entries.iter().collect::<Vec<&LockEntry>>()`) by name. The input isn't sorted and you don't own it|`e.hash.as_deref().unwrap_or(...)` turns an `Option<String>` into a `&str` with a fallback, and a match on `&e.source` gives `git@REV` or `local`|Count kinds with a `BTreeMap<&str, usize>` and `*kinds.entry(k).or_insert(0) += 1`. The BTreeMap keeps git before local, then the unhashed count is a `filter(...).count()`"
A `hlock status`-style report over parsed lock entries. The input is **unsorted**, some
entries have no hash, and you only get a borrowed slice. `report` returns one line:

- each entry as `name SOURCE HASH`, sorted by name, joined by `; `. SOURCE is
  `git@<rev>` or `local`, and HASH is the hash or `UNHASHED`;
- then ` -- ` and the count per source kind in key order (`git=2 local=2`), then
  `, N unhashed`.

Expected output:
`ai local sha256:00ff; py local UNHASHED; rust git@a1b2 sha256:9f2c; zig git@ff00 sha256:1234 -- git=2 local=2, 1 unhashed`

```rust
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone)]
struct LockEntry { name: String, source: Source, hash: Option<String> }

fn report(entries: &[LockEntry]) -> String {
    todo!("sorted lines, then counts by source kind and unhashed")
}

fn main() {
    let git = |rev: &str| Source::Git { url: String::from("github.com/acme/skills"), rev: rev.to_string() };
    let entries = vec![
        LockEntry { name: String::from("zig"), source: git("ff00"), hash: Some(String::from("sha256:1234")) },
        LockEntry { name: String::from("py"), source: Source::Local(String::from("./skills/py")), hash: None },
        LockEntry { name: String::from("rust"), source: git("a1b2"), hash: Some(String::from("sha256:9f2c")) },
        LockEntry { name: String::from("ai"), source: Source::Local(String::from("./skills/ai")), hash: Some(String::from("sha256:00ff")) },
    ];
    println!("{}", report(&entries));
}
```

<solution>
```rust
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone)]
struct LockEntry { name: String, source: Source, hash: Option<String> }

fn report(entries: &[LockEntry]) -> String {
    let mut sorted: Vec<&LockEntry> = entries.iter().collect();
    sorted.sort_by(|a, b| a.name.cmp(&b.name));
    let lines: Vec<String> = sorted
        .iter()
        .map(|e| {
            let src = match &e.source {
                Source::Git { rev, .. } => format!("git@{rev}"),
                Source::Local(_) => String::from("local"),
            };
            format!("{} {src} {}", e.name, e.hash.as_deref().unwrap_or("UNHASHED"))
        })
        .collect();
    let mut kinds: BTreeMap<&str, usize> = BTreeMap::new();
    for e in entries {
        let k = match e.source { Source::Git { .. } => "git", Source::Local(_) => "local" };
        *kinds.entry(k).or_insert(0) += 1;
    }
    let kinds: Vec<String> = kinds.iter().map(|(k, n)| format!("{k}={n}")).collect();
    let unhashed = entries.iter().filter(|e| e.hash.is_none()).count();
    format!("{} -- {}, {unhashed} unhashed", lines.join("; "), kinds.join(" "))
}

fn main() {
    let git = |rev: &str| Source::Git { url: String::from("github.com/acme/skills"), rev: rev.to_string() };
    let entries = vec![
        LockEntry { name: String::from("zig"), source: git("ff00"), hash: Some(String::from("sha256:1234")) },
        LockEntry { name: String::from("py"), source: Source::Local(String::from("./skills/py")), hash: None },
        LockEntry { name: String::from("rust"), source: git("a1b2"), hash: Some(String::from("sha256:9f2c")) },
        LockEntry { name: String::from("ai"), source: Source::Local(String::from("./skills/ai")), hash: Some(String::from("sha256:00ff")) },
    ];
    println!("{}", report(&entries));
}
```
:::

::: only until="++"
## The final build: pull it together

Now the grand finale — open-ended. Combine the pieces and add a `Display` impl so you can
`println!("{skill}")`.
:::

::: exercise id="cap-final" kind="code" until="++" concepts="traits,enums,result_option" difficulty="4" check="exact:Skill(rust, lvl 3)" hints="`#[derive(Debug)]` gives you `{:?}`, but `{}` needs a hand-written `impl fmt::Display`|Inside `fmt`, call `write!(f, ...)` and return its result|The format string is `Skill({}, lvl {})`, filled with `self.name` and `self.level`"
Finish the `Display` impl for `Skill` so `println!("{s}")` prints exactly
`Skill(rust, lvl 3)`.

```rust
use std::fmt;

#[derive(Debug, Clone)]
struct Skill { name: String, level: u8 }

impl fmt::Display for Skill {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!() // TODO: write!(f, ...) so it shows Skill(rust, lvl 3)
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

::: exercise id="cap-final" kind="code" level="+" until="++" concepts="traits,enums,result_option" difficulty="5" check="exact:Skill(rust, lvl 3); Skill(py, unpinned); error: bad level 'x' in go@x" hints="`FromStr` is the trait behind `.parse::<Skill>()`. Its `from_str` returns `Result<Self, Self::Err>`, and here `Err = String`|`s.split_once(...)` on the @ gives `None` for a bare name, which is unpinned. Otherwise parse the level with `map_err` into the message and `?` it|In `fmt`, `match self.level` and `write!` one of the two shapes"
Two traits, one round trip. Implement `FromStr` for `Skill`, so that `rust@3` is
pinned at 3, a bare `py` is unpinned, and `go@x` is an error: `bad level 'x' in go@x`.
Then implement `Display` to print `Skill(rust, lvl 3)` or `Skill(py, unpinned)`. Expected
output:
`Skill(rust, lvl 3); Skill(py, unpinned); error: bad level 'x' in go@x`

```rust
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone)]
struct Skill { name: String, level: Option<u8> }

impl FromStr for Skill {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        todo!("name@level or a bare name")
    }
}

impl fmt::Display for Skill {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("Skill(name, lvl N) or Skill(name, unpinned)")
    }
}

fn main() {
    let out: Vec<String> = ["rust@3", "py", "go@x"]
        .iter()
        .map(|input| match input.parse::<Skill>() {
            Ok(s) => s.to_string(),
            Err(e) => format!("error: {e}"),
        })
        .collect();
    println!("{}", out.join("; "));
}
```

<solution>
```rust
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone)]
struct Skill { name: String, level: Option<u8> }

impl FromStr for Skill {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.split_once('@') {
            None => Ok(Skill { name: s.to_string(), level: None }),
            Some((name, lvl)) => {
                let level = lvl.parse::<u8>().map_err(|_| format!("bad level '{lvl}' in {s}"))?;
                Ok(Skill { name: name.to_string(), level: Some(level) })
            }
        }
    }
}

impl fmt::Display for Skill {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.level {
            Some(l) => write!(f, "Skill({}, lvl {l})", self.name),
            None => write!(f, "Skill({}, unpinned)", self.name),
        }
    }
}

fn main() {
    let out: Vec<String> = ["rust@3", "py", "go@x"]
        .iter()
        .map(|input| match input.parse::<Skill>() {
            Ok(s) => s.to_string(),
            Err(e) => format!("error: {e}"),
        })
        .collect();
    println!("{}", out.join("; "));
}
```
:::

::: exercise id="cap-final" kind="code" level="++" until="++" concepts="traits,enums,result_option" difficulty="5" check="exact:round-trip 3/5; error: unknown source svn:old/repo; error: git source git:github.com/acme/skills has no @rev" hints="Write the two `Display` impls first. A `LockEntry` displays exactly as its line, with `-` for a missing hash (`as_deref().unwrap_or`)|`Source::from_str` uses `strip_prefix` for each kind and `rsplit_once` on the @, because the zig URL itself contains an @. Use the exact error texts from the spec|`LockEntry::from_str` needs exactly 3 whitespace-separated fields, and `source.parse()?` reuses your `Source` impl. The `?` works because both use `Err = String`"
Make the lock format **round-trip**: `line.parse::<LockEntry>()?.to_string() == line`.
This is the property a lock writer must have, because writing back what you read must
not change the file. Implement:

- `Display for Source`: `git:<url>@<rev>` or `local:<path>`.
- `Display for LockEntry`: `name source hash`, with `-` for no hash.
- `FromStr for Source`: the errors are `unknown source S` and `git source S has no @rev`.
  The rev comes after the **last** `@`.
- `FromStr for LockEntry`: exactly three fields, and it reuses `Source`'s parser with `?`.

Expected output:
`round-trip 3/5; error: unknown source svn:old/repo; error: git source git:github.com/acme/skills has no @rev`

```rust
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone, PartialEq)]
struct LockEntry { name: String, source: Source, hash: Option<String> }

impl fmt::Display for Source {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("git:URL@REV or local:PATH")
    }
}

impl fmt::Display for LockEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        todo!("name source hash, with - for no hash")
    }
}

impl FromStr for Source {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        todo!("the inverse of Display for Source")
    }
}

impl FromStr for LockEntry {
    type Err = String;
    fn from_str(line: &str) -> Result<Self, Self::Err> {
        todo!("three fields, and ? the source parse")
    }
}

fn main() {
    let lines = [
        "rust git:github.com/acme/skills@a1b2 sha256:9f2c",
        "py local:./skills/py -",
        "zig git:gitlab.com/me/x@y@ff00 sha256:1234",
        "go svn:old/repo sha256:0000",
        "c git:github.com/acme/skills sha256:1",
    ];
    let mut round_trips = 0;
    let mut errors = Vec::new();
    for line in lines {
        match line.parse::<LockEntry>() {
            Ok(e) if e.to_string() == line => round_trips += 1,
            Ok(e) => errors.push(format!("mismatch: {e}")),
            Err(err) => errors.push(format!("error: {err}")),
        }
    }
    println!("round-trip {round_trips}/{}; {}", lines.len(), errors.join("; "));
}
```

<solution>
```rust
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone, PartialEq)]
struct LockEntry { name: String, source: Source, hash: Option<String> }

impl fmt::Display for Source {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Source::Git { url, rev } => write!(f, "git:{url}@{rev}"),
            Source::Local(path) => write!(f, "local:{path}"),
        }
    }
}

impl fmt::Display for LockEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} {} {}", self.name, self.source, self.hash.as_deref().unwrap_or("-"))
    }
}

impl FromStr for Source {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if let Some(rest) = s.strip_prefix("git:") {
            let (url, rev) = rest.rsplit_once('@').ok_or_else(|| format!("git source {s} has no @rev"))?;
            Ok(Source::Git { url: url.to_string(), rev: rev.to_string() })
        } else if let Some(path) = s.strip_prefix("local:") {
            Ok(Source::Local(path.to_string()))
        } else {
            Err(format!("unknown source {s}"))
        }
    }
}

impl FromStr for LockEntry {
    type Err = String;
    fn from_str(line: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = line.split_whitespace().collect();
        let [name, source, hash] = parts.as_slice() else {
            return Err(format!("expected 3 fields, got {}", parts.len()));
        };
        Ok(LockEntry {
            name: name.to_string(),
            source: source.parse()?,
            hash: if *hash == "-" { None } else { Some(hash.to_string()) },
        })
    }
}

fn main() {
    let lines = [
        "rust git:github.com/acme/skills@a1b2 sha256:9f2c",
        "py local:./skills/py -",
        "zig git:gitlab.com/me/x@y@ff00 sha256:1234",
        "go svn:old/repo sha256:0000",
        "c git:github.com/acme/skills sha256:1",
    ];
    let mut round_trips = 0;
    let mut errors = Vec::new();
    for line in lines {
        match line.parse::<LockEntry>() {
            Ok(e) if e.to_string() == line => round_trips += 1,
            Ok(e) => errors.push(format!("mismatch: {e}")),
            Err(err) => errors.push(format!("error: {err}")),
        }
    }
    println!("round-trip {round_trips}/{}; {}", lines.len(), errors.join("; "));
}
```
:::

::: only level="+++"
## Bedrock: mini-hlock from scratch
:::

::: exercise id="cap-bedrock-parse" kind="code" level="+++" concepts="structs,enums,result_option,error_handling,traits" difficulty="5" check="exact:v1: 3 skills [ai, py, rust]; error: unsupported lock version 2; error: line 4: expected key = value; error: skill py is missing field 'path'; error: line 4: unknown source svn:old/repo" hints="Keep a draft of the section you're in, with every field an Option, and turn it into a real skill when the next `[skill.*]` header or the end of the text closes it. That's where missing-field errors come from|`enumerate()` the raw lines so the numbers count blanks and comments, `split_once` on = for key = value, and strip the quotes with `trim_matches`|A `BTreeMap<String, LockedSkill>` gives the sorted names for free, and one `Display` impl on your error enum gives every error message"
**Bedrock, part 1: the parser.** No starter types and no hints on this pass. Design
`Source`, a locked skill, a `Lockfile` and an error enum yourself, then write
`parse_lock(text) -> Result<Lockfile, YourError>` for this fictional, TOML-ish
`harness.lock`:

- Lines are trimmed. Blank lines and `#` comments are skipped, but they still count
  toward line numbers, which start at 1.
- `version = N` comes before any section. Any version other than 1 is an error:
  `unsupported lock version N`.
- `[skill.NAME]` opens a section. Inside it, `source = "..."` (`git:<url>@<rev>` or
  `local:<path>`) and `path = "..."` are required, and `hash = "..."` is optional.
- A line that isn't a header and has no `=` gives `line N: expected key = value`. A bad
  source gives `line N: unknown source S`. A section that closes without a required
  field gives `skill NAME is missing field 'FIELD'`.
- Skills are kept sorted by name.

For each of the five texts in `main`, print `vV: N skills [a, b, c]` or `error: <msg>`,
all on one line joined by `; `. Expected output:
`v1: 3 skills [ai, py, rust]; error: unsupported lock version 2; error: line 4: expected key = value; error: skill py is missing field 'path'; error: line 4: unknown source svn:old/repo`

```rust
// Spec-only. Design the types, the error enum and the parser yourself.

fn main() {
    let good = "# harness.lock\nversion = 1\n\n[skill.rust]\nsource = \"git:github.com/acme/skills@a1b2\"\npath = \"skills/rust.md\"\nhash = \"fnv1a:e79b4b08\"\n\n[skill.py]\nsource = \"local:./skills/py\"\npath = \"skills/py.md\"\n\n[skill.ai]\nsource = \"local:./skills/ai\"\npath = \"AGENTS.md\"\n";
    let future = "version = 2\n[skill.rust]\nsource = \"local:x\"\npath = \"x.md\"\n";
    let typo = "version = 1\n\n[skill.rust]\nsource \"git:github.com/acme/skills@a1b2\"\n";
    let no_path = "version = 1\n[skill.py]\nsource = \"local:./skills/py\"\n[skill.rust]\nsource = \"local:x\"\npath = \"x.md\"\n";
    let bad_source = "version = 1\n[skill.go]\npath = \"skills/go.md\"\nsource = \"svn:old/repo\"\n";
    let _ = [good, future, typo, no_path, bad_source];
    todo!("parse each text and print one summary line")
}
```

<solution>
```rust
use std::collections::BTreeMap;
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone)]
struct LockedSkill {
    source: Source,
    path: String,
    hash: Option<String>,
}

#[derive(Debug)]
struct Lockfile {
    version: u32,
    skills: BTreeMap<String, LockedSkill>,
}

#[derive(Debug)]
enum LockError {
    Syntax { line: usize, msg: String },
    Version(u32),
    MissingField { skill: String, field: &'static str },
}

impl fmt::Display for LockError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LockError::Syntax { line, msg } => write!(f, "line {line}: {msg}"),
            LockError::Version(v) => write!(f, "unsupported lock version {v}"),
            LockError::MissingField { skill, field } => write!(f, "skill {skill} is missing field '{field}'"),
        }
    }
}

fn parse_source(s: &str) -> Option<Source> {
    if let Some(rest) = s.strip_prefix("git:") {
        let (url, rev) = rest.rsplit_once('@')?;
        Some(Source::Git { url: url.to_string(), rev: rev.to_string() })
    } else {
        s.strip_prefix("local:").map(|p| Source::Local(p.to_string()))
    }
}

// A section being filled in: every field is optional until the section closes.
#[derive(Default)]
struct Draft {
    name: String,
    source: Option<Source>,
    path: Option<String>,
    hash: Option<String>,
}

fn finish(d: Draft, skills: &mut BTreeMap<String, LockedSkill>) -> Result<(), LockError> {
    let missing = |field| LockError::MissingField { skill: d.name.clone(), field };
    let source = d.source.clone().ok_or_else(|| missing("source"))?;
    let path = d.path.clone().ok_or_else(|| missing("path"))?;
    skills.insert(d.name.clone(), LockedSkill { source, path, hash: d.hash });
    Ok(())
}

fn parse_lock(text: &str) -> Result<Lockfile, LockError> {
    let mut version = None;
    let mut skills = BTreeMap::new();
    let mut cur: Option<Draft> = None;
    for (i, raw) in text.lines().enumerate() {
        let line_no = i + 1;
        let syntax = |msg: String| LockError::Syntax { line: line_no, msg };
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(name) = line.strip_prefix("[skill.").and_then(|r| r.strip_suffix(']')) {
            if let Some(d) = cur.take() {
                finish(d, &mut skills)?;
            }
            cur = Some(Draft { name: name.to_string(), ..Default::default() });
            continue;
        }
        let (key, value) = line.split_once('=').ok_or_else(|| syntax(String::from("expected key = value")))?;
        let (key, value) = (key.trim(), value.trim().trim_matches('"'));
        match (key, cur.as_mut()) {
            ("version", None) => {
                let v: u32 = value.parse().map_err(|_| syntax(format!("bad version {value}")))?;
                if v != 1 {
                    return Err(LockError::Version(v));
                }
                version = Some(v);
            }
            ("source", Some(d)) => {
                d.source = Some(parse_source(value).ok_or_else(|| syntax(format!("unknown source {value}")))?)
            }
            ("path", Some(d)) => d.path = Some(value.to_string()),
            ("hash", Some(d)) => d.hash = Some(value.to_string()),
            (k, _) => return Err(syntax(format!("unexpected key {k}"))),
        }
    }
    if let Some(d) = cur.take() {
        finish(d, &mut skills)?;
    }
    let version = version.ok_or(LockError::Syntax { line: 1, msg: String::from("missing version") })?;
    Ok(Lockfile { version, skills })
}

fn summary(text: &str) -> String {
    match parse_lock(text) {
        Ok(lock) => {
            let names: Vec<&str> = lock.skills.keys().map(|k| k.as_str()).collect();
            format!("v{}: {} skills [{}]", lock.version, names.len(), names.join(", "))
        }
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let good = "# harness.lock\nversion = 1\n\n[skill.rust]\nsource = \"git:github.com/acme/skills@a1b2\"\npath = \"skills/rust.md\"\nhash = \"fnv1a:e79b4b08\"\n\n[skill.py]\nsource = \"local:./skills/py\"\npath = \"skills/py.md\"\n\n[skill.ai]\nsource = \"local:./skills/ai\"\npath = \"AGENTS.md\"\n";
    let future = "version = 2\n[skill.rust]\nsource = \"local:x\"\npath = \"x.md\"\n";
    let typo = "version = 1\n\n[skill.rust]\nsource \"git:github.com/acme/skills@a1b2\"\n";
    let no_path = "version = 1\n[skill.py]\nsource = \"local:./skills/py\"\n[skill.rust]\nsource = \"local:x\"\npath = \"x.md\"\n";
    let bad_source = "version = 1\n[skill.go]\npath = \"skills/go.md\"\nsource = \"svn:old/repo\"\n";
    let out: Vec<String> = [good, future, typo, no_path, bad_source].iter().map(|t| summary(t)).collect();
    println!("{}", out.join("; "));
}
```
:::

::: exercise id="cap-bedrock" kind="code" level="+++" concepts="structs,enums,iterators,result_option,error_handling,traits,expression" difficulty="5" check="exact:v1: ai ok; go MISSING skills/go.md; py UNHASHED; rust ok; zig DRIFT fnv1a:00000000 != fnv1a:0ea0014b -- 2/5 verified, exit 1 // error: line 3: unknown source svn:old/repo -- exit 2" hints="Reuse stage 1 unchanged and add a `Status` enum with one variant per outcome, plus a `Display` impl that prints the exact text of each variant|Check the outcomes in order for each skill: no hash, then the path isn't on disk, then the hash differs. `let ... else` and `disk.get(...)` keep it flat|Map the BTreeMap of skills to (name, Status) pairs, count the ok ones with `matches!`, and make the exit code 0 only when all of them verify. A parse error short-circuits to exit 2"
**Bedrock, part 2: `hlock check`.** Build the whole mini-hlock: parse the lock
file, then **verify** every skill against the files on "disk" (the `disk` map, path to
content).

- Hash = FNV-1a 32-bit of the content's bytes: `h = 0x811c9dc5`, then for each byte
  `h ^= byte` and `h = h.wrapping_mul(0x01000193)`. Print it as `fnv1a:` plus 8
  lowercase hex digits.
- Each skill's status, checked in this order: no `hash` gives `UNHASHED`; `path` not on
  disk gives `MISSING <path>`; a different hash gives `DRIFT <locked> != <actual>`;
  otherwise `ok`.
- A `check(text, disk) -> String` returns `vV: name STATUS; ...` (sorted by name), then
  ` -- K/N verified, exit E`, where E is 0 if every skill is ok and 1 otherwise. If the
  lock doesn't parse, it returns `error: <msg> -- exit 2`.
- `main` prints `check(lock)` and `check(broken)` on one line, separated by ` // `.

Expected output:
`v1: ai ok; go MISSING skills/go.md; py UNHASHED; rust ok; zig DRIFT fnv1a:00000000 != fnv1a:0ea0014b -- 2/5 verified, exit 1 // error: line 3: unknown source svn:old/repo -- exit 2`

```rust
// Spec-only: the whole mini-hlock. Reuse your parser from the last stage.
use std::collections::BTreeMap;

fn main() {
    let lock = r#"# harness.lock (generated by mini-hlock; do not edit)
version = 1

[skill.rust]
source = "git:github.com/acme/skills@a1b2"
path = "skills/rust.md"
hash = "fnv1a:e79b4b08"

[skill.zig]
source = "git:github.com/acme/skills@ff00"
path = "skills/zig.md"
hash = "fnv1a:00000000"

[skill.py]
source = "local:./skills/py"
path = "skills/py.md"

[skill.go]
source = "local:./skills/go"
path = "skills/go.md"
hash = "fnv1a:8a9608e6"

[skill.ai]
source = "local:./skills/ai"
path = "AGENTS.md"
hash = "fnv1a:4039d7e2"
"#;
    let broken = "version = 1\n[skill.rust]\nsource = \"svn:old/repo\"\n";
    let disk: BTreeMap<&str, &str> = [
        ("skills/rust.md", "own it"),
        ("skills/zig.md", "comptime"),
        ("skills/py.md", "import this"),
        ("AGENTS.md", "be kind"),
    ]
    .into_iter()
    .collect();
    let _ = (lock, broken, disk);
    todo!("parse, verify against disk, report")
}
```

<solution>
```rust
use std::collections::BTreeMap;
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
enum Source {
    Git { url: String, rev: String },
    Local(String),
}

#[derive(Debug, Clone)]
struct LockedSkill {
    source: Source,
    path: String,
    hash: Option<String>,
}

#[derive(Debug)]
struct Lockfile {
    version: u32,
    skills: BTreeMap<String, LockedSkill>,
}

#[derive(Debug)]
enum LockError {
    Syntax { line: usize, msg: String },
    Version(u32),
    MissingField { skill: String, field: &'static str },
}

impl fmt::Display for LockError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LockError::Syntax { line, msg } => write!(f, "line {line}: {msg}"),
            LockError::Version(v) => write!(f, "unsupported lock version {v}"),
            LockError::MissingField { skill, field } => write!(f, "skill {skill} is missing field '{field}'"),
        }
    }
}

fn parse_source(s: &str) -> Option<Source> {
    if let Some(rest) = s.strip_prefix("git:") {
        let (url, rev) = rest.rsplit_once('@')?;
        Some(Source::Git { url: url.to_string(), rev: rev.to_string() })
    } else {
        s.strip_prefix("local:").map(|p| Source::Local(p.to_string()))
    }
}

// A section being filled in: every field is optional until the section closes.
#[derive(Default)]
struct Draft {
    name: String,
    source: Option<Source>,
    path: Option<String>,
    hash: Option<String>,
}

fn finish(d: Draft, skills: &mut BTreeMap<String, LockedSkill>) -> Result<(), LockError> {
    let missing = |field| LockError::MissingField { skill: d.name.clone(), field };
    let source = d.source.clone().ok_or_else(|| missing("source"))?;
    let path = d.path.clone().ok_or_else(|| missing("path"))?;
    skills.insert(d.name.clone(), LockedSkill { source, path, hash: d.hash });
    Ok(())
}

fn parse_lock(text: &str) -> Result<Lockfile, LockError> {
    let mut version = None;
    let mut skills = BTreeMap::new();
    let mut cur: Option<Draft> = None;
    for (i, raw) in text.lines().enumerate() {
        let line_no = i + 1;
        let syntax = |msg: String| LockError::Syntax { line: line_no, msg };
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(name) = line.strip_prefix("[skill.").and_then(|r| r.strip_suffix(']')) {
            if let Some(d) = cur.take() {
                finish(d, &mut skills)?;
            }
            cur = Some(Draft { name: name.to_string(), ..Default::default() });
            continue;
        }
        let (key, value) = line.split_once('=').ok_or_else(|| syntax(String::from("expected key = value")))?;
        let (key, value) = (key.trim(), value.trim().trim_matches('"'));
        match (key, cur.as_mut()) {
            ("version", None) => {
                let v: u32 = value.parse().map_err(|_| syntax(format!("bad version {value}")))?;
                if v != 1 {
                    return Err(LockError::Version(v));
                }
                version = Some(v);
            }
            ("source", Some(d)) => {
                d.source = Some(parse_source(value).ok_or_else(|| syntax(format!("unknown source {value}")))?)
            }
            ("path", Some(d)) => d.path = Some(value.to_string()),
            ("hash", Some(d)) => d.hash = Some(value.to_string()),
            (k, _) => return Err(syntax(format!("unexpected key {k}"))),
        }
    }
    if let Some(d) = cur.take() {
        finish(d, &mut skills)?;
    }
    let version = version.ok_or(LockError::Syntax { line: 1, msg: String::from("missing version") })?;
    Ok(Lockfile { version, skills })
}

fn fnv1a(data: &[u8]) -> String {
    let mut h: u32 = 0x811c9dc5;
    for b in data {
        h ^= *b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    format!("fnv1a:{h:08x}")
}

enum Status {
    Ok,
    Unhashed,
    Missing(String),
    Drift { locked: String, actual: String },
}

impl fmt::Display for Status {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Status::Ok => write!(f, "ok"),
            Status::Unhashed => write!(f, "UNHASHED"),
            Status::Missing(p) => write!(f, "MISSING {p}"),
            Status::Drift { locked, actual } => write!(f, "DRIFT {locked} != {actual}"),
        }
    }
}

fn verify(skill: &LockedSkill, disk: &BTreeMap<&str, &str>) -> Status {
    let Some(locked) = &skill.hash else { return Status::Unhashed };
    match disk.get(skill.path.as_str()) {
        None => Status::Missing(skill.path.clone()),
        Some(body) => {
            let actual = fnv1a(body.as_bytes());
            if &actual == locked { Status::Ok } else { Status::Drift { locked: locked.clone(), actual } }
        }
    }
}

fn check(text: &str, disk: &BTreeMap<&str, &str>) -> String {
    let lock = match parse_lock(text) {
        Ok(l) => l,
        Err(e) => return format!("error: {e} -- exit 2"),
    };
    let results: Vec<(String, Status)> =
        lock.skills.iter().map(|(name, s)| (name.clone(), verify(s, disk))).collect();
    let ok = results.iter().filter(|(_, s)| matches!(s, Status::Ok)).count();
    let lines: Vec<String> = results.iter().map(|(n, s)| format!("{n} {s}")).collect();
    let exit = if ok == results.len() { 0 } else { 1 };
    format!("v{}: {} -- {ok}/{} verified, exit {exit}", lock.version, lines.join("; "), results.len())
}

fn main() {
    let lock = r#"# harness.lock (generated by mini-hlock; do not edit)
version = 1

[skill.rust]
source = "git:github.com/acme/skills@a1b2"
path = "skills/rust.md"
hash = "fnv1a:e79b4b08"

[skill.zig]
source = "git:github.com/acme/skills@ff00"
path = "skills/zig.md"
hash = "fnv1a:00000000"

[skill.py]
source = "local:./skills/py"
path = "skills/py.md"

[skill.go]
source = "local:./skills/go"
path = "skills/go.md"
hash = "fnv1a:8a9608e6"

[skill.ai]
source = "local:./skills/ai"
path = "AGENTS.md"
hash = "fnv1a:4039d7e2"
"#;
    let broken = "version = 1\n[skill.rust]\nsource = \"svn:old/repo\"\n";
    let disk: BTreeMap<&str, &str> = [
        ("skills/rust.md", "own it"),
        ("skills/zig.md", "comptime"),
        ("skills/py.md", "import this"),
        ("AGENTS.md", "be kind"),
    ]
    .into_iter()
    .collect();
    println!("{} // {}", check(lock, &disk), check(broken, &disk));
}
```
:::

::: only level="++"
### Splunker's notes: what you just rebuilt

- **Parse, don't validate.** Each checkpoint turns loose text into a type (`Source`,
  `LockEntry`) at the edge, so the rest of the code never sees a malformed line. Real
  hlock does the same with serde: `harness.toml` becomes `manifest.rs` structs, or you
  get an `Error::Toml`.
- **Errors carry context.** `line 3: unknown source ...` is a `Manifest` error with a
  position. Line numbers that count comments are what make an error actionable.
- **Round-trip is a test you get for free.** Once `Display` and `FromStr` are inverses,
  `parse(x).to_string() == x` checks both at once. That is the lock-file version of
  hash.rs's determinism test.
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
