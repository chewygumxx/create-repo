---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/create-repo.git
  # ::: :/docs/plans/2026-10-01-multiple-templates-phase-5.md
  #
  #

ctime: 2026-10-01
title: >-
  Implementation Plan: multiple templates, phase 5
description: ""
tags: []
---

# Implementation Plan: multiple templates, phase 5

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `nvim` template: a Neovim plugin in Lua whose hygiene comes from
the native family, with its tests run in headless Neovim by mini.test, and
whose module is named for the repository, in code and in paths.

**Architecture:** One new layer, `nvim`, over `common` and `native`: the
plugin's `lua/`, `plugin/` and `doc/`, its `tests/`, the Lua tools'
configuration and a `.config/mise/conf.d/nvim.toml` that pins Neovim, LuaLS,
selene and luafmt and adds the `deps`, `lint:lua`, `lint:types`, `test:nvim`,
`format:lua` and `pre-commit:lua` tasks. The engine gains two things:
`moduleName` renames the paths that hold `repo_tmpl` as well as the contents,
and the sentinel guard learns the words the edits write, so a module that
holds the template's identity is not a leftover. The catalogue gains the
`nvim` entry and its module-name rule.

**Tech Stack:** As phase 4, plus Neovim 0.12, mini.test, luafmt (the
EmmyLua formatter), selene, and lua-language-server.

**Spec:**
[`docs/specs/2026-09-30-multiple-templates-design.md`](../specs/2026-09-30-multiple-templates-design.md),
its "Phases" item 5, "nvim", "Identity edits" and "Name rules". Phases 1 to 4
have landed on `main`; this plan builds on
[`2026-10-01-multiple-templates-phase-4.md`](2026-10-01-multiple-templates-phase-4.md).

## Global Constraints

- Node `>=24`; ES modules; every `.js` file starts with its header and
  `// @ts-check`, and is typechecked by `npm run typecheck`.
- No runtime dependency is added; `jsonc-parser` stays the only one.
- A new file's header follows its neighbours': the vim modeline, the SPDX
  line, `~chewygumxx/create-repo.git` (in the templates,
  `~chewygumxx/repo-tmpl.git`), and `::: :/<its path>`. The templates keep
  the `chewygumxx/repo-tmpl` identity; `lib/init.js` rewrites it, and a header
  names the file's path as the layer stores it, `repo_tmpl` included. A file
  that cannot carry a header (`.luarc.json`) has none.
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
- `standard`, `typescript`, `cloudflare` and `rust` output does not change.
- `UsageError` exits 2; `TemplateError` and `CommandError` exit 1.
- `nvim` has no feature, so the feature prompt and `--with` are not offered
  for it.
- Every file the layer adds passes the shared `lint-format` job of
  `chewygumxx/.github` as well as the repository's own `mise run check`:
  tombi's format and lint of TOML (the house `tombi/config.toml`),
  shellcheck and shfmt of scripts, actionlint of workflows, and
  editorconfig-checker with `-disable-indent-size`. Task 3 runs them.
- Every Lua file in the layer is luafmt's output (`.luafmt.toml`), since the
  generated repository's first `mise run check` runs `luafmt --check
  --verify`. Do not re-flow a Lua file by hand.

## Deviations from the Spec

Each was found by building the layer in a scratch copy and running it, with
the tools CI runs.

- **`lint:types` depends on `deps`, and mini.test is a LuaLS library.** The
  spec has `.luarc.json` read only Neovim's runtime. With every diagnostic
  group at `Any`, which is what makes the check strict, LuaLS reports the tests'
  untyped `require("mini.test")` as `no-unknown`. Naming `.tests/mini.test`
  in `workspace.library` types it, so the check needs the clone, and the
  task depends on `deps`. `.luarc.json` also sets `diagnostics.globals` to
  `vim`, for a machine where `$VIMRUNTIME` is not exported, and
  `workspace.ignoreDir` to `.tests`.
- **`lint:types` asserts on LuaLS's summary line.** Some releases print
  problems and exit 0, so the task passes only when the output says `no
  problems found`, as `nvim-config`'s CI does.
- **The sentinel guard learns the words the edits write.** A module name is
  the repository's name, changed, so a repository called `repo-tmpl.nvim`
  (module `repo-tmpl`) or a library `my-repo-tmpl` (crate `my_repo_tmpl`)
  would fail init after the copy and the whole toolchain install, as a
  leftover. `EditContext` gains `own`, the words an edit wrote from the
  identity, which `moduleName` fills. This also closes a minor the phase 4
  review left open.
- **`moduleName` renames paths, and refuses an overwrite.** The spec defers
  paths to this phase. A path that would land on an existing file is a
  `TemplateError`, and a directory the renames empty (`lua/repo_tmpl/`) is
  removed.
- **The user command is a fixed `:Hello`.** A command's name cannot hold `-`
  or `_`, which a module's can, so it cannot be the module. The README says to
  rename it with the plugin.
- **`vim.yml` has no `---` and two-space indent.** yamlfmt, which checks every
  native YAML file, deletes a document start and indents by two. Its
  modeline says `shiftwidth=2`.
- **The Lua is written for luafmt's output.** The formatter aligns the `=` of
  consecutive `local` statements and breaks a chained call one link per line,
  and a long name made one chained line wrap to something it would not then
  keep. The layer keeps every line that holds the module name to a simple
  call, and no README line holds it, so a name of 100 characters formats to
  a fixed point, and `mise run format` leaves `mise run check` passing.
- **The layer's root-level checks need the root `.editorconfig` widened.** The
  repository's Prettier hook reads the root's four spaces for `vim.yml`, as it
  did for the rust layer's YAML; the section covers both.
- **The dry run's `mise install` gets `MISE_GITHUB_TOKEN`.** Neovim and luafmt
  come through mise's `github:` backend, which reads release metadata from the
  API, and a shared runner's address is rate limited without a token. A plain
  `GITHUB_TOKEN` would also log `gh` in, which that step keeps out.
- **Cosmetic, left as it is:** the first `deps` clone prints git's `refs/tags/
  v0.18.0 ... is not a commit!`, since mini.test's tags are annotated. The
  clone is correct.
- **No Dependabot entry.** The layer holds no workflow and no lock. mise pins
  and mini.test's tag are bumped by hand, which the spec's Deferred list now
  says.

## Review Focus

1. A repository name GitHub allows and a Lua module cannot use
   (`my.plugin.nvim`, `nvim-`, `.nvim`, `1plugin`): refused with the rule
   before anything is copied (Task 2).
2. A module name with `-`, a leading `_`, or 57 characters: the generated
   repository's `mise run format` then `mise run check` passes, so the first
   commit's hooks do (Task 3, Step 6).
3. `moduleName` leaves neither an empty `lua/repo_tmpl/` directory nor the
   token in a path, and does not overwrite a file (Task 1).
4. A repository whose module holds the template's identity
   (`repo-tmpl.nvim`, `my-repo-tmpl`) is not reported as a leftover (Task 1).
5. `mise run test:nvim` fails when a test fails, when no test is collected and
   when mini.test is absent, and `lint:types` fails on a warning, so a green
   `mise run check` means something (Task 3, Step 8).

---

### Task 1: `moduleName` renames paths, and the guard knows what it wrote

**Files:**

- Modify: `lib/init.js`
- Test: `test/init.test.js`

**Interfaces:**

- Consumes: `EditContext`, the private `fail`, `squash` and `namesTemplate`,
  and Task 1 of phase 4's `moduleName(rename)` and the test helper `edited`.
- Produces: `EditContext.own: string[]`; `moduleName(rename)` that also renames
  every path holding `repo_tmpl`, updates `context.files`, removes the
  directories it empties, fails on an overwrite, and pushes its value to
  `context.own`. Task 2 lists it in the catalogue.

- [ ] **Step 1: Write the failing tests**

In `test/init.test.js`, add `readdirSync` to the `node:fs` import, after
`mkdtempSync`. Change the `edited` helper so `body` also receives the copy's
directory: its documentation and signature become

```js
/**
 * Runs `edits` over a copy holding only `files`, then hands `body` a reader
 * of the result, and the copy's directory.
 * @param {Record<string, string>} files
 * @param {import("../lib/init.js").Edit[]} edits
 * @param {(read: (file: string) => string, dir: string) => void} body
 * @param {Partial<typeof IDENTITY>} [changes]
 */
```

and its call to `body` becomes

```js
        body((file) => read(copy.dir, file), copy.dir);
```

Then insert before the test "moduleName asks nothing of a repository without
the token":

```js
test("moduleName renames the paths that hold the token, and removes the emptied directories", () =>
    edited(
        {
            "lua/repo_tmpl/init.lua": "return {}\n",
            "lua/repo_tmpl/health.lua": "return {}\n",
            "plugin/repo_tmpl.lua": "-- plugin\n",
            "doc/keep.txt": "keep\n",
        },
        [moduleName((name) => name)],
        (read, dir) => {
            assert.equal(read("lua/derived-repo/init.lua"), "return {}\n");
            assert.equal(read("lua/derived-repo/health.lua"), "return {}\n");
            assert.equal(read("plugin/derived-repo.lua"), "-- plugin\n");
            assert.equal(read("doc/keep.txt"), "keep\n");
            assert.deepEqual(readdirSync(join(dir, "lua")), ["derived-repo"]);
        },
    ));

test("moduleName leaves a path alone when the name is the token", () =>
    edited(
        { "repo_tmpl.txt": "repo_tmpl\n" },
        [moduleName(() => "repo_tmpl")],
        (read) => {
            assert.equal(read("repo_tmpl.txt"), "repo_tmpl\n");
        },
    ));

test("moduleName does not overwrite a file its name lands on", () => {
    assert.throws(
        () =>
            edited(
                { "repo_tmpl.txt": "a\n", "derived-repo.txt": "b\n" },
                [moduleName((name) => name)],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /derived-repo\.txt already exists/.test(error.message),
    );
});

// The module is the name, changed; the guard knows the name's own words, so
// it has to know the module's too.
test("a module name that holds the template's identity is not a leftover", () =>
    edited(
        { "a.txt": "repo_tmpl\n", "lua/repo_tmpl/init.lua": "x\n" },
        [moduleName((name) => name.replaceAll("-", "_"))],
        (read) => {
            assert.equal(read("a.txt"), "my_repo_tmpl\n");
            assert.equal(read("lua/my_repo_tmpl/init.lua"), "x\n");
        },
        { name: "my-repo-tmpl" },
    ));
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/init.test.js`

Expected: FAIL, four tests, each with a `TemplateError` `init: the template's
identity remains in ...` from the guard, since nothing renames a path or tells
the guard about a module: "moduleName renames the paths that hold the token,
and removes the emptied directories" in `lua/repo_tmpl/health.lua,
lua/repo_tmpl/init.lua, plugin/repo_tmpl.lua`; "moduleName leaves a path alone
when the name is the token" in `repo_tmpl.txt`; "moduleName does not overwrite
a file its name lands on", whose error check fails on the same message; and "a
module name that holds the template's identity is not a leftover" in `a.txt,
lua/repo_tmpl/init.lua`. The other 31 pass.

- [ ] **Step 3: Teach the guard and rename the paths**

In `lib/init.js`, replace the two imports

```js
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
```

with

```js
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmdirSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
```

In the `EditContext` typedef, after `@property {string} today YYYY-MM-DD`, add

```js
 * @property {string[]} own words an edit wrote from the identity, such as a
 *     module's name, which the guard does not take for the template's
```

Replace the tail of `namesTemplate`'s documentation and its head. The text

```js
 * description counts as the description too.
 * @param {Identity} identity
 * @returns {(text: string) => boolean}
 */
function namesTemplate({ owner, name, description, topics, scopes }) {
    const own = [
        owner,
```

becomes

```js
 * description counts as the description too. `written` are the words the
 * edits made from the identity.
 * @param {Identity} identity
 * @param {string[]} written
 * @returns {(text: string) => boolean}
 */
function namesTemplate({ owner, name, description, topics, scopes }, written) {
    const own = [
        ...written,
        owner,
```

In `rewrite`, add `own: [],` after `today,` in `context`, and change
`const remaining = namesTemplate(identity);` to

```js
    const remaining = namesTemplate(identity, context.own);
```

Replace the whole of `moduleName`, its documentation included, with:

```js
/**
 * Removes `path`, relative to `dir`, and each of its parents up to `dir`,
 * for as long as they are empty.
 * @param {string} dir
 * @param {string} path
 */
function pruneEmpty(dir, path) {
    for (let at = path; at !== "."; at = dirname(at)) {
        if (readdirSync(join(dir, at)).length) return;
        rmdirSync(join(dir, at));
    }
}

/**
 * The template's `repo_tmpl` token, an identifier where `repo-tmpl` is a
 * slug, in every file that holds it, and in every path. A repository with
 * none is left alone, since a layer such as `rust-bin` has no module to name.
 * A path that would land on an existing file is an error, not an overwrite.
 * @param {(name: string) => string} rename the module's name for the
 *     repository's
 * @returns {Edit}
 */
export function moduleName(rename) {
    return (context) => {
        const {
            dir,
            identity: { name },
        } = context;
        const value = rename(name);
        context.own.push(value);
        for (const file of context.files) {
            const path = join(dir, file);
            const text = readFileSync(path, "utf8");
            if (!text.includes("repo_tmpl")) continue;
            // A function, so `$&` and `$1` in the name are not patterns.
            writeFileSync(
                path,
                text.replaceAll("repo_tmpl", () => value),
            );
        }
        context.files = context.files.map((file) => {
            const renamed = file.replaceAll("repo_tmpl", () => value);
            if (renamed === file) return file;
            const target = join(dir, renamed);
            if (existsSync(target)) {
                fail(
                    `${renamed} already exists: the module name would overwrite it`,
                );
            }
            mkdirSync(dirname(target), { recursive: true });
            renameSync(join(dir, file), target);
            pruneEmpty(dir, dirname(file));
            return renamed;
        });
    };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/init.js test/init.test.js && node --test test/init.test.js && npx --no -- tsc`

Expected: PASS, every test in the file, and `tsc` silent.

- [ ] **Step 5: Commit**

```bash
git add lib/init.js test/init.test.js
git commit -m "feat: Rename the paths moduleName finds" \
    -m "A layer names its module in directories and files too, such as
lua/repo_tmpl/. A path that would overwrite a file is an error, an emptied
directory is removed, and the guard takes the word moduleName writes for
the repository's own, as it does the name, so a module that holds the
template's identity is not a leftover."
```

### Task 2: The `nvim` template

**Files:**

- Create: `templates/nvim/` (14 files)
- Modify: `.editorconfig`, `lib/templates.js`
- Test: `test/templates.test.js`, `test/bin.test.js`

**Interfaces:**

- Consumes: Task 1's `moduleName`; phase 4's `committedScopes`; phase 1's
  `headers`, `repoMetadata`, `readme`, `UsageError`; `compose`, `copyTemplate`,
  `TEMPLATES_DIR` from `lib/template.js`; `FAMILIES.native`.
- Produces: `TEMPLATES.nvim` with no feature, layers
  `["common", "native", "nvim"]`, edits `[headers, repoMetadata, readme,
  committedScopes, moduleName(nvimModule)]`, and a `checkName` refusing a
  repository whose module, its name without an `nvim-` prefix and a `.nvim`
  suffix, is not a Lua module name. Task 3 documents them.

- [ ] **Step 1: Write the failing tests**

In `test/templates.test.js`, insert before the test "typescript takes publish
by default at the prompt" (after the last `rust` test):

```js
test("nvim is the native layer, a Lua plugin and its tests", () => {
    const sources = compose(TEMPLATES.nvim.layers(new Set()));
    for (const [file, layer] of [
        ["mise.toml", "native"],
        ["committed.toml", "native"],
        [".githooks/pre-commit", "native"],
        [".github/workflows/ci.yaml", "native"],
        [".config/mise/conf.d/nvim.toml", "nvim"],
        [".luafmt.toml", "nvim"],
        [".luarc.json", "nvim"],
        ["selene.toml", "nvim"],
        ["vim.yml", "nvim"],
        ["lua/repo_tmpl/init.lua", "nvim"],
        ["lua/repo_tmpl/health.lua", "nvim"],
        ["plugin/repo_tmpl.lua", "nvim"],
        ["doc/repo_tmpl.txt", "nvim"],
        ["tests/minimal_init.lua", "nvim"],
        ["tests/run.lua", "nvim"],
        ["tests/test_repo_tmpl.lua", "nvim"],
        ["_gitignore", "nvim"],
        ["README.md", "nvim"],
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            new RegExp(`templates/${layer}/`),
            file,
        );
    }
    for (const file of ["package.json", "Cargo.toml", "src/main.rs"]) {
        assert.ok(!sources.has(file), file);
    }
    const ignored = readFileSync(sources.get("_gitignore") ?? "", "utf8");
    assert.match(ignored, /^\/\.tests\/$/m);
    assert.match(ignored, /^\/doc\/tags$/m);
});

test("nvim has no features", () => {
    assert.deepEqual(TEMPLATES.nvim.features, {});
    assert.equal(TEMPLATES.nvim.family, "native");
});

// mini.test is cloned at this tag by `deps`, and LuaLS reads it as a library,
// so the two must be one thing.
test("the nvim layer names one mini.test tag, which its types read", () => {
    const toml = readFileSync(
        join(TEMPLATES_DIR, "nvim", ".config/mise/conf.d/nvim.toml"),
        "utf8",
    );
    assert.equal(
        toml.match(/MINI_TEST_TAG\s*=\s*"v\d+\.\d+\.\d+"/g)?.length,
        1,
    );
    const luarc = JSON.parse(
        readFileSync(join(TEMPLATES_DIR, "nvim", ".luarc.json"), "utf8"),
    );
    assert.ok(luarc["workspace.library"].includes(".tests/mini.test"));
    assert.ok(luarc["workspace.ignoreDir"].includes(".tests"));
});

test("a plugin's module is the name without .nvim or nvim-, and a Lua name", () => {
    const { checkName } = TEMPLATES.nvim;
    assert.ok(checkName);
    /** @param {string} name */
    const check = (name) => checkName({ owner: "example", name }, new Set());
    for (const name of [
        "a",
        "my-plugin",
        "my-plugin.nvim",
        "nvim-my-plugin",
        "nvim-my-plugin.nvim",
        "_x",
        "My_Plugin2",
        "a".repeat(100),
    ]) {
        assert.doesNotThrow(() => check(name), name);
    }
    for (const name of [
        "my.plugin",
        "my.plugin.nvim",
        "nvim-",
        ".nvim",
        "nvim-.nvim",
        "1plugin",
        "nvim-1plugin",
        "-plugin",
        "my plugin",
    ]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError && /module/.test(error.message),
            name,
        );
    }
});

test("nvim is initialised with the module's name in every path", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
    try {
        const dir = join(root, "x");
        const files = copyTemplate(
            dir,
            layersOf({ template: "nvim", features: [] }),
        );
        init(dir, { ...IDENTITY, name: "nvim-derived.nvim" }, files, {
            edits: TEMPLATES.nvim.edits,
            today: "2026-10-01",
        });
        /** @param {string} file */
        const at = (file) => readFileSync(join(dir, file), "utf8");
        for (const file of [
            "lua/derived/init.lua",
            "lua/derived/health.lua",
            "plugin/derived.lua",
            "doc/derived.txt",
            "tests/test_derived.lua",
        ]) {
            assert.ok(existsSync(join(dir, file)), file);
        }
        assert.ok(!existsSync(join(dir, "lua/repo_tmpl")));
        assert.match(
            at("lua/derived/init.lua"),
            /^-- ::: :\/lua\/derived\/init\.lua$/m,
        );
        assert.match(
            at("lua/derived/init.lua"),
            /^-- ~example\/nvim-derived\.nvim\.git$/m,
        );
        assert.match(at("plugin/derived.lua"), /vim\.g\["loaded_derived"\]/);
        assert.match(at("committed.toml"), /^ {4}"api",$/m);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
```

In `test/bin.test.js`, add `readdirSync` to the `node:fs` import, after
`mkdtempSync`. In `runBin`'s returned object add, after `lib`:

```js
            lua: existsSync(join(dir, "lua"))
                ? readdirSync(join(dir, "lua"))
                : undefined,
```

and insert before the test "publish names the package @owner/name and the
commit" (after the last `rust` test):

```js
test("nvim is copied, initialised and run through mise, not npm", () => {
    const { commit, lua, lines } = dryRun(["--template", "nvim"]);
    assert.match(commit, /\(nvim\)\./);
    assert.deepEqual(lua, ["x"]);
    const env = lines.findIndex((line) => line.startsWith("mise env"));
    assert.deepEqual(
        lines
            .slice(env + 1)
            .map((line) => line.split(" ").slice(0, 2).join(" ")),
        ["git add", "mise run", "git add", "mise run", "git commit"],
        lines.join("\n"),
    );
});

test("nvim names its module without the affixes", () => {
    const run = runBin((root) => [
        "nvim-my-tool.nvim",
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
        "nvim",
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.deepEqual(run.lua, ["my-tool"]);
});

test("a name a Lua module cannot use stops before anything is copied", () => {
    for (const name of ["my.plugin.nvim", "nvim-", "1plugin"]) {
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
            "nvim",
        ]);
        assert.equal(result.status, 2, name);
        assert.match(result.stderr, /module/, name);
        assert.ok(!copied, name);
    }
});
```

In "--help lists the templates", add:

```js
    assert.match(result.stdout, /\n {2}nvim {8}A Neovim plugin/);
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/templates.test.js test/bin.test.js`

Expected: FAIL. In `templates.test.js`, the `nvim` tests with
`TypeError: Cannot read properties of undefined (reading 'layers')` (and
`'features'`, `'family'`, and a failed destructure of `checkName`), and the
mini.test tag test with `ENOENT` on `templates/nvim/...`. In `bin.test.js`, the
three `nvim` tests with `Unknown template "nvim"` (the last for the
`/module/` match), and "--help lists the templates". Every other test passes.

- [ ] **Step 3: Indent the layer's YAML by two**

In `.editorconfig`, replace

```ini
# ----------------------------------------------------------------------
# The rust layer's YAML, which the native layer's yamlfmt indents by two
# ----------------------------------------------------------------------
[templates/rust/**.{yaml,yml}]
indent_size = 2
```

with

```ini
# -------------------------------------------------------------------------
# A native template's YAML, which the native layer's yamlfmt indents by two
# -------------------------------------------------------------------------
[templates/{rust,nvim}/**.{yaml,yml}]
indent_size = 2
```

- [ ] **Step 4: Commit**

```bash
git add .editorconfig
git commit -m "chore: Indent the nvim layer's YAML by two" \
    -m "Its files are copied over the native layer, whose .editorconfig
sets two, but Prettier here reads the root's four for a sibling
directory, as it did for the rust layer."
```

- [ ] **Step 5: Add the nvim layer**

Each file below is written exactly as shown. They were built in a scratch
copy and run with the tools CI runs; the Lua is luafmt's output, and the TOML
and YAML those tools' output, so do not re-flow them by hand. Nothing in the
layer is executable.

`templates/nvim/.config/mise/conf.d/nvim.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.config/mise/conf.d/nvim.toml
#
#

#
# https://mise.jdx.dev/configuration.html
#
# Neovim's tools and tasks, merged into `mise.toml`'s aggregates: mise reads
# every file in this directory beside it.
#

#
# The same repository ships `luafmt`, `emmylua_check` and `emmylua_doc_cli` as
# independent per-platform assets, and a `[tools]` key has to be unique, so
# `luafmt` is an alias for the one backend. `matching` narrows the candidate
# assets, keeping the choice of OS and architecture automatic; it has to be set
# on the `[tools]` entry, not on the alias, where it is ignored.
#
[tool_alias.luafmt]
backend = "github:EmmyLuaLs/emmylua-analyzer-rust"

[tools]
"github:neovim/neovim"           = "0.12.5"
"aqua:LuaLS/lua-language-server" = "3.19.1"
"aqua:Kampfkarren/selene"        = "0.31.0"
luafmt                           = { version = "0.25.1", matching = "luafmt" }

[tasks.deps]
description = "Clone mini.test at its pinned tag into .tests/"
env         = { MINI_TEST_TAG = "v0.18.0" }
run         = """
if [ "$(git -C .tests/mini.test describe --tags 2>/dev/null)" != "$MINI_TEST_TAG" ]; then
    rm -rf .tests/mini.test
    git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$MINI_TEST_TAG" \\
        https://github.com/nvim-mini/mini.test .tests/mini.test
fi
"""

[tasks."lint:lua"]
description = "Lua format (luafmt) and lint (selene)"
run         = """
git ls-files -z '*.lua' | xargs -0 -r luafmt --check --verify
git ls-files -z '*.lua' | xargs -0 -r selene
"""

[tasks."lint:types"]
description = "lua-language-server's check, with every warning a failure"
depends     = [ "deps" ]
# `$VIMRUNTIME` and mini.test, which `deps` clones, are `.luarc.json`'s
# `workspace.library`, so the tests' types are known. Some
# releases report problems and still exit 0, so the summary line is what is
# asserted on.
run         = """
export VIMRUNTIME=$(nvim --headless --clean --cmd 'lua io.stdout:write(vim.env.VIMRUNTIME)' --cmd quit)
out=$(lua-language-server --check=. --checklevel=Warning --logpath="$(mktemp -d)" 2>&1) || status=$?
printf '%s\\n' "$out"
case $out in
*"no problems found"*) exit "${status:-0}" ;;
*) exit 1 ;;
esac
"""

[tasks."test:nvim"]
description = "The plugin's tests, in headless Neovim"
depends     = [ "deps" ]
run         = "nvim --headless -u tests/minimal_init.lua -l tests/run.lua"

[tasks."format:lua"]
description = "Apply luafmt"
run         = "git ls-files -z '*.lua' | xargs -0 -r luafmt --write"

[tasks."pre-commit:lua"]
description = "luafmt's check and selene on staged files"
run         = """
git diff -z --cached --name-only --diff-filter=ACMR -- '*.lua' | xargs -0 -r luafmt --check --verify
git diff -z --cached --name-only --diff-filter=ACMR -- '*.lua' | xargs -0 -r selene
"""
```

`templates/nvim/.luafmt.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.luafmt.toml
#
#

#
# https://github.com/EmmyLuaLs/emmylua-analyzer-rust/blob/main/docs/emmylua_formatter/options_EN.md
#

[syntax]
level = "LuaJIT"

[indent]
kind  = "Space"
width = 4

[layout]
max_line_width                       = 80
prefer_call_args_layout_from_source  = true
prefer_table_layout_from_source      = true
prefer_chain_break_on_statement_tail = true
prefer_binary_chain_operand_per_line = true

[output]
quote_style               = "Double"
trailing_comma            = "Always"
trailing_table_separator  = "Multiline"
single_arg_call_parens    = "Always"
simple_lambda_single_line = "Never"      # Selene doesn't like this either

[spacing]
space_before_lambda_func_paren = false

[comments]
align_in_statements = true

[align]
continuous_assign_statement = true
table_field                 = true  # I cannot remember why I turned this off
```

`templates/nvim/.luarc.json`:

```json
{
    "$schema": "https://raw.githubusercontent.com/LuaLS/vscode-lua/master/setting/schema.json",
    "runtime.version": "LuaJIT",
    "runtime.path": ["lua/?.lua", "lua/?/init.lua"],
    "runtime.pathStrict": true,
    "workspace.checkThirdParty": false,
    "workspace.ignoreDir": [".tests"],
    "workspace.library": ["$VIMRUNTIME/lua", ".tests/mini.test"],
    "diagnostics.globals": ["vim"],
    "diagnostics.groupFileStatus": {
        "luadoc": "Any",
        "strict": "Any",
        "strong": "Any",
        "type-check": "Any"
    }
}
```

`templates/nvim/selene.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/selene.toml
#
#

std = "lua51+vim"
```

`templates/nvim/vim.yml`:

```yaml
# vim:set expandtab shiftwidth=2 filetype=yaml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/vim.yml
#
#

# selene standard library for Neovim's `vim` global. Referenced from
# `selene.toml`'s `std`; see https://kampfkarren.github.io/selene/usage/std.html
globals:
  vim:
    any: true
```

`templates/nvim/lua/repo_tmpl/init.lua`:

```lua
-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/lua/repo_tmpl/init.lua
--
--

local M = {}

---@class repo_tmpl.Config
---@field greeting string The word the greeting opens with.

---@type repo_tmpl.Config
M.defaults = {
    greeting = "Hello",
}

---@type repo_tmpl.Config
M.config = vim.deepcopy(M.defaults)

--- Merges `opts` over the defaults. Calling it is optional.
---@param opts? repo_tmpl.Config
function M.setup(opts)
    M.config = vim.tbl_deep_extend("force", M.defaults, opts or {})
end

--- The greeting for `name`, or for the world.
---@param name? string
---@return string greeting
function M.greet(name)
    return ("%s, %s!"):format(M.config.greeting, name or "world")
end

return M
```

`templates/nvim/lua/repo_tmpl/health.lua`:

```lua
-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/lua/repo_tmpl/health.lua
--
--

local M = {}

--- What `:checkhealth repo_tmpl` reports.
function M.check()
    vim.health.start("repo_tmpl")
    if vim.fn.has("nvim-0.10") == 1 then
        vim.health.ok("Neovim 0.10 or newer")
    else
        vim.health.error("Neovim 0.10 or newer is required")
    end
end

return M
```

`templates/nvim/plugin/repo_tmpl.lua`:

```lua
-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/plugin/repo_tmpl.lua
--
--

if vim.g["loaded_repo_tmpl"] then
    return
end
vim.g["loaded_repo_tmpl"] = 1

---@param args vim.api.keyset.create_user_command.command_args
local function hello(args)
    local plugin = require("repo_tmpl")
    vim.notify(plugin.greet(args.fargs[1]))
end

vim.api.nvim_create_user_command("Hello", hello, {
    nargs = "?",
    desc = "Greet someone, or the world",
})
```

`templates/nvim/doc/repo_tmpl.txt`:

```text
# vim:set textwidth=78 tabstop=8 filetype=help:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/doc/repo_tmpl.txt
#
#

*repo_tmpl.txt*  A Neovim plugin

==============================================================================
CONTENTS                                                     *repo_tmpl-contents*

    1. SETUP ........................................................|repo_tmpl-setup|
    2. COMMANDS ..................................................|repo_tmpl-commands|

==============================================================================
SETUP                                                           *repo_tmpl-setup*

Calling `setup()` is optional; it merges its options over the defaults.
>lua
    require("repo_tmpl").setup({ greeting = "Hello" })
<

==============================================================================
COMMANDS                                                     *repo_tmpl-commands*

:Hello [{name}]                                                          *:Hello*
    Greets {name}, or the world.

 vim:tw=78:ts=8:ft=help:norl:
```

`templates/nvim/tests/minimal_init.lua`:

```lua
-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/tests/minimal_init.lua
--
--

-- The runtimepath of a test run: this plugin, Neovim's own runtime and
-- mini.test, and nothing from the machine's configuration, so a run means the
-- same everywhere.
--
--     nvim --headless -u tests/minimal_init.lua -l tests/run.lua

local source    = debug.getinfo(1, "S").source
local root      = vim.fn.fnamemodify(source:sub(2), ":p:h:h")
local mini_test = root .. "/.tests/mini.test"

if vim.fn.isdirectory(mini_test) == 0 then
    local message = "mini.test is not installed at %s: run `mise run deps`"
    error(message:format(mini_test))
end

vim.o.runtimepath = table.concat({ root, vim.env.VIMRUNTIME, mini_test }, ",")
```

`templates/nvim/tests/run.lua`:

```lua
-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/tests/run.lua
--
--

-- Runs every `tests/test_*.lua`. mini.test exits 0 when nothing failed, and a
-- run that collected nothing has nothing to fail, so an empty collection is an
-- error here.
--
--     nvim --headless -u tests/minimal_init.lua -l tests/run.lua

local MiniTest = require("mini.test")

local function find_files()
    return vim.fn.glob("tests/test_*.lua", true, true)
end

if #MiniTest.collect({ find_files = find_files }) == 0 then
    error("collected no tests under " .. vim.fn.getcwd() .. "/tests")
end

MiniTest.run({ collect = { find_files = find_files } })
```

`templates/nvim/tests/test_repo_tmpl.lua`:

```lua
-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/tests/test_repo_tmpl.lua
--
--

local MiniTest = require("mini.test")
local plugin   = require("repo_tmpl")
local eq       = MiniTest.expect.equality

local T = MiniTest.new_set({
    hooks = {
        pre_case = function()
            plugin.setup()
            vim.g["loaded_repo_tmpl"] = nil
        end,
    },
})

T["greets the world by default"] = function()
    eq(plugin.greet(), "Hello, world!")
end

T["greets a name"] = function()
    eq(plugin.greet("Neovim"), "Hello, Neovim!")
end

T["setup merges its options over the defaults"] = function()
    plugin.setup({ greeting = "Hi" })
    eq(plugin.greet(), "Hi, world!")
    eq(plugin.defaults.greeting, "Hello")
end

T["loading the plugin defines :Hello once"] = function()
    vim.cmd.runtime("plugin/repo_tmpl.lua")
    eq(vim.fn.exists(":Hello"), 2)
    eq(vim.g["loaded_repo_tmpl"], 1)
end

T["the help tags build"] = function()
    local source = vim.fn.readfile("doc/repo_tmpl.txt")
    local dir    = vim.fn.tempname()
    vim.fn.mkdir(dir, "p")
    vim.fn.writefile(source, dir .. "/repo_tmpl.txt")
    vim.cmd.helptags(dir)
    eq(vim.fn.filereadable(dir .. "/tags"), 1)
end

return T
```

`templates/nvim/_gitignore`:

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
/.tests/
/doc/tags
```

`templates/nvim/README.md`:

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
(luafmt, selene, lua-language-server, Biome, rumdl, yamlfmt, yamllint), tests
in headless Neovim (mini.test), GitHub automation (header and repository
metadata sync, Dependabot) and Claude Code settings and hooks, all without npm.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
npm create @chewygumxx/repo my-plugin.nvim -- --template nvim
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

The toolchain is pinned in `mise.toml` and `.config/mise/conf.d/nvim.toml`, and
`mise install` installs it, Neovim included, and wires the git hooks in
`.githooks/`.

- `mise run deps` clones mini.test, at the tag `.config/mise/conf.d/nvim.toml`
  pins, into `.tests/`; `mise run test:nvim` depends on it.
- `mise run check` runs the checks CI runs: luafmt's check and selene,
  lua-language-server with every warning a failure, the tests, Biome's format
  and lint checks, Markdown lint (rumdl), the YAML checks (yamlfmt, then
  yamllint) and a check that rejects em dashes.
- `mise run format` applies luafmt, Biome's formatting, and yamlfmt's to YAML,
  which Biome does not read.
- `mise run commitlint -- <revision>...` lints the commit messages the
  revisions name, as CI does: `origin/main..HEAD`, or `-1 HEAD`.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs committed, which holds each message to Conventional Commits with the types
and scopes in `committed.toml`.

## Layout

The module is named for the repository, without a `.nvim` suffix or an `nvim-`
prefix, so `my-plugin.nvim` and `nvim-my-plugin` both make `my-plugin`. Its name
is the directory under `lua/`, the file in `plugin/` and the help file in
`doc/`.

- `lua/`: the plugin. `init.lua` has `setup(opts)` and the example function,
  and `health.lua` what `:checkhealth` reports.
- `plugin/`: a load guard, so the plugin loads once, and the example user
  command `:Hello`. Rename it with the plugin.
- `doc/`: the help file. Run `:helptags doc` to use it from a checkout.
- `tests/`: mini.test's `test_*.lua` files, `minimal_init.lua`, which gives a
  run a runtimepath of only this plugin, Neovim's runtime and mini.test, and
  `run.lua`, which fails when it collects no test.
````

- [ ] **Step 6: Commit the layer**

```bash
git add templates/nvim
git commit -m "feat(template): Add the nvim layer" \
    -m "A Lua plugin, its mini.test suite and the Lua tools as mise
tasks merged into the native aggregates: luafmt and selene, LuaLS with
every warning a failure, and tests in headless Neovim."
```

- [ ] **Step 7: Add the catalogue entry**

In `lib/templates.js`, before `/** The identity edits every npm template
makes. */`, add:

```js
/**
 * The module a repository's name gives a plugin: the name without a `.nvim`
 * suffix or an `nvim-` prefix.
 * @param {string} name
 */
const nvimModule = (name) => name.replace(/^nvim-/, "").replace(/\.nvim$/, "");

/**
 * A plugin's module is the directory under `lua/`, the file in `plugin/` and
 * `doc/`, and the string `require` takes: letters, digits, `-` and `_`, not
 * starting with a digit or `-`. GitHub allows more, so the name is refused,
 * not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function luaModuleName({ name }) {
    const lua = nvimModule(name);
    if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(lua)) return;
    throw new UsageError(
        `The plugin's module "${lua}" (the repository name without a ".nvim" suffix or an "nvim-" prefix) is not valid: use letters, digits, "-" and "_", starting with a letter or "_".`,
    );
}
```

and add to `TEMPLATES`, after `rust`:

```js
    nvim: {
        description:
            "A Neovim plugin in Lua, tested in headless Neovim with mini.test, without npm",
        family: "native",
        features: {},
        layers: () => ["common", "native", "nvim"],
        edits: [
            headers,
            repoMetadata,
            readme,
            committedScopes,
            moduleName(nvimModule),
        ],
        checkName: luaModuleName,
    },
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/templates.js test/templates.test.js test/bin.test.js && npm test`

Expected: PASS, the whole suite, 174 tests. In particular "every combination
copies and initialises, leaving no identity" now covers `nvim`, and "every
template header names the template and its own path" covers the new layer.

- [ ] **Step 9: Commit**

```bash
git add lib/templates.js test/templates.test.js test/bin.test.js
git commit -m "feat: Add the nvim template"
```

### Task 3: CI, documentation and the real run

**Files:**

- Modify: `.github/workflows/create-repo.yaml`, `README.md`,
  `docs/specs/2026-09-30-multiple-templates-design.md`

**Interfaces:**

- Consumes: Task 2's layer and catalogue entry.
- Produces: nothing later tasks use. The phase is done when `npm run check`
  passes, the repository's `editorconfig-checker` passes, and a real run of
  `nvim` creates repositories whose own `mise run check`, hooks and
  `commitlint` task pass, and whose tests and type check fail when they should.

- [ ] **Step 1: Give the dry run a token for mise**

In `.github/workflows/create-repo.yaml`, in the `Dry Run` step's `env`, replace

```yaml
              env:
                  GH_TOKEN: ""
                  TEMPLATE: ${{ matrix.template }}
```

with

```yaml
              env:
                  GH_TOKEN: ""
                  # mise's github: backend (Neovim, luafmt) reads release
                  # metadata from the API, which a shared runner is rate
                  # limited on without a token. Not GITHUB_TOKEN: that would
                  # log gh in.
                  MISE_GITHUB_TOKEN: ${{ github.token }}
                  TEMPLATE: ${{ matrix.template }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/create-repo.yaml
git commit -m "ci: Give the dry run a token for mise"
```

- [ ] **Step 3: Document the template**

In `README.md`, add to the templates table, after the `rust` rows:

```markdown
| `nvim`       | A Neovim plugin in Lua without npm, tested in headless    |
|              | Neovim with mini.test, checked with mise                  |
```

Replace the paragraph that begins "Each template is an ordered list of layers"
with:

```markdown
Each template is an ordered list of layers under `templates/`, declared in
`lib/templates.js`: a later layer's file replaces the same file from an
earlier one. `common` holds what every repository carries, `npm` the
npm-based checks, `typescript` its sources, `typescript-publish` what
`--with publish` replaces and adds, and `cloudflare` the Worker. `native` is
the hygiene layer without npm: mise pins the tools and aggregates the tasks,
`committed` lints commit messages, and Biome, rumdl, yamlfmt and yamllint
carry copies of the shared configurations. `rust` adds Cargo and its mise
tasks, and `rust-bin` or `rust-lib` the source. `nvim` adds the plugin, its
tests and the Lua tools' mise tasks. A layer that holds a `package.json` holds
its lock; regenerate it with `npm install --package-lock-only` in the layer's
directory. `rust` holds its `Cargo.lock`: materialise the template, run
`cargo generate-lockfile` there, and copy the file back.
```

and, in the paragraph on the templates' identity, replace "`rust`
with `lib` names its crate in a doc test as `repo_tmpl`, which the
`moduleName` edit rewrites." with

```markdown
`rust`
with `lib` names its crate in a doc test as `repo_tmpl`, and `nvim` names its
module so in code and in paths (`lua/repo_tmpl/`); the `moduleName` edit
rewrites them.
```

- [ ] **Step 4: Amend the spec**

In `docs/specs/2026-09-30-multiple-templates-design.md`, make these edits,
each replacing the exact old text with the new:

1. In "Identity edits", replace the `module` row

   ```text
   | `module`           | The `repo_tmpl` token, from `moduleName(rename)`, in   | rust with  |
   |                    | the contents of every file holding it                  | `lib`,     |
   |                    |                                                        | nvim, zsh  |
   ```

   with

   ```text
   | `module`           | The `repo_tmpl` token, from `moduleName(rename)`, in   | rust with  |
   |                    | the contents and path of every file holding it         | `lib`,     |
   |                    |                                                        | nvim, zsh  |
   ```

2. In "Identity edits", replace the paragraph on `moduleName`

   ```text
   `moduleName` is built from a function of the repository's name, asks nothing of
   a repository with no token, and renames contents only; phase 5 adds paths.
   ```

   with

   ```text
   `moduleName` is built from a function of the repository's name, asks nothing of
   a repository with no token, and renames paths as well as contents. A path that
   would land on an existing file is an error, and a directory it empties is
   removed. The guard takes the word it writes for the repository's own, as it
   does the name and description, so a name that holds `repo-tmpl` is not a
   leftover.
   ```

3. In the "Name rules" table, replace the `nvim` row

   ```text
   | `nvim`               | Lua module               | `^[A-Za-z_][A-Za-z0-9_-]*$` once affixes |
   |                      |                          | are removed                              |
   ```

   with

   ```text
   | `nvim`               | Lua module               | `^[A-Za-z_][A-Za-z0-9_-]*$` once affixes |
   |                      |                          | are removed: `nvim-` first, then `.nvim` |
   ```

4. In "nvim", replace

   ```text
   - Tools: `github:neovim/neovim` (a pinned stable release),
     `aqua:LuaLS/lua-language-server`, `aqua:Kampfkarren/selene`, and `luafmt`
     through `tool_alias` and `matching` as in `nvim-config`.
   ```

   with

   ```text
   - Tools: `github:neovim/neovim` (0.12.5, the stable release `nvim-config`
     pins), `aqua:LuaLS/lua-language-server`, `aqua:Kampfkarren/selene`, and
     `luafmt` through `tool_alias` and `matching` as in `nvim-config`.
   ```

5. In "nvim", replace

   ```text
   - `lua/repo_tmpl/init.lua` (`setup(opts)` over defaults with
     `vim.tbl_deep_extend`), `lua/repo_tmpl/health.lua`, `plugin/repo_tmpl.lua`
     (a load guard and one user command), `doc/repo_tmpl.txt`,
   ```

   with

   ```text
   - `lua/repo_tmpl/init.lua` (`setup(opts)` over defaults with
     `vim.tbl_deep_extend`), `lua/repo_tmpl/health.lua`, `plugin/repo_tmpl.lua`
     (a load guard and one user command, `:Hello`: its name is fixed, since a
     command's cannot hold the `-` or `_` a module's can), `doc/repo_tmpl.txt`,
   ```

6. In "nvim", replace

   ```text
   - `.luarc.json` (LuaJIT, the `vim` global), `selene.toml` with `vim.yml`
     (`std = "lua51+vim"`), `.luafmt.toml` as in `nvim-config`.
   ```

   with

   ```text
   - `.luarc.json` (LuaJIT, the `vim` global, and `$VIMRUNTIME/lua` and mini.test
     as libraries, so the tests' types are known), `selene.toml` with `vim.yml`
     (`std = "lua51+vim"`, in two-space YAML like every native file), and
     `.luafmt.toml` as in `nvim-config`.
   ```

7. In "nvim", replace

   ```text
   - Tasks: `deps` clones mini.test at a pinned tag into `.tests/`; `lint:lua`
     (selene, `luafmt --check`); `lint:types` (lua-language-server `--check`,
     failing at warnings); `test:nvim` (depends on `deps`; `nvim --headless -u
     tests/minimal_init.lua -l tests/run.lua`); `format:lua`; `pre-commit:lua`.
   - `tests/run.lua` fails when it collects no test.
   - `_gitignore` adds `/.tests/`.
   ```

   with

   ```text
   - Tasks: `deps` clones mini.test at a pinned tag (v0.18.0) into `.tests/`;
     `lint:lua` (selene, `luafmt --check --verify`); `lint:types` (depends on
     `deps`; lua-language-server `--check`, failing at warnings, which it asserts
     on the summary line, since some releases exit 0 with problems); `test:nvim`
     (depends on `deps`; `nvim --headless -u tests/minimal_init.lua -l
     tests/run.lua`); `format:lua`; `pre-commit:lua`.
   - `tests/minimal_init.lua` gives a run a runtimepath of the plugin, Neovim's
     runtime and mini.test only, so the machine's own configuration cannot change
     the result. `tests/run.lua` fails when it collects no test.
   - The Lua is luafmt's output, written so that a long module name re-wraps to a
     fixed point: no line holding the name chains calls, and no README line
     holds it.
   - `_gitignore` adds `/.tests/` and `/doc/tags`.
   ```

8. In "Testing", replace

   ```text
   and `--with`, and the sentinel grep. Publish needs the whole matrix.
   ```

   with

   ```text
   and `--with`, and the sentinel grep. The dry run step passes
   `MISE_GITHUB_TOKEN`, so mise's `github:` backend (Neovim, luafmt) is not held
   to the unauthenticated API rate limit. Publish needs the whole matrix.
   ```

9. In "Deferred", after item 3, add

   ```text
   3. Reusable `mise` check and committed workflows in `chewygumxx/.github`,
      replacing the native `ci.yaml`'s own jobs.
   ```

   with

   ```text
   3. Reusable `mise` check and committed workflows in `chewygumxx/.github`,
      replacing the native `ci.yaml`'s own jobs.
   4. Bumping the native templates' mise pins and the tag `deps` clones:
      Dependabot has no mise ecosystem, so they are bumped by hand.
   ```

If a spec line no longer reads as quoted, change the text it names in the same
spirit and do not stop.

- [ ] **Step 5: Check the repository**

Run: `npm run check`

Expected: exit 0, and the tests report `# fail 0`. `lint:templates` runs Biome
in the materialised `nvim`.

Run: `mise exec aqua:editorconfig-checker/editorconfig-checker@4.0.2 -- editorconfig-checker -disable-indent-size`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/specs/2026-09-30-multiple-templates-design.md
git commit -m "docs: Describe the nvim template" \
    -m "Records where the built layer differs from the spec: lint:types
depending on deps, mini.test as a LuaLS library, the fixed :Hello
command, two-space YAML, and the paths and words moduleName now
handles."
```

- [ ] **Step 7: Run it for real, as CI's dry run does**

Run, with no scratch state left from an earlier run:

```bash
rm -rf /tmp/e2e && mkdir /tmp/e2e
git config --global --get user.name >/dev/null || git config --global user.name "create-repo dry run"
git config --global --get user.email >/dev/null || git config --global user.email "create-repo@users.noreply.github.com"
for name in my-plugin.nvim nvim-other_plugin a-very-long-plugin-name-that-goes-on-and-on-and-on-for-ages; do
    GH_TOKEN="" node bin/create-repo.js "$name" \
        --template nvim \
        --description 'Dry run of "create-repo": a bundled template.' \
        --topics ci --scopes api --owner example \
        --dir "/tmp/e2e/$name" --no-metadata --dry-run --yes || break
done
```

Expected: all three runs finish with `git commit` and exit 0. None prints
`Stopped;`. Each log ends with the first commit, whose body is `Generated by
@chewygumxx/create-repo <version> (nvim).` This is the slow step: it installs
Neovim, LuaLS, selene and luafmt with mise.

- [ ] **Step 8: Check what the runs made, and that the checks can fail**

Run:

```bash
for dir in /tmp/e2e/*; do
    echo "== $dir"
    git -C "$dir" log --format='%s%n%b' -1
    git -C "$dir" grep -n -e repo-tmpl -e repo_tmpl -e is_template -e 'Using this template' || echo "no identity"
    git -C "$dir" config core.hooksPath
    (cd "$dir" && mise run commitlint -- -1 HEAD && echo "commitlint ok")
    git -C "$dir" ls-files 'lua/*' 'plugin/*' 'doc/*' 'tests/*'
done
```

Expected, for each: the subject `chore: Initialise from template` and a body
naming the template; `no identity`; `.githooks`; `commitlint ok`; and the
module's files: `lua/my-plugin/`, `plugin/my-plugin.lua`, `doc/my-plugin.txt`,
`tests/test_my-plugin.lua` for the first, `other_plugin` for the second (the
`nvim-` prefix and `.nvim` suffix gone), and the whole long name, which is
the module, for the third. No `repo_tmpl` path.

Then prove the checks fail when they should, in the first repository:

```bash
cd /tmp/e2e/my-plugin.nvim
mv tests/test_my-plugin.lua /tmp/held.lua
if mise run test:nvim >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else grep -m1 'collected no tests' /tmp/probe.log; fi
mv /tmp/held.lua tests/test_my-plugin.lua
sed -i 's/"Hello, world!"/"nope"/' tests/test_my-plugin.lua
if mise run test:nvim >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else echo "a failing test fails the task"; fi
git checkout -- tests/test_my-plugin.lua
mv .tests /tmp/held-tests
if nvim --headless -u tests/minimal_init.lua -l tests/run.lua >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else grep -m1 'mini.test is not installed' /tmp/probe.log; fi
mv /tmp/held-tests .tests
sed -i 's/^return M$/local bad = vim.api.nonexistent_function()\nreturn M/' lua/my-plugin/init.lua
if mise run lint:types >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else echo "a type error fails the task"; fi
git checkout -- lua/my-plugin/init.lua
git status --short
```

Expected: `collected no tests` (the line of the error), `a failing test fails
the task`, `mini.test is not installed` (the line of the error), `a type error
fails the task`, and then no output from `git status --short`.

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
for dir in /tmp/e2e/*; do
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

Expected: `ok` for every line of all three directories. A `FAILED` line names a
file the generated repository's CI would reject: run
`tombi format --offline <file>` there, copy the result back into the layer,
and rerun from Step 7.

- [ ] **Step 10: Clean up**

Run: `rm -rf /tmp/e2e /tmp/held* /tmp/probe.log && git status --short`

Expected: no output; the tree is clean.
