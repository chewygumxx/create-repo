---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/create-repo.git
  # ::: :/docs/plans/2026-10-01-multiple-templates-phase-4.md
  #
  #

ctime: 2026-10-01
title: >-
  Implementation Plan: multiple templates, phase 4
description: ""
tags: []
---

# Implementation Plan: multiple templates, phase 4

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The native family and its first template, `rust`: a Rust crate,
binary or (with `--with lib`) library, whose hygiene comes from tools pinned
in mise, with no `package.json`.

**Architecture:** Four new layers. `native` is the hygiene layer over
`common`: mise pins and aggregates the tasks, `committed` lints commit
messages, and Biome, rumdl, yamlfmt and yamllint carry inlined copies of the
shared npm configurations. `rust` adds Cargo, its mise tasks and the crate's
own files, and `rust-bin` or `rust-lib` adds the source. The catalogue gains
the `native` family and the `rust` entry; init gains `committedScopes`,
`cargoToml`, `cargoLock` and `moduleName`.

**Tech Stack:** As phases 1 to 3, plus mise tasks, committed, rumdl, yamlfmt,
yamllint, Biome standalone, and Rust 1.98 with Cargo, rustfmt and Clippy.

**Spec:**
[`docs/specs/2026-09-30-multiple-templates-design.md`](../specs/2026-09-30-multiple-templates-design.md),
its "Phases" item 4, "The native layer", "rust", "Identity edits" and "Name
rules". Phases 1 to 3 have landed on `main`; this plan builds on
[`2026-10-01-multiple-templates-phase-3.md`](2026-10-01-multiple-templates-phase-3.md).

## Global Constraints

- Node `>=24`; ES modules; every `.js` file starts with its header and
  `// @ts-check`, and is typechecked by `npm run typecheck`.
- No runtime dependency is added; `jsonc-parser` stays the only one, and the
  TOML edits are anchored regular expressions.
- A new file's header follows its neighbours': the vim modeline, the SPDX
  line, `~chewygumxx/create-repo.git` (in the templates,
  `~chewygumxx/repo-tmpl.git`), and `::: :/<its path>`. The templates keep
  the `chewygumxx/repo-tmpl` identity; `lib/init.js` rewrites it. A file that
  cannot carry a header (`Cargo.lock`, `.biome.json`) has none.
- No em dash (U+2014) anywhere; `npm run lint:emdash` and the hooks reject
  them.
- Markdown wraps at 80 columns with `-` bullets (remark).
- JavaScript is Biome-formatted: 4 spaces, double quotes. Run
  `npx --no -- biome check --write <files>` before committing; the
  pre-commit hook rejects unformatted staged files.
- Commits are Conventional Commits, header at most 50 characters, scopes
  `claude` or `template` or none, one commit per step that says to commit.
  A body is welcome where the change warrants context; wrap it at 72
  columns.
- `standard`, `typescript` and `cloudflare` output does not change.
- `UsageError` exits 2; `TemplateError` and `CommandError` exit 1.
- Without a terminal no feature is chosen, whatever a template's defaults.
  `rust` has one feature, `lib`, and no default.
- Every file a native layer adds passes the shared `lint-format` job of
  `chewygumxx/.github` as well as the repository's own `mise run check`:
  tombi's format and lint of TOML (the house `tombi/config.toml`),
  shellcheck and shfmt of scripts, actionlint of workflows, and
  editorconfig-checker with `-disable-indent-size`. Task 4 runs them.

## Deviations from the Spec

Each was found by building the layers in a scratch copy and running them,
with the tools CI runs.

- **`committed` cannot hold a header to 50 characters.** Its `subject_length`
  has no effect in 1.1.11, in any style. `hard_line_length = 72` is the one
  length it enforces, on every line including the header, so a header may be
  72 characters, not 50. The other two differences (`a/b` scopes, subject
  case) were already in the spec's Deferred list; this joins them.
- **YAML is formatted with 2 spaces, not prettier's 4.** Inside a sequence
  item yamlfmt indents by two whatever `indent` says, and yamllint's
  `indentation: consistent` (the house style, kept) rejects a file that
  mixes 4 and 2. So `.yamlfmt.yaml` says `indent: 2`, every YAML file in the
  native layers is written in yamlfmt's output, and the layer replaces
  `.editorconfig` to say `indent_size = 2` for YAML. Their modelines say
  `shiftwidth=2`.
- **Clippy's pedantic group is a crate attribute, not `[lints.clippy]`.**
  The shared `lint-format` job runs tombi with `--error-on-warnings`, and
  tombi warns that it cannot resolve the schema of `[lints.clippy]`. So
  `src/main.rs` and `src/lib.rs` open with `#![warn(clippy::pedantic)]`, which
  editors' Clippy honours too; `-D warnings` makes it an error in `mise run
  check`.
- **A library's name must be lowercase.** The spec's rule
  `^[A-Za-z][A-Za-z0-9_-]{0,63}$` fits a binary, but a library named
  `My-Tool` fails `mise run check`, since rustc's `non_snake_case` names the
  crate and `-D warnings` makes it an error. The catalogue refuses it at once,
  with the reason. A binary keeps the spec's rule.
- **mise runs a task's `run` with `errexit`,** so the `lint:emdash` check
  npm writes as `git grep ...; test $? -eq 1` fails on the match's status 1.
  It is `git grep ... && exit 1 || test $? -eq 1`.
- **`commitlint` is a mise file task,** `.config/mise/tasks/commitlint`, a
  bash script, since it loops over commits and skips Dependabot's. It takes
  `git rev-list` arguments after `--`: `origin/main..HEAD`, or `-1 HEAD`.
- **rumdl needs three settings beyond the preset's:** MD025 does not count a
  front matter `title` as a second heading, MD041 is off (the pull request
  template opens with a comment), and MD052 has `shortcut-syntax` on, since
  otherwise it never reports an undefined `[text]` reference.
- **`mise trust` trusts the whole directory,** `.config/mise/conf.d/*.toml`
  included, so the family runs no other trust command.
- **`moduleName(rename)` is a factory, and contents-only for now.** The spec's
  `module` edit needs a per-template value, so the edit is built from a
  function of the repository's name. It rewrites `repo_tmpl` in every file's
  contents that holds it, and asks nothing of a repository with none, since
  `rust-bin` has no module token. Renaming paths (nvim's `lua/repo_tmpl/`)
  is left to phase 5.
- **No `templates:lock` script, and no Dependabot `cargo` entry for
  `templates/rust`.** The layer's `Cargo.lock` holds only the crate itself; a
  test pins it to `Cargo.toml`, and regenerating it is `cargo
  generate-lockfile` in a materialised copy. Dependabot's `cargo` ecosystem
  would need a buildable crate in the layer directory, which is split across
  two layers, and there is nothing to update. The generated repository does
  get the `cargo` entry.
- **The layers' TOML is tombi's output.** tombi aligns `=` in each table and
  spaces array brackets; the files are written so `tombi format --check`
  passes, and tombi sorts `Cargo.toml`'s `[package]` keys, so the `cargoToml`
  edit matches keys with any spacing.

## Review Focus

1. A repository name GitHub allows and a crate cannot use (`my.tool`,
   `-tool`, `1tool`, 65 characters), and one a library cannot use (`My-Tool`):
   refused with the rule before anything is copied (Task 3).
2. A description or scope holding TOML's special characters (a quote, a
   backslash, `#`, a newline) leaves `Cargo.toml` and `committed.toml`
   valid TOML (Tasks 1 and 2).
3. The two git hooks and the commitlint task keep their execute bit through
   the copy; without it every commit or `mise run commitlint` fails (Task 3).
4. `Cargo.lock` names the crate the repository was given: `cargo test
   --locked` fails when it does not (Tasks 2 and 3).
5. The inlined Biome configuration and commit types drift from the shared
   packages they copy when those publish a change (Task 3).

---

### Task 1: The `committedScopes` and `moduleName` edits

**Files:**

- Modify: `lib/init.js`
- Test: `test/init.test.js`

**Interfaces:**

- Consumes: `EditContext`, the private `editText`, `replace` and `squash`
  (phase 1).
- Produces: `export function committedScopes(context: EditContext): void`,
  which adds each scope asked for to `allowed_scopes` in `committed.toml`,
  its full name as a comment above it, and does nothing when there are none;
  and `export function moduleName(rename: (name: string) => string): Edit`,
  which replaces `repo_tmpl` in the contents of every file that holds it with
  `rename(identity.name)`. Task 3 lists both in the catalogue.

- [ ] **Step 1: Write the failing tests**

In `test/init.test.js`, add `committedScopes` and `moduleName` to the import
from `../lib/init.js`, and append at the end of the file:

```js
/**
 * Runs `edits` over a copy holding only `files`, then hands `body` a reader
 * of the result.
 * @param {Record<string, string>} files
 * @param {import("../lib/init.js").Edit[]} edits
 * @param {(read: (file: string) => string) => void} body
 * @param {Partial<typeof IDENTITY>} [changes]
 */
function edited(files, edits, body, changes = {}) {
    inTemp((root) => {
        const copy = bare(root, { ...METADATA, ...files });
        init(copy.dir, { ...IDENTITY, ...changes }, copy.files, {
            edits,
            today: "2026-10-01",
        });
        body((file) => read(copy.dir, file));
    });
}

const COMMITTED = `allowed_scopes = [
    # Claude Code assets
    "claude",
]
`;

test("committedScopes adds each scope, its full name as a comment", () =>
    edited({ "committed.toml": COMMITTED }, [committedScopes], (read) => {
        assert.equal(
            read("committed.toml"),
            `allowed_scopes = [
    # Claude Code assets
    "claude",
    # Api
    "api",
    # Command Line
    "cli",
]
`,
        );
    }));

test("committedScopes leaves the file alone when no scope is asked for", () =>
    edited(
        { "committed.toml": COMMITTED },
        [committedScopes],
        (read) => {
            assert.equal(read("committed.toml"), COMMITTED);
        },
        { scopes: [] },
    ));

test("committedScopes keeps a scope's quotes and lines out of the TOML", () =>
    edited(
        { "committed.toml": COMMITTED },
        [committedScopes],
        (read) => {
            assert.match(read("committed.toml"), /^ {4}# Two lines # not code$/m);
            assert.match(read("committed.toml"), /^ {4}"a\\"b",$/m);
        },
        { scopes: [{ name: 'a"b', fullName: "Two\nlines # not code" }] },
    ));

test("committedScopes fails when committed.toml has no allowed_scopes", () => {
    assert.throws(
        () =>
            edited(
                { "committed.toml": 'style = "conventional"\n' },
                [committedScopes],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /allowed_scopes in committed\.toml/.test(error.message),
    );
});

test("moduleName names the module in every file that holds the token", () =>
    edited(
        {
            "src/lib.rs": "use repo_tmpl::greeting;\n",
            "docs/a.md": "repo_tmpl, twice: repo_tmpl\n",
            "notes.txt": "nothing to rename\n",
        },
        [moduleName((name) => name.replaceAll("-", "_"))],
        (read) => {
            assert.equal(read("src/lib.rs"), "use derived_repo::greeting;\n");
            assert.equal(read("docs/a.md"), "derived_repo, twice: derived_repo\n");
            assert.equal(read("notes.txt"), "nothing to rename\n");
        },
    ));

test("moduleName takes its value literally, not as a replacement pattern", () =>
    edited({ "a.txt": "repo_tmpl\n" }, [moduleName(() => "$&$1")], (read) => {
        assert.equal(read("a.txt"), "$&$1\n");
    }));

test("moduleName asks nothing of a repository without the token", () =>
    edited({ "a.txt": "a\n" }, [moduleName((name) => name)], (read) => {
        assert.equal(read("a.txt"), "a\n");
    }));
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/init.test.js`

Expected: FAIL with `SyntaxError: The requested module '../lib/init.js' does
not provide an export named 'committedScopes'`: a missing named ESM export
fails at link time, so no test in the file runs.

- [ ] **Step 3: Add the edits**

In `lib/init.js`, after `commitlintScopes`, add:

```js
/**
 * The scopes asked for, after the template's own, each with its full name
 * as a comment above it. tombi accepts the comments in a multi-line array,
 * so the result stays formatted.
 * @param {EditContext} context
 */
export function committedScopes({ dir, identity: { scopes } }) {
    if (!scopes.length) return;
    editText(join(dir, "committed.toml"), (text) =>
        replace(
            text,
            /^(allowed_scopes\s*=\s*\[\n(?: {4}.*\n)*)\]$/m,
            (_match, list) =>
                `${list}${scopes
                    .map(
                        (scope) =>
                            `    # ${squash(scope.fullName)}\n` +
                            `    ${JSON.stringify(scope.name)},\n`,
                    )
                    .join("")}]`,
            "the end of allowed_scopes in committed.toml",
        ),
    );
}

/**
 * The template's `repo_tmpl` token, an identifier where `repo-tmpl` is a
 * slug, in every file that holds it. A repository with none is left alone,
 * since a layer such as `rust-bin` has no module to name.
 * @param {(name: string) => string} rename the module's name for the
 *     repository's
 * @returns {Edit}
 */
export function moduleName(rename) {
    return ({ dir, files, identity: { name } }) => {
        const value = rename(name);
        for (const file of files) {
            const path = join(dir, file);
            const text = readFileSync(path, "utf8");
            if (!text.includes("repo_tmpl")) continue;
            // A function, so `$&` and `$1` in the name are not patterns.
            writeFileSync(path, text.replaceAll("repo_tmpl", () => value));
        }
    };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/init.js test/init.test.js && node --test test/init.test.js`

Expected: PASS, every test in the file.

- [ ] **Step 5: Commit**

```bash
git add lib/init.js test/init.test.js
git commit -m "feat: Add the committed scopes and module edits"
```

### Task 2: The `cargoToml` and `cargoLock` edits

**Files:**

- Modify: `lib/init.js`
- Test: `test/init.test.js`

**Interfaces:**

- Consumes: `EditContext`, `editText`, `replace`; Task 1's `edited` test
  helper.
- Produces: `export function cargoToml(context: EditContext): void`, which
  sets `name`, `description` and `repository` in `Cargo.toml`, and
  `export function cargoLock(context: EditContext): void`, which renames the
  crate's own `[[package]]` in `Cargo.lock`. Both fail as any edit does when
  the file or the key is missing. Task 3 lists them in the catalogue.

- [ ] **Step 1: Write the failing tests**

In `test/init.test.js`, add `cargoLock` and `cargoToml` to the import from
`../lib/init.js`, and append:

```js
/** As tombi leaves it: the keys aligned. */
const CARGO_TOML = `[package]
name        = "repo-tmpl"
version     = "0.1.0"
edition     = "2024"
description = "Repository Template"
repository  = "https://github.com/chewygumxx/repo-tmpl"
license     = "GPL-3.0-only"
publish     = false
`;

test("cargoToml names the crate, its description and its repository", () =>
    edited({ "Cargo.toml": CARGO_TOML }, [cargoToml], (read) => {
        assert.equal(
            read("Cargo.toml"),
            `[package]
name        = "derived-repo"
version     = "0.1.0"
edition     = "2024"
description = ${JSON.stringify(IDENTITY.description)}
repository  = "https://github.com/example/derived-repo"
license     = "GPL-3.0-only"
publish     = false
`,
        );
    }));

test("cargoToml writes a description holding TOML's special characters", () =>
    edited(
        { "Cargo.toml": CARGO_TOML },
        [cargoToml],
        (read) => {
            assert.match(
                read("Cargo.toml"),
                /^description = "back\\\\slash \\"quoted\\" # not a comment\\n2nd line"$/m,
            );
        },
        { description: 'back\\slash "quoted" # not a comment\n2nd line' },
    ));

test("cargoToml fails when a key is missing", () => {
    assert.throws(
        () =>
            edited(
                {
                    "Cargo.toml": CARGO_TOML.replace(
                        /^repository.*\n/m,
                        "",
                    ),
                },
                [cargoToml],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /repository in Cargo\.toml/.test(error.message),
    );
});

const CARGO_LOCK = `# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "repo-tmpl"
version = "0.1.0"
dependencies = [
 "itoa",
]

[[package]]
name = "itoa"
version = "1.0.15"
`;

test("cargoLock renames the crate's own package only", () =>
    edited({ "Cargo.lock": CARGO_LOCK }, [cargoLock], (read) => {
        assert.equal(
            read("Cargo.lock"),
            CARGO_LOCK.replace('name = "repo-tmpl"', 'name = "derived-repo"'),
        );
    }));

test("cargoLock fails when the crate's package is missing", () => {
    assert.throws(
        () =>
            edited(
                { "Cargo.lock": CARGO_LOCK.replace("repo-tmpl", "other") },
                [cargoLock],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /\[\[package\]\] in Cargo\.lock/.test(error.message),
    );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/init.test.js`

Expected: FAIL with `SyntaxError: The requested module '../lib/init.js' does
not provide an export named 'cargoLock'`.

- [ ] **Step 3: Add the edits**

In `lib/init.js`, after `moduleName`, add:

```js
/**
 * The crate's name, description and repository, in `[package]`. tombi aligns
 * a table's `=`, so each key is matched with any spacing; a value is written
 * as a JSON string, which is a TOML basic string.
 * @param {EditContext} context
 */
export function cargoToml({ dir, identity: { name, description }, slug }) {
    editText(join(dir, "Cargo.toml"), (text) => {
        for (const [key, value] of [
            ["name", name],
            ["description", description],
            ["repository", `https://github.com/${slug}`],
        ]) {
            text = replace(
                text,
                new RegExp(`^(${key}\\s*=\\s*)"[^"\\n]*"$`, "m"),
                (_match, head) => `${head}${JSON.stringify(value)}`,
                `${key} in Cargo.toml`,
            );
        }
        return text;
    });
}

/**
 * The crate's own entry in `Cargo.lock`, which `cargo --locked` requires to
 * agree with `Cargo.toml`.
 * @param {EditContext} context
 */
export function cargoLock({ dir, identity: { name } }) {
    editText(join(dir, "Cargo.lock"), (text) =>
        replace(
            text,
            /^(\[\[package\]\]\nname = )"repo-tmpl"$/m,
            (_match, head) => `${head}${JSON.stringify(name)}`,
            "the crate's [[package]] in Cargo.lock",
        ),
    );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/init.js test/init.test.js && node --test test/init.test.js`

Expected: PASS, every test in the file.

- [ ] **Step 5: Commit**

```bash
git add lib/init.js test/init.test.js
git commit -m "feat: Add the Cargo edits"
```

### Task 3: The native family and the `rust` template

**Files:**

- Create: `templates/native/` (16 files), `templates/rust/` (7 files),
  `templates/rust-bin/src/main.rs`, `templates/rust-lib/src/lib.rs`
- Modify: `lib/templates.js`
- Test: `test/templates.test.js`, `test/bin.test.js`

**Interfaces:**

- Consumes: Tasks 1 and 2's `committedScopes`, `moduleName`, `cargoToml` and
  `cargoLock`; phase 1's `headers`, `repoMetadata`, `readme`, `UsageError`;
  `compose`, `copyTemplate`, `TEMPLATES_DIR` from `lib/template.js`.
- Produces: `FAMILIES.native`; `TEMPLATES.rust` with feature `lib`, layers
  `["common", "native", "rust", "rust-bin" | "rust-lib"]`, edits
  `[headers, repoMetadata, readme, committedScopes, cargoToml, cargoLock,
  moduleName((name) => name.replaceAll("-", "_"))]` and a `checkName`
  refusing a name a crate, or with `lib` a library, cannot use. Task 4
  documents them.

- [ ] **Step 1: Write the failing tests**

In `test/templates.test.js`, add
`import { types } from "@chewygumxx/commitlint-config";` after the
`jsonc-parser` import, `import { fileURLToPath } from "node:url";` after the
`node:test` import, and `statSync` to the `node:fs` import, and append after
the last `cloudflare` test:

```js
test("rust is the native layer, Cargo and a binary", () => {
    const sources = compose(TEMPLATES.rust.layers(new Set()));
    for (const [file, layer] of [
        ["mise.toml", "native"],
        ["committed.toml", "native"],
        [".githooks/pre-commit", "native"],
        [".github/workflows/ci.yaml", "native"],
        ["Cargo.toml", "rust"],
        ["Cargo.lock", "rust"],
        ["rustfmt.toml", "rust"],
        [".config/mise/conf.d/rust.toml", "rust"],
        ["_gitignore", "rust"],
        [".github/dependabot.yml", "rust"],
        ["README.md", "rust"],
        ["src/main.rs", "rust-bin"],
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            new RegExp(`templates/${layer}/`),
            file,
        );
    }
    for (const file of ["package.json", ".husky/pre-commit", "src/lib.rs"]) {
        assert.ok(!sources.has(file), file);
    }
    assert.match(
        readFileSync(sources.get("_gitignore") ?? "", "utf8"),
        /^\/target\/$/m,
    );
});

test("rust with lib swaps the binary for a library", () => {
    const sources = compose(TEMPLATES.rust.layers(new Set(["lib"])));
    assert.match(sources.get("src/lib.rs") ?? "", /templates\/rust-lib\//);
    assert.ok(!sources.has("src/main.rs"));
});

test("rust offers lib and takes nothing by default", () => {
    assert.deepEqual(Object.keys(TEMPLATES.rust.features), ["lib"]);
    assert.equal(TEMPLATES.rust.defaultFeatures, undefined);
});

test("the native family runs its checks through mise, not npm", () => {
    assert.equal(TEMPLATES.rust.family, "native");
    assert.deepEqual(FAMILIES.native.setup, []);
    assert.deepEqual(FAMILIES.native.format, {
        file: "mise",
        args: ["run", "format"],
    });
    assert.deepEqual(FAMILIES.native.check, {
        file: "mise",
        args: ["run", "check"],
    });
});

// A hook or task that is not executable fails every commit that meets it.
test("the native hooks and the commitlint task are executable once copied", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
    try {
        const dir = join(root, "x");
        copyTemplate(dir, layersOf({ template: "rust", features: [] }));
        for (const file of [
            ".githooks/pre-commit",
            ".githooks/commit-msg",
            ".config/mise/tasks/commitlint",
        ]) {
            assert.ok(statSync(join(dir, file)).mode & 0o100, file);
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

// There is no npm to install the shared configurations from, so the native
// layer holds copies, and a change to the packages would otherwise go
// unnoticed.
test("the native Biome configuration is the shared one", () => {
    const shared = JSON.parse(
        readFileSync(
            fileURLToPath(import.meta.resolve("@chewygumxx/biome-config")),
            "utf8",
        ),
    );
    const own = JSON.parse(
        readFileSync(join(TEMPLATES_DIR, "native", ".biome.json"), "utf8"),
    );
    assert.deepEqual(own, shared);
});

test("the native commit types are the shared ones", () => {
    const toml = readFileSync(
        join(TEMPLATES_DIR, "native", "committed.toml"),
        "utf8",
    );
    const listed = /^allowed_types\s*=\s*\[([^\]]*)\]/m.exec(toml)?.[1] ?? "";
    assert.deepEqual(
        [...listed.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
        types.map((type) => type.name),
    );
});

// `cargo test --locked` fails when they differ, which only the CI matrix
// would notice.
test("the rust layer's Cargo.lock names the crate its Cargo.toml does", () => {
    const dir = join(TEMPLATES_DIR, "rust");
    const toml = readFileSync(join(dir, "Cargo.toml"), "utf8");
    const name = /^name\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    const version = /^version\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    assert.ok(
        readFileSync(join(dir, "Cargo.lock"), "utf8").includes(
            `[[package]]\nname = "${name}"\nversion = "${version}"\n`,
        ),
    );
});

test("a crate's name is 1 to 64 letters, digits, - and _, a library's lowercase", () => {
    const { checkName } = TEMPLATES.rust;
    assert.ok(checkName);
    /**
     * @param {string} name
     * @param {string[]} features
     */
    const check = (name, ...features) =>
        checkName({ owner: "example", name }, new Set(features));
    for (const name of ["a", "my-tool", "My_Tool2", "a".repeat(64)]) {
        assert.doesNotThrow(() => check(name), name);
    }
    for (const name of [
        "my.tool",
        "-tool",
        "_tool",
        "1tool",
        "my tool",
        "a".repeat(65),
    ]) {
        assert.throws(
            () => check(name),
            (error) => error instanceof UsageError && /crate name/.test(error.message),
            name,
        );
    }
    assert.doesNotThrow(() => check("my-lib", "lib"));
    for (const name of ["My-Lib", "myLib"]) {
        assert.doesNotThrow(() => check(name), name);
        assert.throws(
            () => check(name, "lib"),
            (error) => error instanceof UsageError && /snake case/.test(error.message),
            name,
        );
    }
});

test("rust is initialised with the crate's name, scopes and module", () => {
    for (const features of [[], ["lib"]]) {
        const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
        try {
            const dir = join(root, "x");
            const files = copyTemplate(
                dir,
                layersOf({ template: "rust", features }),
            );
            init(dir, IDENTITY, files, {
                edits: TEMPLATES.rust.edits,
                features,
                today: "2026-10-01",
            });
            /** @param {string} file */
            const at = (file) => readFileSync(join(dir, file), "utf8");
            assert.match(at("Cargo.toml"), /^name\s*= "derived-repo"$/m);
            assert.match(at("Cargo.lock"), /^name = "derived-repo"$/m);
            assert.match(at("committed.toml"), /^ {4}"api",$/m);
            if (features.includes("lib")) {
                assert.match(at("src/lib.rs"), /derived_repo::greeting/);
            }
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    }
});
```

In `test/bin.test.js`, in `runBin`'s returned object add, after `wrangler`:

```js
            cargo: existsSync(join(dir, "Cargo.toml"))
                ? readFileSync(join(dir, "Cargo.toml"), "utf8")
                : undefined,
            lib: existsSync(join(dir, "src/lib.rs"))
                ? readFileSync(join(dir, "src/lib.rs"), "utf8")
                : undefined,
```

and append after the cloudflare tests:

```js
test("rust is copied, initialised and run through mise, not npm", () => {
    const { commit, cargo, lines } = dryRun(["--template", "rust"]);
    assert.match(commit, /\(rust\)\./);
    assert.match(cargo ?? "", /^name\s*= "x"$/m);
    assert.match(
        cargo ?? "",
        /^repository\s*= "https:\/\/github\.com\/example\/x"$/m,
    );
    const env = lines.findIndex((line) => line.startsWith("mise env"));
    assert.deepEqual(
        lines
            .slice(env + 1)
            .map((line) => line.split(" ").slice(0, 2).join(" ")),
        ["git add", "mise run", "git add", "mise run", "git commit"],
        lines.join("\n"),
    );
});

test("rust with lib is named in the commit and names its library", () => {
    const run = runBin((root) => [
        "my-tool",
        "--description",
        "D",
        "--owner",
        "example",
        "--dir",
        join(root, "x"),
        "--no-metadata",
        "--dry-run",
        "--yes",
        "--template",
        "rust",
        "--with",
        "lib",
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.match(run.commit, /\(rust, with lib\)\./);
    assert.match(run.lib ?? "", /my_tool::greeting/);
});

test("a name a crate cannot use stops before anything is copied", () => {
    /** @type {[string, string[], RegExp][]} */
    const cases = [
        ["my.tool", [], /crate name/],
        ["My-Tool", ["--with", "lib"], /snake case/],
    ];
    for (const [name, extra, message] of cases) {
        const { result, copied } = runBin((root) => [
            name,
            "--description",
            "D",
            "--owner",
            "example",
            "--dir",
            join(root, "x"),
            "--no-metadata",
            "--dry-run",
            "--yes",
            "--template",
            "rust",
            ...extra,
        ]);
        assert.equal(result.status, 2, name);
        assert.match(result.stderr, message, name);
        assert.ok(!copied, name);
    }
});
```

In "--help lists the templates", add:

```js
    assert.match(result.stdout, /\n {2}rust {8}A Rust crate/);
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/templates.test.js test/bin.test.js`

Expected: FAIL. In `templates.test.js`, the `rust` tests with
`TypeError: Cannot read properties of undefined (reading 'layers')` (and
`(reading 'features')`, `(reading 'family')`, `(reading 'checkName')`), the
family test likewise, the Biome, commit types and lock tests with `ENOENT` on
`templates/native/...` and `templates/rust/...`; in `bin.test.js`, the three
`rust` tests with `Unknown template "rust"`, and "--help lists the templates".
Every other test passes. The `every layer belongs to a template` test passes
as well, since no layer exists yet.

- [ ] **Step 3: Add the native layer**

Each file below is written exactly as shown. They were built in a scratch
copy and run with the tools CI runs; the TOML and YAML are those tools'
output, so do not re-flow them by hand.

`templates/native/mise.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/mise.toml
#
#

#
# https://mise.jdx.dev/configuration.html
#
# The development toolchain and the tasks for this repository, in one place.
#
# Everything the repository runs is pinned here, so a checkout never depends
# on whatever the contributor happens to have on `PATH`; there is no
# `package.json`. CI installs from this file via `jdx/mise-action`, so the
# versions below are the ones CI runs.
#
# The tasks below are aggregates. The language's own tools and tasks are
# added beside this file in `.config/mise/conf.d/`, which mise merges in, and
# each task is named for the aggregate it joins: `lint:*`, `test:*`,
# `format:*` and `pre-commit:*`.
#
# Backends are named explicitly rather than relying on the registry alias,
# so the resolution is visible here and cannot change underneath the pin.
#

min_version = "2026.9.0"

[tools]
#
# Utilities
#
# `jq` parses the tool payload in `.claude/hooks/prohibit-em-dash.sh`.
#
"aqua:jqlang/jq" = "1.8.2"

#
# Commit messages
#
# committed lints them against `committed.toml`.
#
"aqua:crate-ci/committed" = "1.1.11"

#
# Formatting and lint
#
# Biome reads `.biome.json`, rumdl `.rumdl.toml` and yamlfmt `.yamlfmt.yaml`.
# yamllint is a Python tool, installed with the uv pinned beside it; its rules
# come from `.yamllint.yaml`.
#
"aqua:astral-sh/uv"   = "0.12.19"
"aqua:biomejs/biome"  = "2.5.14"
"aqua:google/yamlfmt" = "0.21.0"
"aqua:rvben/rumdl"    = "0.2.78"
"pypi:yamllint"       = "1.38.0"

# Wires the git hooks in `.githooks/`, as husky's `prepare` does for an npm
# repository, whenever `mise install` runs: by a contributor, or by CI.
[hooks]
postinstall = "git config core.hooksPath .githooks"

#
# Lint
#

[tasks."lint:biome"]
description = "Biome's format and lint checks"
run         = "biome ci ."

[tasks."lint:md"]
description = "Markdown lint"
run         = "git ls-files -z '*.md' | xargs -0 -r rumdl check"

[tasks."lint:yaml"]
description = "YAML format (yamlfmt) and lint (yamllint)"
run         = """
git ls-files -z '*.yaml' '*.yml' | xargs -0 -r yamlfmt -lint
git ls-files -z '*.yaml' '*.yml' | xargs -0 -r yamllint --strict
"""

[tasks."lint:emdash"]
description = "Reject em dashes (U+2014)"
# mise runs a task with errexit, so a match ends it, and no match (status 1)
# is the pass.
run         = "git grep -nIP --untracked '\\x{2014}' && exit 1 || test $? -eq 1"

#
# Format
#

[tasks."format:biome"]
description = "Apply Biome formatting"
run         = "biome format --write ."

[tasks."format:yaml"]
description = "Apply yamlfmt formatting"
run         = "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r yamlfmt"

#
# Pre-commit: the same checks on staged files
#

[tasks."pre-commit:biome"]
description = "Biome's checks on staged files"
run         = "biome check --staged --no-errors-on-unmatched"

[tasks."pre-commit:md"]
description = "Markdown lint on staged files"
run         = "git diff -z --cached --name-only --diff-filter=ACMR -- '*.md' | xargs -0 -r rumdl check"

[tasks."pre-commit:yaml"]
description = "YAML format and lint on staged files"
run         = """
git diff -z --cached --name-only --diff-filter=ACMR -- '*.yaml' '*.yml' | xargs -0 -r yamlfmt -lint
git diff -z --cached --name-only --diff-filter=ACMR -- '*.yaml' '*.yml' | xargs -0 -r yamllint --strict
"""

[tasks."pre-commit:emdash"]
description = "Reject em dashes in staged changes"
# U+2014 as UTF-8 bytes, so this file does not trip its own check.
run         = """
emdash=$(printf '\\342\\200\\224')
if git diff --cached -U0 | grep '^+' | grep -q "$emdash"; then
    echo "Em dash (U+2014) in staged changes; em dashes are prohibited." >&2
    exit 1
fi
"""

#
# The aggregates
#

[tasks.check]
description = "Every check CI runs"
depends     = [ "lint:*", "test:*" ]

[tasks.format]
description = "Apply every formatter"
depends     = [ "format:*" ]

[tasks.pre-commit]
description = "The checks the pre-commit hook runs"
depends     = [ "pre-commit:*" ]
```

`templates/native/committed.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/committed.toml
#
#

# https://github.com/crate-ci/committed
#
# The house rules of `@chewygumxx/commitlint-config`, as far as committed
# states them: the same twelve types, and the scopes named in
# `allowed_scopes`, which are this repository's own.
#
# What committed cannot state, and commitlint does: a header is held to 72
# characters, not 50 (`subject_length` has no effect in committed 1.1), `a/b`
# cannot name two scopes, and a subject's case is not checked.

style = "conventional"

allowed_types = [
    "feat",
    "fix",
    "tweak",
    "chore",
    "style",
    "docs",
    "ci",
    "refactor",
    "perf",
    "build",
    "test",
    "revert",
]

# This repository's own scopes, each with its full name.
allowed_scopes = [
    # Claude Code assets ie. hooks, skills, agents, etc.
    "claude",
]

# A body line, and the header, at most 72 characters.
hard_line_length = 72
line_length      = 72

subject_not_punctuated = true

# commitlint does not reject what these would.
imperative_subject  = false
subject_capitalized = false
no_fixup            = false
no_wip              = false
```

`templates/native/.biome.json`:

```json
{
    "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
    "vcs": {
        "enabled": true,
        "clientKind": "git",
        "useIgnoreFile": true
    },
    "files": {
        "ignoreUnknown": false
    },
    "formatter": {
        "enabled": true,
        "useEditorconfig": true
    },
    "linter": {
        "enabled": true,
        "rules": {
            "preset": "recommended"
        }
    },
    "assist": {
        "enabled": true,
        "actions": {
            "source": {
                "organizeImports": "on"
            }
        }
    },
    "javascript": {
        "formatter": {
            "quoteStyle": "double"
        }
    },
    "json": {
        "formatter": {
            "trailingCommas": "none"
        }
    }
}
```

`templates/native/.yamllint.yaml`:

```yaml
# vim:set expandtab shiftwidth=2 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.yamllint.yaml
#
#

# https://yamllint.readthedocs.io/en/stable/configuration.html
#
# The house style of `@chewygumxx/yamllint-config`, copied here because this
# repository has no npm to install it from.
#
# yamlfmt owns layout, so only the rules that disagree with its output, or
# with how these repositories write YAML, are relaxed from the defaults.

extends: default

rules:
  # yamlfmt puts one space before a trailing comment.
  comments:
    min-spaces-from-content: 1

  # Files open with a vim modeline and licence comment, not `---`.
  document-start: disable

  # Strings, URLs and expressions cannot be wrapped; editorconfig-checker
  # enforces a `max_line_length` where a repository sets one.
  line-length: disable

  # `on:` is a workflow key, not a boolean. Truthy values are still
  # reported.
  truthy:
    check-keys: false
```

`templates/native/.yamlfmt.yaml`:

```yaml
# vim:set expandtab shiftwidth=2 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.yamlfmt.yaml
#
#

# https://github.com/google/yamlfmt/blob/main/docs/config-file.md
#
# The layout an npm repository gets from prettier, as nearly as yamlfmt
# allows: sequences indented under their key, comments one space from their
# content, blank lines kept. The indent is two, not prettier's four: inside a
# sequence item yamlfmt indents by two whatever it is told, and yamllint's
# `indentation` rule, which the house style keeps at `consistent`, rejects a
# file that mixes the two. `.editorconfig` says so for YAML.

formatter:
  type: basic
  indent: 2
  retain_line_breaks_single: true
  pad_line_comments: 1
  scan_folded_as_literal: true
```

`templates/native/.rumdl.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.rumdl.toml
#
#

# https://rumdl.dev/global-settings/
#
# `@chewygumxx/remark-preset` as nearly as rumdl allows: 80 columns, `-`
# bullets, and the same consistency and recommended rules. A front matter
# block is skipped by rumdl, and GitHub's alerts (`> [!NOTE]`) are not
# reported as undefined references (MD052, which needs `shortcut-syntax` to
# see `[text]` alone as a reference). Two of rumdl's rules go beyond the preset
# and are off: a front matter `title` is not a second top-level heading (MD025),
# and a file need not open with a heading (MD041), which the pull request
# template does not.

[global]
line-length = 80

[MD004]
style = "dash"

[MD013]
line-length = 80
code-blocks = false
tables      = false

[MD025]
front-matter-title = ""

[MD041]
enabled = false

[MD052]
shortcut-syntax = true
```

`templates/native/.editorconfig`:

```editorconfig
# vim:set expandtab shiftwidth=4 filetype=editorconfig:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.editorconfig
#
#

root = true

# ----------
# All files
# ----------
[*]

charset = utf-8

indent_size = 4
indent_style = space
trim_trailing_whitespace = true

end_of_line = lf
insert_final_newline = true

# ---------
# Markdown
# ---------
[*.md]
indent_size = 2

# -----
# YAML
# -----
# yamlfmt indents by two.
[*.{yaml,yml}]
indent_size = 2
```

`templates/native/_gitignore`:

```gitignore
# vim:set expandtab shiftwidth=4 filetype=gitignore:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.gitignore
#
#

.env*
*.local.*

/.herdr/
/.claude/worktrees/

/.remember/
/.superpowers/
```

`templates/native/.worktreeinclude`:

```gitignore
# vim:set expandtab shiftwidth=4 filetype=gitignore:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.worktreeinclude
#
#

.env*
*.local.*
```

`templates/native/.claude/hooks/install-deps.sh`:

```sh
#!/usr/bin/env sh
# vim:set expandtab shiftwidth=4 filetype=sh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.claude/hooks/install-deps.sh
#
#

# SessionStart. Installs this repository's mise tools, which wires its git
# hooks, before anything else in the session runs.

set -u

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

root=${CLAUDE_PROJECT_DIR:-}
[ -n "$root" ] || root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$root" ] || exit 0

[ -f "$root/mise.toml" ] || exit 0
command -v mise >/dev/null 2>&1 || exit 0

cd "$root" || exit 0
mise trust --quiet >/dev/null
mise install --quiet >/dev/null
```

`templates/native/.githooks/pre-commit`:

```sh
#!/usr/bin/env sh
# vim:set expandtab shiftwidth=4 filetype=sh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.githooks/pre-commit
#
#

# Through mise, so the hook runs the pinned tools, not the contributor's PATH.
exec mise run pre-commit
```

`templates/native/.githooks/commit-msg`:

```sh
#!/usr/bin/env sh
# vim:set expandtab shiftwidth=4 filetype=sh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.githooks/commit-msg
#
#

exec mise exec -- committed --commit-file "$1"
```

`templates/native/.config/mise/tasks/commitlint`:

```sh
#!/usr/bin/env bash
# vim:set expandtab shiftwidth=4 filetype=sh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.config/mise/tasks/commitlint
#
#

#MISE description="Lint commit messages with committed"
#MISE quiet=true

# Usage: mise run commitlint -- <revision>...
#
# Lints each commit `git rev-list <revision>...` names, so `from..to` lints a
# range and `-1 HEAD` the latest commit. A Dependabot bump is skipped when it
# carries Dependabot's own Signed-off-by trailer: its headers name the package
# and both versions, and its bodies carry release-note URLs, neither of which
# fits the limits. The trailer is required as well as the header, rather than
# trusting the header alone.

set -euo pipefail

((${#})) || {
    echo "usage: mise run commitlint -- <revision>..." >&2
    exit 2
}

status=0
while IFS= read -r commit; do
    message=$(git log -1 --format=%B "$commit")
    if [[ $message =~ ^(build|ci):\ bump\  ]] &&
        grep -q '^Signed-off-by: dependabot\[bot\]' <<<"$message"; then
        continue
    fi
    printf '%s\n' "$message" |
        committed --commit-file - || {
        echo "committed rejected ${commit:0:7}" >&2
        status=1
    }
done < <(git rev-list --reverse "$@")
exit "$status"
```

`templates/native/.github/dependabot.yml`:

```yaml
# vim:set expandtab shiftwidth=2 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.github/dependabot.yml
#
#

version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: ci
```

`templates/native/.github/workflows/ci.yaml`:

```yaml
# vim:set expandtab shiftwidth=2 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.github/workflows/ci.yaml
#
#

# The shared standard checks (header sync, generic lint and format, metadata
# sync), then this repository's own: commitlint and `mise run check`, the
# latter against the commit the header sync pushed. See chewygumxx/.github
# for each shared part.
#
# The shared commitlint and YAML checks need npm, which this repository does
# not have, so they are off in `standard` and done here with the tools mise
# pins. The commit ranges are the shared commitlint job's.
#
# workflow_dispatch re-runs the metadata sync once the METADATA_APP_* secret
# and variable are corrected.

name: CI

on:
  push:
    branches:
      - main
  pull_request:
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: read

# Not cancelled in progress: a newer run must not interrupt the header sync
# part-way through its commit.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  standard:
    uses: chewygumxx/.github/.github/workflows/standard.yaml@v1
    with:
      metadata-client-id: ${{ vars.METADATA_APP_CLIENT_ID }}
      commitlint: false
      yaml: false
    secrets:
      metadata-private-key: ${{ secrets.METADATA_APP_PRIVATE_KEY }}

  commitlint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read

    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: Setup mise
        uses: jdx/mise-action@v4

      - name: Lint Pull Request Commits
        if: github.event_name == 'pull_request'
        env:
          FROM: ${{ github.event.pull_request.base.sha }}
          TO: ${{ github.event.pull_request.head.sha }}
        run: mise run commitlint -- "$FROM..$TO"

      # `before` is all zeros when the push creates the branch, and
      # absent on workflow_dispatch; lint only the tip in those cases.
      - name: Lint Pushed Commits
        if: github.event_name == 'push' && !startsWith(github.event.before, '0000000')
        env:
          FROM: ${{ github.event.before }}
          TO: ${{ github.sha }}
        run: mise run commitlint -- "$FROM..$TO"

      - name: Lint Latest Commit
        if: github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && startsWith(github.event.before, '0000000'))
        run: mise run commitlint -- -1 HEAD

  check:
    needs: standard
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          ref: ${{ needs.standard.outputs.sha }}
          persist-credentials: false

      # System packages a template's tools need and mise does not
      # provide, one per line.
      - name: Install System Packages
        run: |
          if [ -f .github/apt-packages.txt ]; then
              sudo apt-get update
              xargs -a .github/apt-packages.txt sudo apt-get install --yes --no-install-recommends
          fi

      - name: Setup mise
        uses: jdx/mise-action@v4

      - name: Check
        run: mise run check
```

`templates/native/README.md`:

````markdown
---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/repo-tmpl.git
  # ::: :/README.md
  #
  #

ctime: 2026-09-29
title: repo-tmpl
description: "Repository Template"
tags:
  - repo
  - template
  - repository
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (committed), formatting and linting
(Biome, rumdl, yamlfmt, yamllint), GitHub automation (header and repository
metadata sync, Dependabot) and Claude Code settings and hooks, all without npm.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
npm create @chewygumxx/repo my-thing
```

## CI

`.github/workflows/ci.yaml` calls the shared
[standard workflow](https://github.com/chewygumxx/.github#standard-workflow):
the header sync, generic lint and format checks for workflows, shell and zsh
scripts, TOML and `.editorconfig`, and the metadata sync. Its own jobs follow:
`commitlint`, which lints the pushed or pull request commit messages with
committed, and `check`, which runs `mise run check` against the commit the
header sync pushed. Packages listed in `.github/apt-packages.txt`, one per
line, are installed first when the file exists.

## Development

The toolchain is pinned in `mise.toml`, and `mise install` installs it and
wires the git hooks in `.githooks/`.

- `mise run check` runs the checks CI runs: Biome's format and lint checks,
  Markdown lint (rumdl), the YAML checks (yamlfmt, then yamllint) and a check
  that rejects em dashes.
- `mise run format` applies Biome formatting, and yamlfmt's to YAML, which
  Biome does not read.
- `mise run commitlint -- <revision>...` lints the commit messages the
  revisions name, as CI does: `origin/main..HEAD`, or `-1 HEAD`.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs committed, which holds each message to Conventional Commits with the types
and scopes in `committed.toml`.
````

Then make the three scripts executable, which git records:

```sh
chmod +x templates/native/.githooks/pre-commit \
    templates/native/.githooks/commit-msg \
    templates/native/.config/mise/tasks/commitlint
```

- [ ] **Step 4: Commit the native layer**

```bash
git add templates/native
git commit -m "feat(template): Add the native layer" \
    -m "Hygiene without npm: mise pins the tools and aggregates the tasks,
committed lints commit messages, and Biome, rumdl, yamlfmt and yamllint
carry copies of the shared configuration."
```

- [ ] **Step 5: Add the rust layers**

`templates/rust/Cargo.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/Cargo.toml
#
#

# https://doc.rust-lang.org/cargo/reference/manifest.html

[package]
name        = "repo-tmpl"
version     = "0.1.0"
edition     = "2024"
description = "Repository Template"
repository  = "https://github.com/chewygumxx/repo-tmpl"
license     = "GPL-3.0-only"
publish     = false
```

`templates/rust/Cargo.lock`:

```toml
# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "repo-tmpl"
version = "0.1.0"
```

`templates/rust/rustfmt.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/rustfmt.toml
#
#

# https://rust-lang.github.io/rustfmt/

edition = "2024"
```

`templates/rust/.config/mise/conf.d/rust.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.config/mise/conf.d/rust.toml
#
#

#
# https://mise.jdx.dev/configuration.html
#
# Rust's tools and tasks, merged into `mise.toml`'s aggregates: mise reads
# every file in this directory beside it.
#

[tools]
rust = { version = "1.98.1", components = "clippy,rustfmt" }

[tasks."lint:fmt"]
description = "rustfmt's check"
run         = "cargo fmt --check"

[tasks."lint:clippy"]
description = "Clippy, with every warning an error"
run         = "cargo clippy --all-targets --locked -- -D warnings"

[tasks."test:cargo"]
description = "The crate's tests, doc tests included"
run         = "cargo test --locked"

[tasks."format:rust"]
description = "Apply rustfmt"
run         = "cargo fmt"

[tasks."pre-commit:rust"]
description = "rustfmt's check"
run         = "cargo fmt --check"
```

`templates/rust/_gitignore`:

```gitignore
# vim:set expandtab shiftwidth=4 filetype=gitignore:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.gitignore
#
#

.env*
*.local.*

/target/
/.herdr/
/.claude/worktrees/

/.remember/
/.superpowers/
```

`templates/rust/.github/dependabot.yml`:

```yaml
# vim:set expandtab shiftwidth=2 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.github/dependabot.yml
#
#

version: 2
updates:
  - package-ecosystem: cargo
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: build

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: ci
```

`templates/rust/README.md`:

````markdown
---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/repo-tmpl.git
  # ::: :/README.md
  #
  #

ctime: 2026-09-29
title: repo-tmpl
description: "Repository Template"
tags:
  - repo
  - template
  - repository
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (committed), formatting and linting
(rustfmt, Clippy, Biome, rumdl, yamlfmt, yamllint), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks,
all without npm.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
npm create @chewygumxx/repo my-thing
```

## CI

`.github/workflows/ci.yaml` calls the shared
[standard workflow](https://github.com/chewygumxx/.github#standard-workflow):
the header sync, generic lint and format checks for workflows, shell and zsh
scripts, TOML and `.editorconfig`, and the metadata sync. Its own jobs follow:
`commitlint`, which lints the pushed or pull request commit messages with
committed, and `check`, which runs `mise run check` against the commit the
header sync pushed. Packages listed in `.github/apt-packages.txt`, one per
line, are installed first when the file exists.

## Development

The toolchain is pinned in `mise.toml` and `.config/mise/conf.d/rust.toml`, and
`mise install` installs it, Rust included, and wires the git hooks in
`.githooks/`.

- `cargo run` runs the crate, and `cargo test` its tests.
- `mise run check` runs the checks CI runs: rustfmt's check, Clippy with every
  warning an error, `cargo test --locked`, Biome's format and lint checks,
  Markdown lint (rumdl), the YAML checks (yamlfmt, then yamllint) and a check
  that rejects em dashes.
- `mise run format` applies rustfmt, Biome's formatting, and yamlfmt's to YAML,
  which Biome does not read.
- `mise run commitlint -- <revision>...` lints the commit messages the
  revisions name, as CI does: `origin/main..HEAD`, or `-1 HEAD`.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs committed, which holds each message to Conventional Commits with the types
and scopes in `committed.toml`.
````

`templates/rust-bin/src/main.rs`:

```rust
// vim:set expandtab shiftwidth=4 filetype=rust:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/main.rs
//
//

#![warn(clippy::pedantic)]

fn greeting(name: &str) -> String {
    format!("Hello, {name}!")
}

fn main() {
    println!("{}", greeting("world"));
}

#[cfg(test)]
mod tests {
    use super::greeting;

    #[test]
    fn greets_by_name() {
        assert_eq!(greeting("world"), "Hello, world!");
    }
}
```

`templates/rust-lib/src/lib.rs`:

````rust
// vim:set expandtab shiftwidth=4 filetype=rust:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/lib.rs
//
//

#![warn(clippy::pedantic)]

/// Greets `name`.
///
/// ```
/// assert_eq!(repo_tmpl::greeting("world"), "Hello, world!");
/// ```
#[must_use]
pub fn greeting(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg(test)]
mod tests {
    use super::greeting;

    #[test]
    fn greets_by_name() {
        assert_eq!(greeting("world"), "Hello, world!");
    }
}
````

- [ ] **Step 6: Commit the rust layers**

```bash
git add templates/rust templates/rust-bin templates/rust-lib
git commit -m "feat(template): Add the rust layers" \
    -m "Cargo, rustfmt, Clippy and cargo test as mise tasks merged into the
native aggregates, with a binary or, over rust-lib, a library."
```

- [ ] **Step 7: Add the family and the catalogue entry**

In `lib/templates.js`, add `cargoLock`, `cargoToml`, `committedScopes` and
`moduleName` to the import from `./init.js`, then add to `FAMILIES`:

```js
    native: {
        setup: [],
        format: { file: "mise", args: ["run", "format"] },
        check: { file: "mise", args: ["run", "check"] },
    },
```

Add, after `workerName`:

```js
/**
 * A crate's name is the repository's. Cargo takes letters, digits, `-` and
 * `_`, starting with a letter, up to 64 of them. A library's name is also a
 * Rust identifier, which the template's Clippy check (`-D warnings`) requires
 * to be snake case, so a library's is lowercase. GitHub allows more, so the
 * name is refused, not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function crateName({ name }, features) {
    const lib = features.has("lib");
    const rule = lib ? /^[a-z][a-z0-9_-]{0,63}$/ : /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
    if (rule.test(name)) return;
    throw new UsageError(
        `The crate name "${name}" is not valid: use 1 to 64 ${lib ? "lowercase letters" : "letters"}, digits, "-" and "_", starting with a letter${lib ? " (a library's name is a Rust identifier, which must be snake case)" : ""}.`,
    );
}
```

and add to `TEMPLATES`, after `cloudflare`:

```js
    rust: {
        description: "A Rust crate, binary or library, without npm",
        family: "native",
        features: { lib: "A library crate instead of a binary" },
        layers: (features) => [
            "common",
            "native",
            "rust",
            features.has("lib") ? "rust-lib" : "rust-bin",
        ],
        edits: [
            headers,
            repoMetadata,
            readme,
            committedScopes,
            cargoToml,
            cargoLock,
            moduleName((name) => name.replaceAll("-", "_")),
        ],
        checkName: crateName,
    },
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/templates.js test/templates.test.js test/bin.test.js && npm test`

Expected: PASS, the whole suite. In particular "every combination copies and
initialises, leaving no identity" now covers `rust` and `rust, with lib`,
and "every template header names the template and its own path" covers the
new layers.

- [ ] **Step 9: Commit**

```bash
git add lib/templates.js test/templates.test.js test/bin.test.js
git commit -m "feat: Add the rust template"
```

### Task 4: Tooling, documentation and the real run

**Files:**

- Modify: `.github/dependabot.yml`, `README.md`,
  `docs/specs/2026-09-30-multiple-templates-design.md`

**Interfaces:**

- Consumes: Task 3's layers and catalogue entry.
- Produces: nothing later tasks use. The phase is done when `npm run check`
  passes, the repository's `editorconfig-checker` passes, and a real run of
  `rust` and `rust, with lib` creates a repository whose own `mise run
  check`, hooks and `commitlint` task pass.

- [ ] **Step 1: Watch the native layer's workflow**

In `.github/dependabot.yml`, after the `/templates/cloudflare`
`github-actions` entry, add:

```yaml

    - package-ecosystem: github-actions
      directory: /templates/native
      schedule:
          interval: weekly
      commit-message:
          prefix: ci(template)
```

- [ ] **Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci: Watch the native layer's workflow"
```

- [ ] **Step 3: Document the template**

In `README.md`, add to the templates table, after the `cloudflare` row:

```markdown
| `rust`       | A Rust crate without npm, checked with mise: a binary, or |
|              | with `--with lib` a library                               |
```

Replace the paragraph that begins "Each template is an ordered list of
layers" with:

```markdown
Each template is an ordered list of layers under `templates/`, declared in
`lib/templates.js`: a later layer's file replaces the same file from an
earlier one. `common` holds what every repository carries, `npm` the
npm-based checks, `typescript` its sources, `typescript-publish` what
`--with publish` replaces and adds, and `cloudflare` the Worker. `native` is
the hygiene layer without npm: mise pins the tools and aggregates the tasks,
`committed` lints commit messages, and Biome, rumdl, yamlfmt and yamllint
carry copies of the shared configurations. `rust` adds Cargo and its mise
tasks, and `rust-bin` or `rust-lib` the source. A layer that holds a
`package.json` holds its lock; regenerate it with
`npm install --package-lock-only` in the layer's directory. `rust` holds
its `Cargo.lock`: materialise the template, run `cargo generate-lockfile`
there, and copy the file back.
```

and, in the paragraph on the templates' identity, change "`repo-tmpl`, or the
identifier form `repo_tmpl`, remains anywhere." to "`repo-tmpl`, or the
identifier form `repo_tmpl`, remains anywhere. `rust` with `lib` names its
crate in a doc test as `repo_tmpl`, which the `moduleName` edit rewrites."

- [ ] **Step 4: Amend the spec**

In `docs/specs/2026-09-30-multiple-templates-design.md`, make these edits,
each replacing the exact old text with the new:

1. In "The native layer", replace

   ```text
   - `.yamlfmt.yaml`: prettier's YAML output as nearly as yamlfmt allows.
   ```

   with

   ```text
   - `.yamlfmt.yaml`: prettier's YAML output as nearly as yamlfmt allows,
     with two spaces, not four: inside a sequence item yamlfmt indents by two
     whatever it is told, and yamllint's `indentation: consistent` rejects a
     file that mixes both. `.editorconfig` is replaced to say
     `indent_size = 2` for YAML.
   ```

2. Replace

   ```text
   - `.rumdl.toml`: `@chewygumxx/remark-preset` as nearly as rumdl allows: 80
     columns, `-` bullets, frontmatter, GitHub alert references allowed.
   ```

   with

   ```text
   - `.rumdl.toml`: `@chewygumxx/remark-preset` as nearly as rumdl allows: 80
     columns, `-` bullets, frontmatter, GitHub alert references allowed.
     MD025 does not count a front matter `title`, MD041 is off, and MD052
     has `shortcut-syntax` on so an undefined `[text]` is reported.
   ```

3. Replace

   ```text
   `commitlint` runs committed over a range and skips a commit whose header is
   `build|ci: bump` and which carries Dependabot's `Signed-off-by` trailer, as
   the shared commitlint configuration's `ignores` does.
   ```

   with

   ```text
   `commitlint` is a file task, `.config/mise/tasks/commitlint`, that runs
   committed over each commit `git rev-list <arguments>` names (`mise run
   commitlint -- origin/main..HEAD`, or `-1 HEAD`) and skips a commit whose
   header is `build|ci: bump` and which carries Dependabot's `Signed-off-by`
   trailer, as the shared commitlint configuration's `ignores` does. mise runs
   a task's `run` with `errexit`, so `lint:emdash` is `git grep ... && exit 1
   || test $? -eq 1`.
   ```

4. Replace

   ```text
   - `committed.toml`: `style = "conventional"`, `subject_length = 50`,
     `line_length = 72`, the shared configuration's twelve types,
   ```

   with

   ```text
   - `committed.toml`: `style = "conventional"`, `hard_line_length = 72`
     (`subject_length` has no effect in committed 1.1, so a header may be 72
     characters, not 50), `line_length = 72`, the shared configuration's
     twelve types,
   ```

5. In the `rust` section, replace

   ```text
   - `Cargo.toml`: `edition = "2024"`, `license = "GPL-3.0-only"`,
     `publish = false`, `[lints.clippy]` `pedantic = "warn"`. `Cargo.lock` is
     committed. `rustfmt.toml` names edition 2024.
   ```

   with

   ```text
   - `Cargo.toml`: `edition = "2024"`, `license = "GPL-3.0-only"`,
     `publish = false`. `Cargo.lock` is committed. `rustfmt.toml` names
     edition 2024. Clippy's pedantic group is `#![warn(clippy::pedantic)]` in
     the source, not `[lints.clippy]`, which tombi cannot resolve a schema for
     and `--error-on-warnings` then fails.
   ```

6. In the "Name rules" table, replace the `rust` row

   ```text
   | `rust`               | Crate name               | `^[A-Za-z][A-Za-z0-9_-]{0,63}$`          |
   ```

   with

   ```text
   | `rust`               | Crate name               | `^[A-Za-z][A-Za-z0-9_-]{0,63}$`, and     |
   | `rust` with `lib`    |                          | `^[a-z][a-z0-9_-]{0,63}$`: a library's   |
   |                      |                          | name must be snake case for Clippy       |
   ```

7. In "Identity edits", replace the `module` row's three lines

   ```text
   | `module`           | The `repo_tmpl` token in declared files and paths      | rust with  |
   |                    |                                                        | `lib`,     |
   |                    |                                                        | nvim, zsh  |
   ```

   with

   ```text
   | `module`           | The `repo_tmpl` token, from `moduleName(rename)`, in   | rust with  |
   |                    | the contents of every file holding it                  | `lib`,     |
   |                    |                                                        | nvim, zsh  |
   ```

   and add, before the paragraph beginning "After every edit, `init` fails":
   "`moduleName` is built from a function of the repository's name, asks
   nothing of a repository with no token, and renames contents only; phase 5
   adds paths."

8. In "Development", replace

   ```text
   - `scripts/materialize.js <template> [--with <features>] <dir>` serves CI and
     `npm run templates:lock`, which regenerates each layer's `package-lock.json`
     or `Cargo.lock` in a materialised copy and writes it back to its layer.
   ```

   with

   ```text
   - `scripts/materialize.js <template> [--with <features>] <dir>` serves CI and
     regenerating a lock by hand: `npm install --package-lock-only` in an npm
     layer, or `cargo generate-lockfile` in a materialised `rust`, copied back.
   ```

   and replace

   ```text
   - Dependabot watches each layer holding a lock, `npm` for the npm layers and
     `cargo` for `/templates/rust`, with the `build(template)` and
     `ci(template)` prefixes.
   ```

   with

   ```text
   - Dependabot watches each layer holding a lock, `npm` for the npm layers, with
     the `build(template)` and `ci(template)` prefixes, and `github-actions` for
     each layer holding a workflow. `templates/rust` has no `cargo` entry: its
     lock holds only the crate, and the layer is not a buildable crate alone.
   ```

9. In "Deferred", item 1, replace "and the interactive prompt `npm run commit`
   gives." with "and the interactive prompt `npm run commit` gives, and a header
   held to 50 characters, not 72: committed's `subject_length` has no effect."

10. Replace

    ```text
    Whether `mise trust` must name `.config/mise/conf.d/*.toml` as well as the
    directory is verified during implementation; the command trusts whatever
    `mise run check` then reads.
    ```

    with

    ```text
    `mise trust` trusts the whole directory, `.config/mise/conf.d/*.toml`
    included, so the family runs no other trust command.
    ```

If a spec line no longer reads as quoted, change the text it names in the same
spirit and do not stop.

- [ ] **Step 5: Check the repository**

Run: `npm run check`

Expected: exit 0, and the tests report `# fail 0`. `lint:templates` runs Biome
in the materialised `rust` and `rust+lib`.

Run: `mise exec aqua:editorconfig-checker/editorconfig-checker@4.0.2 -- editorconfig-checker -disable-indent-size`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/specs/2026-09-30-multiple-templates-design.md
git commit -m "docs: Describe the rust template" \
    -m "Records where the built layers differ from the spec: committed's
header length, yamlfmt's two spaces, Clippy's pedantic as an attribute,
a lowercase library name, and the file task."
```

- [ ] **Step 7: Run it for real, as CI's dry run does**

Run, with no scratch state left from an earlier run:

```bash
rm -rf /tmp/e2e && mkdir /tmp/e2e
git config --global --get user.name >/dev/null || git config --global user.name "create-repo dry run"
git config --global --get user.email >/dev/null || git config --global user.email "create-repo@users.noreply.github.com"
for spec in "rust:" "rust:lib"; do
    GH_TOKEN="" node bin/create-repo.js my-tool \
        --template "${spec%%:*}" --with "${spec#*:}" \
        --description 'Dry run of "create-repo": a bundled template.' \
        --topics ci --scopes api --owner example \
        --dir "/tmp/e2e/${spec//:/+}" --no-metadata --dry-run --yes || break
done
```

Expected: both runs finish with `git commit` and exit 0. Each prints
`Stopped;` nowhere. Their log ends with the first commit, whose body is
`Generated by @chewygumxx/create-repo <version> (rust).` and `(rust, with
lib).` This is the slow step: it installs Rust with mise.

- [ ] **Step 8: Check what the runs made**

Run:

```bash
for dir in /tmp/e2e/rust+ /tmp/e2e/rust+lib; do
    echo "== $dir"
    git -C "$dir" log --format='%s%n%b' -1
    git -C "$dir" grep -n -e repo-tmpl -e repo_tmpl -e is_template -e 'Using this template' || echo "no identity"
    git -C "$dir" config core.hooksPath
    (cd "$dir" && mise run commitlint -- -1 HEAD && echo "commitlint ok")
done
grep -n '^name' /tmp/e2e/rust+/Cargo.toml /tmp/e2e/rust+lib/Cargo.toml
grep -n 'my_tool' /tmp/e2e/rust+lib/src/lib.rs
```

Expected, for each: the subject `chore: Initialise from template` and a body
naming the template; `no identity`; `.githooks`; `commitlint ok`. `Cargo.toml`
has `name        = "my-tool"`; `src/lib.rs` has `my_tool::greeting`.

- [ ] **Step 9: Check them with the shared CI tools**

The shared `lint-format` job runs tombi, shellcheck, shfmt, actionlint and
editorconfig-checker over a new repository. Run the same tools from
`chewygumxx/.github`'s `actions/mise.toml`, with its tombi configuration:

```bash
bash -c '
set -u
tools=$(mktemp -d)
gh api repos/chewygumxx/.github/contents/actions/mise.toml --jq .content | base64 -d |
    grep -v -E "prettier|yamllint|^node |uv\"" > "$tools/mise.toml"
mkdir "$tools/tombi" "$tools/lib"
gh api repos/chewygumxx/.github/contents/actions/config/tombi/config.toml --jq .content | base64 -d > "$tools/tombi/config.toml"
for f in filetype.sh tracked.sh; do
    gh api "repos/chewygumxx/.github/contents/actions/lib/$f" --jq .content | base64 -d > "$tools/lib/$f"
    chmod +x "$tools/lib/$f"
done
mise -C "$tools" trust --quiet && mise -C "$tools" install >/dev/null 2>&1
export PATH="$(mise -C "$tools" bin-paths | paste -sd:):$PATH" XDG_CONFIG_HOME=$tools
for dir in /tmp/e2e/rust+ /tmp/e2e/rust+lib; do
    cd "$dir" || exit 1
    echo "== $dir"
    mapfile -d "" toml < <(git ls-files -z "*.toml")
    tombi format --check --offline -- "${toml[@]}" >/dev/null 2>&1 && echo "tombi format ok" || echo "tombi format FAILED"
    tombi lint --error-on-warnings --offline -- "${toml[@]}" >/dev/null 2>&1 && echo "tombi lint ok" || echo "tombi lint FAILED"
    "$tools/lib/filetype.sh" sh | xargs -0 -r shellcheck -- && echo "shellcheck ok"
    "$tools/lib/filetype.sh" sh | xargs -0 -r shfmt --diff -- && echo "shfmt ok"
    actionlint && echo "actionlint ok"
    editorconfig-checker -disable-indent-size && echo "editorconfig ok"
done
'
```

Expected: `ok` for every line of both directories. A `FAILED` line names a
file the generated repository's CI would reject: run
`tombi format --offline <file>` there, copy the result back into the layer,
and rerun from Step 7.

- [ ] **Step 10: Clean up**

Run: `rm -rf /tmp/e2e && git status --short`

Expected: no output; the tree is clean.
