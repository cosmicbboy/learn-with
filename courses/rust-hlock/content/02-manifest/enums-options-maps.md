---
title: "enums, Option, and maps — modeling a config tree"
concepts: [enums, collections, serde]
objectives:
  - Define an enum and know its alternatives
  - Use BTreeMap and Option the way hlock's manifest does
---

## Enums: a closed set of choices

An **enum** says "this value is *one* of a fixed list of alternatives." Unlike Python's
loose strings, Rust enums are exhaustive and type-safe. From hlock's manifest, the
harness candidates are one of several kinds — a perfect enum shape:

```rust
enum HarnessKind {
    Cli,
    Server,
    Library,
}
```

Splunkers meet three enums constantly: `Option` (`Some`/`None`), `Result`
(`Ok`/`Err`), and the many project-specific ones. Because they're *exhaustive*, a
`match` must cover every arm or the compiler complains — which means you can't forget a
case.

::: callout type="contrast" lang="python"
**For the Pythonista.** Python enums (or string constants) allow any string; a typo like
`"cli"` vs `"Cli"` is a runtime surprise. In Rust an unknown variant is a *compile-time
error*. Pain now, safety forever.
:::

## BTreeMap — a sorted, ordered map

hlock's `Objective` uses `BTreeMap<String, String>` for `constraints`. A `BTreeMap` is a
map like Python's `dict` or a JS `Map`, but **keeps keys in sorted order**, which makes
output deterministic (great for lockfiles that get committed to git!).

| | behavior |
|---|---|
| `HashMap<K,V>` | fast lookup, unordered (like a Python `dict`) |
| `BTreeMap<K,V>` | ordered by key (like a sorted dict) |

::: callout type="challenge"
Why does a lockfile writer care about ordering? A `HashMap` iterates in *arbitrary*
order per run, so hashing it would produce different bytes every time. hlock wants
cryptographically **deterministic** output for git — hence `BTreeMap` and the sorted
canonical-JSON code in `hash.rs`. Ordering bugs are a whole class of bug HashMaps hide.
:::

## `Option` inside maps: "key may be missing"

`BTreeMap::get` returns `Option<&V>` — it's `None` if the key isn't there. This is the
*only* way Rust lets you look something up, and it forces you to handle absence:

```rust
let mut m = std::collections::BTreeMap::new();
m.insert(String::from("select"), String::from("min-cost"));
match m.get("select") {
    Some(v) => println!("select = {v}"),
    None => println!("no select key"),
}
```

::: exercise id="map-lookup" kind="code" concepts="collections,result_option" difficulty="2" check="exact:found min-cost" hints="`m.get(...)` returns an `Option<&String>`, so the `match` needs one arm for each `Option` variant|One arm is `Some(v) => ...` and the other is `None => ...`|Print `found {v}` in the `Some` arm and `missing` in the `None` arm, then delete the `_ => todo!()` line"
Replace the placeholder `_ => todo!()` arm with real `Some(v)` and `None` arms, like the
example above. The program should print exactly `found min-cost`.

```rust
use std::collections::BTreeMap;

fn main() {
    let mut m = BTreeMap::new();
    m.insert(String::from("select"), String::from("min-cost"));
    match m.get("select") {
        // TODO: a Some(v) arm that prints found {v}
        // TODO: a None arm that prints missing
        _ => todo!(),
    }
}
```

<solution>
```rust
use std::collections::BTreeMap;

fn main() {
    let mut m = BTreeMap::new();
    m.insert(String::from("select"), String::from("min-cost"));
    match m.get("select") {
        Some(v) => println!("found {v}"),
        None => println!("missing"),
    }
}
```
:::

::: exercise id="map-lookup" kind="code" level="+" concepts="collections,result_option" difficulty="3" check="exact:region=default-region; retries=3,select=min-cost,timeout=30s" hints="`insert` overwrites an existing value. To add a default only when a key is missing, use `c.entry(key).or_insert(value)`|`c.get(k)` gives an `Option<&String>`. Turn it into an `Option<&str>` with `.map(String::as_str)`, then supply the fallback with `unwrap_or`|For the pairs, `c.iter()` already walks keys in sorted order: map each `(k, v)` to `format!(...)` with the template `{k}={v}`, collect into a `Vec<String>`, and `join` them with a comma"
Apply hlock-style defaults to a constraints map **without clobbering** what the user set:
`retries` should become `3` because it's missing, but `select` must stay `min-cost`. Then
look up `region` with a fallback of `default-region`, and print every pair as `k=v` joined by
commas, in key order. Expected output:
`region=default-region; retries=3,select=min-cost,timeout=30s`.

```rust
use std::collections::BTreeMap;

fn main() {
    let mut c: BTreeMap<String, String> = BTreeMap::new();
    c.insert(String::from("timeout"), String::from("30s"));
    c.insert(String::from("select"), String::from("min-cost"));

    let defaults = [("retries", "3"), ("select", "first")];
    for (k, v) in defaults {
        todo!("add k = v only if k is missing");
    }
    let region: &str = todo!("c's region, or default-region");
    let pairs: Vec<String> = todo!("k=v for every entry, in key order");
    println!("region={region}; {}", pairs.join(","));
}
```

<solution>
```rust
use std::collections::BTreeMap;

fn main() {
    let mut c: BTreeMap<String, String> = BTreeMap::new();
    c.insert(String::from("timeout"), String::from("30s"));
    c.insert(String::from("select"), String::from("min-cost"));

    let defaults = [("retries", "3"), ("select", "first")];
    for (k, v) in defaults {
        c.entry(k.to_string()).or_insert(v.to_string());
    }
    let region: &str = c.get("region").map(String::as_str).unwrap_or("default-region");
    let pairs: Vec<String> = c.iter().map(|(k, v)| format!("{k}={v}")).collect();
    println!("region={region}; {}", pairs.join(","));
}
```
:::

::: exercise id="map-lookup" kind="code" level="++" concepts="collections,result_option" difficulty="4" check="exact:max-cost=5,select=min-cost cap=Some(5.0) / max-cost=cheap cap=None / error: duplicate constraint select / error: bad constraint select" hints="Split on `;`, trim each part, and skip empty parts so a trailing `;` is harmless. `split_once('=')` returns an `Option`, and `ok_or_else` plus `?` turns a `None` into your error|Check `contains_key` before inserting (or match on `entry`) so a repeated key is an error instead of a silent overwrite|`max_cost` is `obj.constraints.get(...)` followed by `and_then`, which parses the value with `.parse().ok()`, so a non-numeric value becomes `None` instead of an error"
`Objective` is shaped like hlock's: a name plus `constraints: BTreeMap<String, String>`.
Constraints arrive as a messy `k = v; k = v;` string. Write `parse_constraints`, which trims
spaces, ignores empty segments, gives `Err("bad constraint <seg>")` for a segment with no
`=`, and gives `Err("duplicate constraint <key>")` for a repeated key. Then write `max_cost`,
a *typed* lookup that is `None` when the key is missing **or** when the value isn't a number.
Expected output:
`max-cost=5,select=min-cost cap=Some(5.0) / max-cost=cheap cap=None / error: duplicate constraint select / error: bad constraint select`.

```rust
use std::collections::BTreeMap;

#[derive(Debug, Default)]
pub struct Objective {
    pub name: String,
    pub constraints: BTreeMap<String, String>,
}

fn parse_constraints(src: &str) -> Result<BTreeMap<String, String>, String> {
    todo!("split on ;, then on =, rejecting junk and duplicates")
}

fn max_cost(obj: &Objective) -> Option<f64> {
    todo!("the max-cost constraint as a number, if it is one")
}

fn show(src: &str) -> String {
    match parse_constraints(src) {
        Ok(constraints) => {
            let obj = Objective { name: String::from("min-cost-search"), constraints };
            let pairs: Vec<String> = obj.constraints.iter().map(|(k, v)| format!("{k}={v}")).collect();
            format!("{} cap={:?}", pairs.join(","), max_cost(&obj))
        }
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let inputs = ["select = min-cost; max-cost = 5;", "max-cost=cheap", "select=a;select=b", "select"];
    let out: Vec<String> = inputs.iter().map(|s| show(s)).collect();
    println!("{}", out.join(" / "));
}
```

<solution>
```rust
use std::collections::BTreeMap;

#[derive(Debug, Default)]
pub struct Objective {
    pub name: String,
    pub constraints: BTreeMap<String, String>,
}

fn parse_constraints(src: &str) -> Result<BTreeMap<String, String>, String> {
    let mut out = BTreeMap::new();
    for part in src.split(';').map(str::trim).filter(|p| !p.is_empty()) {
        let (k, v) = part.split_once('=').ok_or_else(|| format!("bad constraint {part}"))?;
        let k = k.trim().to_string();
        if out.contains_key(&k) {
            return Err(format!("duplicate constraint {k}"));
        }
        out.insert(k, v.trim().to_string());
    }
    Ok(out)
}

fn max_cost(obj: &Objective) -> Option<f64> {
    obj.constraints.get("max-cost").and_then(|v| v.parse().ok())
}

fn show(src: &str) -> String {
    match parse_constraints(src) {
        Ok(constraints) => {
            let obj = Objective { name: String::from("min-cost-search"), constraints };
            let pairs: Vec<String> = obj.constraints.iter().map(|(k, v)| format!("{k}={v}")).collect();
            format!("{} cap={:?}", pairs.join(","), max_cost(&obj))
        }
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    let inputs = ["select = min-cost; max-cost = 5;", "max-cost=cheap", "select=a;select=b", "select"];
    let out: Vec<String> = inputs.iter().map(|s| show(s)).collect();
    println!("{}", out.join(" / "));
}
```
:::

## Your turn: an enum for harness kinds

::: exercise id="enum-match-practice" kind="code" concepts="enums,pattern_matching" difficulty="2" check="exact:cli is local-first; server is remote; library is embeddable" hints="Run it: the `todo!()` panics, so each arm needs a real message|Replace the `_` wildcard with one arm per remaining variant, written as `HarnessKind::Server => ...` and `HarnessKind::Library => ...`|The `Cli` arm should produce the string `cli is local-first`, and the other two get `server is remote` and `library is embeddable`"
The `HarnessKind` enum has `Cli`, `Server`, and `Library` variants, but the `match` in
`describe` is still a scaffold of `todo!()`s and a `_` wildcard. Give `Cli` the message
`cli is local-first`, and replace the wildcard with explicit `Server` (`server is remote`)
and `Library` (`library is embeddable`) arms. `main` describes all three kinds, so the
program should print exactly
`cli is local-first; server is remote; library is embeddable`.

```rust
enum HarnessKind {
    Cli,
    Server,
    Library,
}

fn describe(k: HarnessKind) -> &'static str {
    match k {
        HarnessKind::Cli => todo!(), // TODO: the cli message
        // TODO: replace this wildcard with HarnessKind::Server and HarnessKind::Library arms
        _ => todo!(),
    }
}

fn main() {
    let cli = describe(HarnessKind::Cli);
    let server = describe(HarnessKind::Server);
    let library = describe(HarnessKind::Library);
    println!("{cli}; {server}; {library}");
}
```

<solution>
```rust
enum HarnessKind {
    Cli,
    Server,
    Library,
}

fn describe(k: HarnessKind) -> &'static str {
    match k {
        HarnessKind::Cli => "cli is local-first",
        HarnessKind::Server => "server is remote",
        HarnessKind::Library => "library is embeddable",
    }
}

fn main() {
    let cli = describe(HarnessKind::Cli);
    let server = describe(HarnessKind::Server);
    let library = describe(HarnessKind::Library);
    println!("{cli}; {server}; {library}");
}
```
:::

::: exercise id="enum-match-practice" kind="code" level="+" concepts="enums,pattern_matching" difficulty="3" check="exact:cli is local-first; server on port 8080; server needs a real port; unknown kind daemon; library is embeddable" hints="Match on `parse_kind(input)` directly. The patterns can reach *through* the `Option` into the enum, as in `Some(HarnessKind::Cli)`|Arms are tried top to bottom, so put `Some(HarnessKind::Server { port: 0 })` before the general `Some(HarnessKind::Server { port })`|The last arm is `None => format!(...)` with the template `unknown kind {input}`. There's no wildcard, so the compiler checks that you covered every variant"
Now `Server` carries data (`port`), and kinds arrive as strings, so a lookup can fail.
`parse_kind` is written for you. Write `describe` as **one `match` on
`parse_kind(input)`**, with nested patterns and no `_` wildcard and no `if let`. A port of
`0` gets its own message. Expected output:
`cli is local-first; server on port 8080; server needs a real port; unknown kind daemon; library is embeddable`.

```rust
enum HarnessKind {
    Cli,
    Server { port: u16 },
    Library,
}

fn parse_kind(s: &str) -> Option<HarnessKind> {
    match s.split_once(':') {
        Some(("server", port)) => port.parse().ok().map(|port| HarnessKind::Server { port }),
        None if s == "cli" => Some(HarnessKind::Cli),
        None if s == "library" => Some(HarnessKind::Library),
        _ => None,
    }
}

fn describe(input: &str) -> String {
    todo!("one match on parse_kind(input), with nested patterns")
}

fn main() {
    let inputs = ["cli", "server:8080", "server:0", "daemon", "library"];
    let out: Vec<String> = inputs.iter().map(|s| describe(s)).collect();
    println!("{}", out.join("; "));
}
```

<solution>
```rust
enum HarnessKind {
    Cli,
    Server { port: u16 },
    Library,
}

fn parse_kind(s: &str) -> Option<HarnessKind> {
    match s.split_once(':') {
        Some(("server", port)) => port.parse().ok().map(|port| HarnessKind::Server { port }),
        None if s == "cli" => Some(HarnessKind::Cli),
        None if s == "library" => Some(HarnessKind::Library),
        _ => None,
    }
}

fn describe(input: &str) -> String {
    match parse_kind(input) {
        Some(HarnessKind::Cli) => String::from("cli is local-first"),
        Some(HarnessKind::Server { port: 0 }) => String::from("server needs a real port"),
        Some(HarnessKind::Server { port }) => format!("server on port {port}"),
        Some(HarnessKind::Library) => String::from("library is embeddable"),
        None => format!("unknown kind {input}"),
    }
}

fn main() {
    let inputs = ["cli", "server:8080", "server:0", "daemon", "library"];
    let out: Vec<String> = inputs.iter().map(|s| describe(s)).collect();
    println!("{}", out.join("; "));
}
```
:::

::: exercise id="enum-match-practice" kind="code" level="++" concepts="enums,pattern_matching,collections" difficulty="4" check="exact:npx -y fs-server; serena (no args); https://mcp.example/sse [auth redacted]; https://mcp.example/open" hints="Match on `s` with struct-variant patterns such as `McpServer::Stdio { command, args }`. A match guard (`if args.is_empty()`) on an earlier arm handles the no-args case|Header names are case-insensitive, so `headers.get(...)` with a lowercase key misses `Authorization`. Search the keys with `eq_ignore_ascii_case` instead|For Http, compute `let authed = headers.keys().any(...)`, then return the URL with ` [auth redacted]` appended when `authed` is true. Never print the token itself"
hlock pins the MCP servers a harness uses. This enum is shaped like a manifest entry for one:
either a local `Stdio` process or a remote `Http` endpoint with headers. Write `launch_line`.
A stdio server prints its command and args separated by spaces, or `<command> (no args)` when
there are none. An HTTP server prints its URL and appends ` [auth redacted]` when it has an
`authorization` header **in any letter case**. The secret itself must never be printed.
Expected output:
`npx -y fs-server; serena (no args); https://mcp.example/sse [auth redacted]; https://mcp.example/open`.

```rust
use std::collections::BTreeMap;

enum McpServer {
    Stdio { command: String, args: Vec<String> },
    Http { url: String, headers: BTreeMap<String, String> },
}

fn launch_line(s: &McpServer) -> String {
    todo!("match every variant; redact auth")
}

fn main() {
    let mut authed = BTreeMap::new();
    authed.insert(String::from("Authorization"), String::from("Bearer sk-secret"));
    let mut plain = BTreeMap::new();
    plain.insert(String::from("accept"), String::from("text/event-stream"));

    let servers = vec![
        McpServer::Stdio { command: String::from("npx"), args: vec![String::from("-y"), String::from("fs-server")] },
        McpServer::Stdio { command: String::from("serena"), args: vec![] },
        McpServer::Http { url: String::from("https://mcp.example/sse"), headers: authed },
        McpServer::Http { url: String::from("https://mcp.example/open"), headers: plain },
    ];
    let lines: Vec<String> = servers.iter().map(launch_line).collect();
    println!("{}", lines.join("; "));
}
```

<solution>
```rust
use std::collections::BTreeMap;

enum McpServer {
    Stdio { command: String, args: Vec<String> },
    Http { url: String, headers: BTreeMap<String, String> },
}

fn launch_line(s: &McpServer) -> String {
    match s {
        McpServer::Stdio { command, args } if args.is_empty() => format!("{command} (no args)"),
        McpServer::Stdio { command, args } => format!("{command} {}", args.join(" ")),
        McpServer::Http { url, headers } => {
            let authed = headers.keys().any(|k| k.eq_ignore_ascii_case("authorization"));
            if authed {
                format!("{url} [auth redacted]")
            } else {
                url.clone()
            }
        }
    }
}

fn main() {
    let mut authed = BTreeMap::new();
    authed.insert(String::from("Authorization"), String::from("Bearer sk-secret"));
    let mut plain = BTreeMap::new();
    plain.insert(String::from("accept"), String::from("text/event-stream"));

    let servers = vec![
        McpServer::Stdio { command: String::from("npx"), args: vec![String::from("-y"), String::from("fs-server")] },
        McpServer::Stdio { command: String::from("serena"), args: vec![] },
        McpServer::Http { url: String::from("https://mcp.example/sse"), headers: authed },
        McpServer::Http { url: String::from("https://mcp.example/open"), headers: plain },
    ];
    let lines: Vec<String> = servers.iter().map(launch_line).collect();
    println!("{}", lines.join("; "));
}
```
:::

::: exercise id="kind-rename" kind="code" level="+" concepts="serde,enums" difficulty="3" check="exact:claude-code,codex,pi roundtrip=true strict=true" hints="`key` is a `match self` with one arm per variant, each returning a string literal|`from_key` can search `ALL` for the variant whose `key()` equals `s`. `iter().copied().find(...)` already returns an `Option`|Don't lowercase or otherwise normalise the input: `ClaudeCode` is the Rust name, not the TOML spelling, so `from_key` has to reject it"
On an enum, `#[serde(rename_all = "kebab-case")]` renames the **variants**, so `ClaudeCode`
is written `claude-code` in TOML. Do it by hand for an enum of the harnesses hlock can pin.
`key` gives the TOML spelling, and `from_key` parses it back. Like serde, `from_key` is
strict, so the Rust spelling `ClaudeCode` is *not* accepted. Expected output:
`claude-code,codex,pi roundtrip=true strict=true`.

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Harness {
    ClaudeCode,
    Codex,
    Pi,
}

const ALL: [Harness; 3] = [Harness::ClaudeCode, Harness::Codex, Harness::Pi];

impl Harness {
    fn key(self) -> &'static str {
        todo!("the kebab-case name of this variant")
    }

    fn from_key(s: &str) -> Option<Harness> {
        todo!("the variant whose key is s, if any")
    }
}

fn main() {
    let keys: Vec<&str> = ALL.iter().map(|h| h.key()).collect();
    let roundtrip = ALL.iter().all(|h| Harness::from_key(h.key()) == Some(*h));
    let strict = Harness::from_key("ClaudeCode").is_none();
    println!("{} roundtrip={roundtrip} strict={strict}", keys.join(","));
}
```

<solution>
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Harness {
    ClaudeCode,
    Codex,
    Pi,
}

const ALL: [Harness; 3] = [Harness::ClaudeCode, Harness::Codex, Harness::Pi];

impl Harness {
    fn key(self) -> &'static str {
        match self {
            Harness::ClaudeCode => "claude-code",
            Harness::Codex => "codex",
            Harness::Pi => "pi",
        }
    }

    fn from_key(s: &str) -> Option<Harness> {
        ALL.iter().copied().find(|h| h.key() == s)
    }
}

fn main() {
    let keys: Vec<&str> = ALL.iter().map(|h| h.key()).collect();
    let roundtrip = ALL.iter().all(|h| Harness::from_key(h.key()) == Some(*h));
    let strict = Harness::from_key("ClaudeCode").is_none();
    println!("{} roundtrip={roundtrip} strict={strict}", keys.join(","));
}
```
:::

::: exercise id="transport-alias" kind="mcq" level="++" concepts="serde,enums" difficulty="4" options="`StreamableHttp`|`streamable-http`|`http`|`stdio`" answer="0" explain="On an enum, `rename_all` renames every *variant*, so `StreamableHttp` is spelled `streamable-http` and `Stdio` is spelled `stdio`. `alias` adds `http` as a second accepted spelling for one variant. Renaming *replaces* the Rust name instead of adding to it, so the original `StreamableHttp` is the only one rejected."
A transport enum shaped like the ones in hlock's manifest:

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum Transport {
    Stdio,
    #[serde(alias = "http")]
    StreamableHttp,
}
```
Which value of `transport = '...'` in `harness.toml` fails to deserialize?
:::

::: exercise id="config-tree-from-scratch" kind="code" level="+++" concepts="enums,collections,serde,result_option,pattern_matching" difficulty="5" check="exact:fs -> npm filesystem-mcp@latest; notes -> local ./notes; serena -> npm serena@0.4.1; skills -> git https://github.com/acme/skills#v1.2 / error: unknown source kind ftp for x / error: git source y needs @rev" hints="Design a `Source` enum with three variants, one of which holds an `Option` for the version. Parsing returns `Result`, and a `BTreeMap<String, Source>` gives you sorted output for free|Split each line on the first `=`, then the spec on the first `:` to get the kind. A git URL contains `:` and `/`, so take the revision with `rsplit_once('@')`. An npm version is optional, so use `split_once('@')` and keep the `None` case"
**Spec only.** Parse a tiny config tree of skill and server sources into a sorted map,
the way serde turns a tagged TOML value into an enum.

- Each non-blank line is `name = kind:spec`. There are three kinds:
  `npm:<package>` or `npm:<package>@<version>` (no version means `latest` when rendered),
  `git:<url>@<rev>` (the rev is **required**), and `local:<path>`.
- Model the source as an enum you design, and collect the tree into a map keyed by name so
  that output is sorted, as hlock's lockfile is.
- Render each entry as `name -> npm pkg@ver`, `name -> git url#rev` or `name -> local path`,
  with entries joined by `; `.
- Errors are `unknown source kind <kind> for <name>` and `git source <name> needs @rev`, each
  printed as `error: ...`.
- Print the results for `TREE`, `BAD_KIND` and `NO_REV`, separated by ` / `.

Expected output:
`fs -> npm filesystem-mcp@latest; notes -> local ./notes; serena -> npm serena@0.4.1; skills -> git https://github.com/acme/skills#v1.2 / error: unknown source kind ftp for x / error: git source y needs @rev`.

```rust
const TREE: &str = "skills = git:https://github.com/acme/skills@v1.2
serena = npm:serena@0.4.1
fs = npm:filesystem-mcp

notes = local:./notes";
const BAD_KIND: &str = "x = ftp:example.com/x";
const NO_REV: &str = "y = git:https://github.com/acme/y";

fn main() {
    todo!("design Source, parse TREE into a sorted map, render, report errors")
}
```

<solution>
```rust
use std::collections::BTreeMap;

const TREE: &str = "skills = git:https://github.com/acme/skills@v1.2
serena = npm:serena@0.4.1
fs = npm:filesystem-mcp

notes = local:./notes";
const BAD_KIND: &str = "x = ftp:example.com/x";
const NO_REV: &str = "y = git:https://github.com/acme/y";

#[derive(Debug, Clone, PartialEq)]
enum Source {
    Npm { package: String, version: Option<String> },
    Git { url: String, rev: String },
    Local(String),
}

impl Source {
    fn parse(name: &str, spec: &str) -> Result<Source, String> {
        let (kind, rest) = spec.split_once(':').ok_or_else(|| format!("{name} has no kind"))?;
        match kind {
            "npm" => Ok(match rest.split_once('@') {
                Some((package, version)) => Source::Npm {
                    package: package.to_string(),
                    version: Some(version.to_string()),
                },
                None => Source::Npm { package: rest.to_string(), version: None },
            }),
            "git" => {
                let (url, rev) = rest
                    .rsplit_once('@')
                    .ok_or_else(|| format!("git source {name} needs @rev"))?;
                Ok(Source::Git { url: url.to_string(), rev: rev.to_string() })
            }
            "local" => Ok(Source::Local(rest.to_string())),
            other => Err(format!("unknown source kind {other} for {name}")),
        }
    }

    fn render(&self) -> String {
        match self {
            Source::Npm { package, version } => {
                format!("npm {package}@{}", version.as_deref().unwrap_or("latest"))
            }
            Source::Git { url, rev } => format!("git {url}#{rev}"),
            Source::Local(path) => format!("local {path}"),
        }
    }
}

fn parse_tree(src: &str) -> Result<BTreeMap<String, Source>, String> {
    let mut tree = BTreeMap::new();
    for line in src.lines().map(str::trim).filter(|l| !l.is_empty()) {
        let (name, spec) = line.split_once('=').ok_or_else(|| format!("bad line {line}"))?;
        let name = name.trim();
        tree.insert(name.to_string(), Source::parse(name, spec.trim())?);
    }
    Ok(tree)
}

fn show(src: &str) -> String {
    match parse_tree(src) {
        Ok(tree) => tree
            .iter()
            .map(|(name, s)| format!("{name} -> {}", s.render()))
            .collect::<Vec<_>>()
            .join("; "),
        Err(e) => format!("error: {e}"),
    }
}

fn main() {
    println!("{} / {} / {}", show(TREE), show(BAD_KIND), show(NO_REV));
}
```
:::


::: only level="++"
**Splunker's notes: how serde spells an enum.** By default serde writes enums *externally
tagged*: a unit variant is just its (renamed) name, as in `transport = "stdio"`, and a variant
with data becomes a one-key table such as `{ http = { url = "..." } }`.
`#[serde(tag = "type")]` makes it *internally tagged*, so the variant name lives in a `type`
field next to the data, which is how most hand-written config files look. `#[serde(untagged)]`
tries each variant in order, which is convenient but produces vague errors. Choose the
representation for the humans who edit `harness.toml`. Then pair every map that ends up in a
lockfile with `BTreeMap`, because a deterministic key order is what makes the lock's hash
stable from one run to the next.
:::

> Notice the `match` produced a *value*: it is the whole body of `describe`, with no
> `return`. And every arm was required — remove the `Library` arm and the compiler refuses
> with E0004 (non-exhaustive patterns). Exhaustiveness is the feature.
