---
ctime: 2026-10-01
mtime: 2026-10-05
spdx: GPL-3.0-only
title: >-
  Implementation Plan: multiple templates, phase 6
description: >-
  Plan for the zsh template: a plugin following the Zsh Plugin Standard, tested
  by zsh and linted by shuck.
tags:
  - create-repo
  - plan
  - templates
  - zsh
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/docs/plans/2026-10-01-multiple-templates-phase-6.md
   -
   -->

# Implementation Plan: multiple templates, phase 6

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `zsh` template: a zsh plugin that follows the Zsh Plugin
Standard, whose hygiene comes from the native family, with its tests run by
zsh itself and its scripts linted and formatted by shuck, and whose name is
its plugin file, its function and its test file.

**Architecture:** One new layer, `zsh`, over `common` and `native`: the plugin
file, an autoloaded example function, a small test runner and its tests,
shuck's configuration, and a `.config/mise/conf.d/zsh.toml` that pins shuck
and adds the `lint:zsh`, `test:zsh`, `format:zsh` and `pre-commit:zsh` tasks.
`.github/apt-packages.txt` lists `zsh` for CI. The engine needs nothing new:
phase 5's `moduleName` already renames paths and teaches the guard the word it
wrote. The catalogue gains the `zsh` entry and its name rule, and the Create
Repo workflow installs zsh for its dry run.

**Tech Stack:** As phase 5, plus zsh 5 and shuck 0.2.3.

**Spec:**
[`docs/specs/2026-09-30-multiple-templates-design.md`](../specs/2026-09-30-multiple-templates-design.md),
its "Phases" item 6, "zsh", "Identity edits" and "Name rules". Phases 1 to 5
have landed on `main`; this plan builds on
[`2026-10-01-multiple-templates-phase-5.md`](2026-10-01-multiple-templates-phase-5.md).

## Global Constraints

- Node `>=24`; ES modules; every `.js` file starts with its header and
  `// @ts-check`, and is typechecked by `npm run typecheck`.
- No runtime dependency is added; `jsonc-parser` stays the only one.
- A new file's header follows its neighbours': the vim modeline, the SPDX
  line, `~chewygumxx/create-repo.git` (in the templates,
  `~chewygumxx/repo-tmpl.git`), and `::: :/<its path>`. The templates keep
  the `chewygumxx/repo-tmpl` identity; `lib/init.js` rewrites it, and a header
  names the file's path as the layer stores it, `repo_tmpl` included. A file
  that cannot carry a header (`.github/apt-packages.txt`) has none.
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
- `standard`, `typescript`, `cloudflare`, `rust` and `nvim` output does not
  change.
- `UsageError` exits 2; `TemplateError` and `CommandError` exit 1.
- `zsh` has no feature, so the feature prompt and `--with` are not offered for
  it.
- Every file the layer adds passes the shared `lint-format` job of
  `chewygumxx/.github` as well as the repository's own `mise run check`:
  tombi's format and lint of TOML (the house `tombi/config.toml`), shuck over
  the whole tree (the layer's `.shuck.toml` makes `lint-zsh` do that, and
  `lint-shell` stand aside), actionlint of workflows, and editorconfig-checker
  with `-disable-indent-size`. Task 3 runs them.
- Every zsh file in the layer is shuck's output under the layer's
  `.shuck.toml`, since the generated repository's first `mise run check` runs
  `shuck format --diff`. Do not re-flow a zsh file by hand: change it, run
  `shuck format` on it, and keep the result.

## Deviations from the Spec

Each was found by building the layer in a scratch copy and running it, with
the tools CI runs.

- **The plugin keeps its directory in `Plugins[repo_tmpl_dir]`.** Inside a
  function `$0` is the function's name, so the spec's `repo_tmpl_plugin_unload`
  cannot find the directory it must take off `fpath` with `${0:h}`, as
  `zsh-als`'s does not. The Zsh Plugin Standard's own `Plugins` array holds it;
  a key can hold the `-` that a parameter's name cannot, and the lowercase key
  is one the `moduleName` edit renames.
- **The layer carries a `.shuck.toml`.** shuck reads a `.plugin.zsh` file as
  sh unless told, and its formatter then rewrites `$+functions[...]`. The
  shared `lint-zsh` also runs `shuck format --diff`, whose default is tabs,
  which the `.editorconfig` refuses. The file maps `**/*.zsh` and `functions/*`
  to zsh, sets four-space indentation and leaves every other format option at
  its default: the file makes the shared CI run shuck over every shell script,
  hooks included, and the native hooks are formatted as shfmt does, so
  `space-redirects` and the like would rewrite them. It ignores C001 to C003,
  which `tests/run.zsh` sourcing a runtime path triggers, and a contract gives
  `tests/` the `plugin_root` that the runner sets. `chewygumxx/zsh-config`'s
  `.shuck.toml` was the model; its `[format]` is not copied.
- **The tasks name the files and run shuck's format check.** shuck walks a
  tree by extension and shebang, and an autoloaded function has neither (its
  `#!/bin/false` is not a shell), so `shuck check` with no path skips
  `functions/*`. `lint:zsh` passes `git ls-files '*.zsh' 'functions/*'` to
  `zsh -n`, `shuck check` and `shuck format --diff`; the spec had `zsh -n` and
  shuck. `format:zsh` is added, since the native `format` aggregate applies
  every formatter, and `pre-commit:zsh` runs shuck as well as `zsh -n`, as
  `pre-commit:lua` runs selene. `zsh -n` takes one file, so it runs once
  each.
- **`test:zsh` is `zsh -f tests/run.zsh`.** `-f` skips the startup files, so a
  contributor's `~/.zshenv` cannot change a run, as the nvim layer's
  `minimal_init.lua` isolates Neovim.
- **A failed assertion ends its test.** A zsh function's status is its last
  command's, so a test whose `assert_equal` failed early would pass. The
  prototype's mutation check found it: deleting the `fpath` line of the unload
  function still passed. `assert_equal` runs `exit 1`, which is safe because
  the runner gives each test a subshell of its own, and that also keeps one
  test's changes from any other.
- **The name rule is tighter than the spec's `^[A-Za-z0-9_-]+$`.** The name is
  a function's, so it cannot lead with `-`, which `autoload -Uz` reads as an
  option, and cannot be a word zsh reads as syntax (`if`, `while`, `function`,
  and the rest of zsh's reserved words): the generated tests then fail, and
  `until` and `while` hang the run waiting on the parser. Such a name is
  refused with the rule before anything is copied. A name that is a command
  (`echo`, `test`) works: the function is found first.
- **A test runs the real runner.** `test/zsh.test.js` copies the layers and
  runs `tests/run.zsh` with failing tests added, where zsh is installed and
  skipped where it is not, since `npm test` needs nothing installed. The
  Create Repo workflow's dry run runs the same runner for every generated
  repository.
- **The Create Repo workflow installs zsh for the `zsh` entry.** mise does not
  provide it, and a runner image may not have it. Generated repositories get
  it from `.github/apt-packages.txt`, which phase 4's `ci.yaml` already reads.
- **No preflight for zsh.** The spec asks only that the README name it. A
  check before the copy cannot know the template when the prompt chooses it,
  so a machine without zsh fails at the first `mise run check`, before
  anything reaches GitHub. Recorded in the spec's Deferred list.
- **No `_gitignore`, no Dependabot entry.** native's `.gitignore` already
  holds everything the layer produces, and the layer holds no workflow and no
  lock. The mise pins, shuck's included, are bumped by hand.
- **Cosmetic, left as it is:** sourced by a relative path, the plugin's
  directory and `fpath` entry read `/path/./functions`, as the standard's
  `$0` handling gives.

## Review Focus

1. A repository name GitHub allows and a zsh function cannot have (`-plugin`
   cannot be typed as an argument; `my.plugin`, `if`, `while`, `until`,
   `function`): refused with the rule before anything is copied (Task 1).
2. A test that fails before its last line, in a subdirectory, or with no test
   collected: `mise run test:zsh` fails each time, and a test's changes reach
   no other (Task 1, `test/zsh.test.js`).
3. A bad file under `functions/`, which shuck's own walk never reaches:
   `mise run lint:zsh` and the pre-commit hook fail on its syntax, a lint
   finding and formatting drift (Task 3, Step 8).
4. A name with `-`, a leading `_` or digit, or two `-` in a row: the generated
   repository's `mise run format` then `mise run check` passes, so the first
   commit's hooks do (Task 3, Step 7).
5. The plugin sourced twice leaves one `fpath` entry, and unloading it leaves
   no function, no `fpath` entry and no `Plugins` key (Task 1, Step 8, run
   against seven mutated copies).

---

### Task 1: The `zsh` template

**Files:**

- Create: `templates/zsh/` (8 files)
- Modify: `lib/templates.js`
- Test: `test/templates.test.js`, `test/bin.test.js`, `test/zsh.test.js` (new)

**Interfaces:**

- Consumes: phase 5's `moduleName(rename)`, which renames the paths that hold
  `repo_tmpl` and teaches the guard the word it wrote; phase 4's
  `committedScopes`; phase 1's `headers`, `repoMetadata`, `readme` and
  `UsageError`; `compose`, `copyTemplate`, `TEMPLATES_DIR` from
  `lib/template.js`; `FAMILIES.native`.
- Produces: `TEMPLATES.zsh` with no feature, layers
  `["common", "native", "zsh"]`, edits `[headers, repoMetadata, readme,
  committedScopes, moduleName((name) => name)]`, and a `checkName` refusing a
  name that is not letters, digits, `-` and `_`, leads with `-`, or is a
  zsh reserved word. Task 2 documents it.

- [ ] **Step 1: Write the failing tests**

In `test/templates.test.js`, insert before the test "typescript takes publish
by default at the prompt":

```js
test("zsh is the native layer, a zsh plugin and its tests", () => {
    const sources = compose(TEMPLATES.zsh.layers(new Set()));
    for (const [file, layer] of [
        ["mise.toml", "native"],
        ["committed.toml", "native"],
        [".githooks/pre-commit", "native"],
        [".github/workflows/ci.yaml", "native"],
        ["_gitignore", "native"],
        [".config/mise/conf.d/zsh.toml", "zsh"],
        [".shuck.toml", "zsh"],
        [".github/apt-packages.txt", "zsh"],
        ["repo_tmpl.plugin.zsh", "zsh"],
        ["functions/repo_tmpl", "zsh"],
        ["tests/run.zsh", "zsh"],
        ["tests/test_repo_tmpl.zsh", "zsh"],
        ["README.md", "zsh"],
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            new RegExp(`templates/${layer}/`),
            file,
        );
    }
    for (const file of [
        "package.json",
        "Cargo.toml",
        "lua/repo_tmpl/init.lua",
    ]) {
        assert.ok(!sources.has(file), file);
    }
});

test("zsh has no features", () => {
    assert.deepEqual(TEMPLATES.zsh.features, {});
    assert.equal(TEMPLATES.zsh.family, "native");
});

test("the zsh layer's apt packages name zsh, which mise does not install", () => {
    assert.equal(
        readFileSync(
            join(TEMPLATES_DIR, "zsh", ".github/apt-packages.txt"),
            "utf8",
        ),
        "zsh\n",
    );
});

test("shuck reads the zsh scripts as zsh and formats as the native hooks are", () => {
    const config = readFileSync(
        join(TEMPLATES_DIR, "zsh", ".shuck.toml"),
        "utf8",
    );
    assert.match(config, /^"\*\*\/\*\.zsh"\s+= "zsh"$/m);
    assert.match(config, /^"functions\/\*"\s+= "zsh"$/m);
    // A repository's shuck configuration makes the shared CI run shuck over
    // the hooks too, which are formatted as shfmt does: only the indentation
    // is set.
    assert.match(config, /^indent-style = "space"$/m);
    assert.match(config, /^indent-width = 4$/m);
    assert.doesNotMatch(
        config,
        /space-redirects|keep-padding|switch-case-indent|binary-next-line|function-next-line|never-split/,
    );
});

test("the zsh tasks name the files, which shuck's own walk never finds", () => {
    const tasks = readFileSync(
        join(TEMPLATES_DIR, "zsh", ".config/mise/conf.d/zsh.toml"),
        "utf8",
    );
    // An autoloaded function has no extension and no shebang, so a bare
    // `shuck` command would skip `functions/*`.
    assert.doesNotMatch(tasks, /^shuck /m);
    assert.match(tasks, /'\*\.zsh' 'functions\/\*' \| xargs -0 -r shuck check --$/m);
    assert.match(
        tasks,
        /'\*\.zsh' 'functions\/\*' \| xargs -0 -r shuck format --diff --$/m,
    );
    assert.match(tasks, /xargs -0 -r -n 1 zsh -n --$/m);
    // `-f` skips the startup files, so the machine's cannot change a run.
    assert.match(tasks, /^run\s+= "zsh -f tests\/run\.zsh"$/m);
});

test("a zsh plugin's name is a function's: no leading -, no reserved word", () => {
    const { checkName } = TEMPLATES.zsh;
    assert.ok(checkName);
    /** @param {string} name */
    const check = (name) => checkName({ owner: "example", name }, new Set());
    for (const name of [
        "a",
        "my-plugin",
        "zsh-my-plugin",
        "My_Plugin2",
        "_x",
        "0",
        "1a",
        "a--b",
        "test",
        "echo",
        "a".repeat(100),
    ]) {
        assert.doesNotThrow(() => check(name), name);
    }
    for (const name of [
        "-plugin",
        "my.plugin",
        "my plugin",
        "if",
        "while",
        "until",
        "function",
        "time",
        "end",
        "select",
    ]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError && /plugin name/.test(error.message),
            name,
        );
    }
});

test("zsh is initialised with the plugin's name in every path", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
    try {
        const dir = join(root, "x");
        const files = copyTemplate(
            dir,
            layersOf({ template: "zsh", features: [] }),
        );
        init(dir, { ...IDENTITY, name: "zsh-derived" }, files, {
            edits: TEMPLATES.zsh.edits,
            today: "2026-10-01",
        });
        /** @param {string} file */
        const at = (file) => readFileSync(join(dir, file), "utf8");
        for (const file of [
            "zsh-derived.plugin.zsh",
            "functions/zsh-derived",
            "tests/test_zsh-derived.zsh",
        ]) {
            assert.ok(existsSync(join(dir, file)), file);
        }
        assert.ok(!existsSync(join(dir, "repo_tmpl.plugin.zsh")));
        assert.ok(!existsSync(join(dir, "functions/repo_tmpl")));
        const plugin = at("zsh-derived.plugin.zsh");
        assert.match(plugin, /^# ::: :\/zsh-derived\.plugin\.zsh$/m);
        assert.match(plugin, /^# ~example\/zsh-derived\.git$/m);
        assert.match(plugin, /^Plugins\[zsh-derived_dir\]=/m);
        assert.match(plugin, /^zsh-derived_plugin_unload\(\) \{$/m);
        assert.match(at("committed.toml"), /^ {4}"api",$/m);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
```

In `test/bin.test.js`, have `runBin` also report the plugin file: in its
returned object, after the `lua:` property, add

```js
            plugin: existsSync(dir)
                ? readdirSync(dir).filter((file) => file.endsWith(".plugin.zsh"))
                : undefined,
```

Insert after the test "a name a Lua module cannot use stops before anything
is copied":

```js
test("zsh is copied, initialised and run through mise, not npm", () => {
    const { commit, plugin, lines } = dryRun(["--template", "zsh"]);
    assert.match(commit, /\(zsh\)\./);
    assert.deepEqual(plugin, ["x.plugin.zsh"]);
    const env = lines.findIndex((line) => line.startsWith("mise env"));
    assert.deepEqual(
        lines
            .slice(env + 1)
            .map((line) => line.split(" ").slice(0, 2).join(" ")),
        ["git add", "mise run", "git add", "mise run", "git commit"],
        lines.join("\n"),
    );
});

test("zsh names its plugin for the repository", () => {
    const run = runBin((root) => [
        "zsh-my-tool",
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
        "zsh",
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.deepEqual(run.plugin, ["zsh-my-tool.plugin.zsh"]);
});

test("a name a zsh function cannot have stops before anything is copied", () => {
    for (const name of ["my.plugin", "if", "while"]) {
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
            "zsh",
        ]);
        assert.equal(result.status, 2, name);
        assert.match(result.stderr, /plugin name/, name);
        assert.ok(!copied, name);
    }
});
```

and, in the test "--help lists the templates", after the `nvim` assertion, add

```js
    assert.match(result.stdout, /\n {2}zsh {9}A zsh plugin/);
```

Create `test/zsh.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/zsh.test.js
//
//

// @ts-check

// Runs the zsh layer's own test runner in a copy of the layers, against zsh,
// with tests added that fail in each way a test can, so that a green
// `mise run check` in a new repository means something. Skipped where zsh is
// not installed, since `npm test` needs nothing installed; the Create Repo
// workflow installs it and runs the runner for every generated repository.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { copyTemplate } from "../lib/template.js";
import { TEMPLATES } from "../lib/templates.js";

const skip =
    spawnSync("zsh", ["--version"]).status === 0
        ? false
        : "zsh is not installed";

/**
 * Copies the zsh template, and hands `body` its directory and a function that
 * runs its tests as its mise task does.
 * @param {(dir: string, run: () => import("node:child_process").SpawnSyncReturns<string>) => void} body
 */
function inCopy(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-zsh-"));
    try {
        const dir = join(root, "x");
        copyTemplate(dir, TEMPLATES.zsh.layers(new Set()));
        body(dir, () =>
            spawnSync("zsh", ["-f", "tests/run.zsh"], {
                cwd: dir,
                encoding: "utf8",
            }),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * Adds a test file to a copy.
 * @param {string} dir
 * @param {string} file relative to `tests/`
 * @param {string[]} lines
 */
function addTest(dir, file, lines) {
    const path = join(dir, "tests", file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${lines.join("\n")}\n`);
}

test("the layer's own tests pass", { skip }, () =>
    inCopy((_dir, run) => {
        const result = run();
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /^\d+ tests, 0 failed$/m);
    }),
);

test("a failed assertion ends its test, wherever it is", { skip }, () =>
    inCopy((dir, run) => {
        addTest(dir, "test_early.zsh", [
            "test_fails_early() {",
            "    assert_equal a b",
            "    true",
            "}",
        ]);
        const result = run();
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stdout, /^FAIL test_fails_early$/m);
        assert.match(result.stderr, /expected: a/);
    }),
);

test("a test in a subdirectory of tests runs", { skip }, () =>
    inCopy((dir, run) => {
        addTest(dir, "sub/test_nested.zsh", [
            "test_nested() {",
            "    return 1",
            "}",
        ]);
        const result = run();
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stdout, /^FAIL test_nested$/m);
    }),
);

test("a run that collects no test fails", { skip }, () =>
    inCopy((dir, run) => {
        rmSync(join(dir, "tests", "test_repo_tmpl.zsh"));
        const result = run();
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, /collected no tests/);
    }),
);

test("a test's changes reach no other", { skip }, () =>
    inCopy((dir, run) => {
        addTest(dir, "test_a_changes.zsh", [
            "test_a_changes() {",
            "    leaked=1",
            "    unfunction repo_tmpl",
            "}",
        ]);
        addTest(dir, "test_b_reads.zsh", [
            "test_b_reads() {",
            '    assert_equal "" "$leaked"',
            '    assert_equal "Hello, world!" "$(repo_tmpl)"',
            "}",
        ]);
        const result = run();
        assert.equal(result.status, 0, result.stdout + result.stderr);
    }),
);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx --no -- biome check --write test/templates.test.js test/bin.test.js test/zsh.test.js && npm test 2>&1 | grep -E "^not ok|^# (tests|pass|fail|skipped)"`

Expected: FAIL. Every new test is listed as `not ok`: the catalogue has no
`zsh` (`TypeError: Cannot read properties of undefined`, or `Unknown template
"zsh"` from the entry point), and the layer has no files (`ENOENT`). The five
tests of `test/zsh.test.js` fail the same way where zsh is installed; where it
is not, they are skipped and this step cannot show them red. Nothing that
passed before fails.

- [ ] **Step 3: Add the layer**

Create the layer's eight files. No file is executable. Each is exactly what
the prototype was run with, and shuck's output under the layer's own
`.shuck.toml`.

`templates/zsh/repo_tmpl.plugin.zsh`:

```zsh
#!/bin/false
# vim:set expandtab shiftwidth=4 filetype=zsh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/repo_tmpl.plugin.zsh
#
#

# Handle $0 according to the Zsh Plugin Standard:
# https://wiki.zshell.dev/community/zsh_plugin_standard
0="${ZERO:-${${0:#$ZSH_ARGZERO}:-${(%):-%N}}}"
0="${${(M)0:#/*}:-$PWD/$0}"

# `$0` inside a function is the function's name, so the directory is kept where
# `repo_tmpl_plugin_unload` can find it, in the standard's `Plugins` array.
typeset -gA Plugins
Plugins[repo_tmpl_dir]=${0:h}

# `functions/` goes on `fpath` once, however many times the plugin is sourced.
if [[ ${zsh_loaded_plugins[-1]-} != */repo_tmpl && -z ${fpath[(r)${0:h}/functions]-} ]] {
    fpath+=("${0:h}/functions")
}

autoload -Uz repo_tmpl

# The standard's unload function: undoes everything the plugin did.
repo_tmpl_plugin_unload() {
    emulate -L zsh

    fpath=(${fpath:#${(b)Plugins[repo_tmpl_dir]}/functions})
    ((${+functions[repo_tmpl]})) && unfunction repo_tmpl
    unset "Plugins[repo_tmpl_dir]"
    unfunction repo_tmpl_plugin_unload
}
```

`templates/zsh/functions/repo_tmpl`:

```zsh
#!/bin/false
# vim:set expandtab shiftwidth=4 filetype=zsh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/functions/repo_tmpl
#
#

# Prints a greeting for the arguments, or for the world.
emulate -L zsh

print -r -- "Hello, ${*:-world}!"
```

`templates/zsh/tests/run.zsh`:

```zsh
#!/bin/false
# vim:set expandtab shiftwidth=4 filetype=zsh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/tests/run.zsh
#
#

# Sources the plugin and every `test_*.zsh` under `tests/`, nested directories
# included, then runs each `test_*` function in a subshell of its own, so one
# test's changes reach no other. A run that finds no test has nothing to fail,
# so it is an error.
#
#     zsh -f tests/run.zsh
#
# `-f` skips the startup files, so the machine's own configuration cannot
# change the result.

emulate -L zsh

# The plugin's directory, for the tests.
typeset -g plugin_root=${0:A:h:h}

# When the two differ, prints what was expected and ends the test, which runs in
# a subshell: a test's status is its last command's, so it would otherwise pass
# with an assertion failed before its end.
assert_equal() {
    [[ $1 == "$2" ]] && return
    print -rl -- "    expected: $1" "    actual:   $2" >&2
    exit 1
}

local file
for file in "$plugin_root"/tests/**/test_*.zsh(N); do
    source $file
done
source $plugin_root/repo_tmpl.plugin.zsh

local -a tests=(${(ok)functions[(I)test_*]})
if ((!$#tests)) {
    print -r -- "collected no tests under $plugin_root/tests" >&2
    return 1
}

local name
local -i failed=0
for name in $tests; do
    if ($name); then
        print -r -- "ok   $name"
    else
        print -r -- "FAIL $name"
        ((failed++))
    fi
done

print -r -- "${#tests} tests, $failed failed"
((!failed))
```

`templates/zsh/tests/test_repo_tmpl.zsh`:

```zsh
#!/bin/false
# vim:set expandtab shiftwidth=4 filetype=zsh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/tests/test_repo_tmpl.zsh
#
#

# Each test runs in a subshell, after the runner has sourced the plugin.

# How many times the plugin's `functions/` is on `fpath`.
on_fpath() {
    local -a found=(${(M)fpath:#${(b)plugin_root}/functions})
    print -r -- $#found
}

test_greets_the_world() {
    assert_equal "Hello, world!" "$(repo_tmpl)"
}

test_greets_each_argument() {
    assert_equal "Hello, Ada Lovelace!" "$(repo_tmpl Ada Lovelace)"
}

test_sourcing_twice_leaves_one_entry_on_fpath() {
    source $plugin_root/repo_tmpl.plugin.zsh
    assert_equal 1 "$(on_fpath)"
}

test_unloading_undoes_the_plugin() {
    assert_equal 1 "$(on_fpath)"
    repo_tmpl_plugin_unload
    assert_equal 0 "$(on_fpath)"
    assert_equal 0 ${+functions[repo_tmpl]}
    assert_equal 0 ${+functions[repo_tmpl_plugin_unload]}
    assert_equal 0 ${+Plugins[repo_tmpl_dir]}
}
```

`templates/zsh/.shuck.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.shuck.toml
#
#

#
# https://ewhauser.github.io/shuck/docs/configuration/
#
# A repository with this file has chosen shuck for every shell script: the
# shared CI runs it over the whole tree, including the hooks in `.githooks/`.
#

# Left unmapped, shuck reads a `.plugin.zsh` file as sh, where
# `$+functions[...]` means nothing and its formatter rewrites the expression.
[per-file-shell]
"**/*.zsh"    = "zsh"
"functions/*" = "zsh"

# The hooks are formatted as shfmt formats them, so the other options stay at
# their defaults.
[format]
indent-style = "space"
indent-width = 4

[lint]
# C001 a variable set and never read, as `Plugins` is by the plugin itself; C002
# and C003 a path built at runtime and a file the analysis cannot see, which
# `tests/run.zsh` sources.
ignore = [ "C001", "C002", "C003" ]

# `tests/run.zsh` sets `plugin_root`, and the tests it sources read it.
[[lint.contracts.custom]]
id   = "tests"
when = "always"

[lint.contracts.custom.provides]
variables = [ "plugin_root" ]
```

`templates/zsh/.config/mise/conf.d/zsh.toml`:

```toml
# vim:set expandtab shiftwidth=4 filetype=toml:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.config/mise/conf.d/zsh.toml
#
#

#
# https://mise.jdx.dev/configuration.html
#
# zsh's tools and tasks, merged into `mise.toml`'s aggregates: mise reads
# every file in this directory beside it.
#
# zsh itself is not installed by mise: it is a system package, which CI gets
# from `.github/apt-packages.txt`.
#

[tools]
# The release assets are named shuck-cli-*, so the binary is named here.
"github:ewhauser/shuck" = { version = "0.2.3", exe = "shuck" }

[tasks."lint:zsh"]
description = "zsh's syntax check, then shuck's lint and format check"
# The files are named, since shuck finds a file by its extension or shebang,
# and an autoloaded function has neither. `.shuck.toml` maps them to the zsh
# dialect, which shuck would otherwise read as sh, and sets the format.
run         = """
git ls-files -z '*.zsh' 'functions/*' | xargs -0 -r -n 1 zsh -n --
git ls-files -z '*.zsh' 'functions/*' | xargs -0 -r shuck check --
git ls-files -z '*.zsh' 'functions/*' | xargs -0 -r shuck format --diff --
"""

[tasks."test:zsh"]
description = "The plugin's tests"
run         = "zsh -f tests/run.zsh"

[tasks."format:zsh"]
description = "Apply shuck's formatting"
run         = "git ls-files -z '*.zsh' 'functions/*' | xargs -0 -r shuck format --"

[tasks."pre-commit:zsh"]
description = "zsh's syntax check, shuck's lint and format check on staged files"
run         = """
git diff -z --cached --name-only --diff-filter=ACMR -- '*.zsh' 'functions/*' | xargs -0 -r -n 1 zsh -n --
git diff -z --cached --name-only --diff-filter=ACMR -- '*.zsh' 'functions/*' | xargs -0 -r shuck check --
git diff -z --cached --name-only --diff-filter=ACMR -- '*.zsh' 'functions/*' | xargs -0 -r shuck format --diff --
"""
```

`templates/zsh/.github/apt-packages.txt` holds one line:

```text
zsh
```

`templates/zsh/README.md`:

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
(shuck, Biome, rumdl, yamlfmt, yamllint), a plugin that follows the Zsh Plugin
Standard with its tests, GitHub automation (header and repository metadata
sync, Dependabot) and Claude Code settings and hooks, all without npm.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
npm create @chewygumxx/repo my-plugin -- --template zsh
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

zsh is a system package, which `mise install` does not provide: install it with
your package manager. The rest of the toolchain is pinned in `mise.toml` and
`.config/mise/conf.d/zsh.toml`, and `mise install` installs it, shuck included,
and wires the git hooks in `.githooks/`.

- `mise run check` runs the checks CI runs: `zsh -n` on each zsh file, shuck's
  lint and format check, the tests, Biome's format and lint checks, Markdown
  lint (rumdl), the YAML checks (yamlfmt, then yamllint) and a check that
  rejects em dashes.
- `mise run test:zsh` runs the tests alone.
- `mise run format` applies shuck's formatting, Biome's, and yamlfmt's to YAML,
  which Biome does not read.
- `mise run commitlint -- <revision>...` lints the commit messages the
  revisions name, as CI does: `origin/main..HEAD`, or `-1 HEAD`.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs committed, which holds each message to Conventional Commits with the types
and scopes in `committed.toml`.

## Layout

The plugin is named for the repository, which names its plugin file, its
function and the test file.

- `<name>.plugin.zsh`: the plugin file, following the Zsh Plugin Standard. It
  puts `functions/` on `fpath` once, autoloads the function and defines
  `<name>_plugin_unload`, which undoes both.
- `functions/`: one autoloaded function per file. The example greets its
  arguments.
- `tests/`: `test_*.zsh` files, in any subdirectory, whose `test_*` functions
  `run.zsh` runs, each in a subshell of its own, after sourcing the plugin. It
  runs under `zsh -f`, so the machine's own configuration cannot change the
  result, and fails when it collects no test. `assert_equal` and `plugin_root`
  are available to the tests.
- `.shuck.toml`: maps the scripts to the zsh dialect, which shuck would
  otherwise read as sh, and sets the format.
````

- [ ] **Step 4: Commit the layer**

```bash
git add templates/zsh
git commit -m "feat(template): Add the zsh layer"
```

- [ ] **Step 5: Add the catalogue entry**

In `lib/templates.js`, before `/** The identity edits every npm template
makes. */`, add:

```js
/**
 * The words zsh reads as syntax, which no function can be named.
 */
const ZSH_RESERVED = new Set([
    "case",
    "coproc",
    "do",
    "done",
    "elif",
    "else",
    "end",
    "esac",
    "fi",
    "for",
    "foreach",
    "function",
    "if",
    "nocorrect",
    "repeat",
    "select",
    "then",
    "time",
    "until",
    "while",
]);

/**
 * A plugin's name is its file, its autoloaded function and the start of its
 * unload function's: letters, digits, `-` and `_`, not leading with `-`, which
 * `autoload` reads as an option, and not a reserved word, which no function
 * can be named (the tests fail, and `until` and `while` wait on the parser).
 * GitHub allows more, so the name is refused, not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function zshPluginName({ name }) {
    if (/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name) && !ZSH_RESERVED.has(name)) {
        return;
    }
    throw new UsageError(
        `The plugin name "${name}" is not valid: use letters, digits, "-" and "_", not starting with "-", and not a word zsh reads as syntax, such as "if" or "while".`,
    );
}
```

and add to `TEMPLATES`, after `nvim`:

```js
    zsh: {
        description:
            "A zsh plugin, tested with zsh and linted with shuck, without npm",
        family: "native",
        features: {},
        layers: () => ["common", "native", "zsh"],
        edits: [
            headers,
            repoMetadata,
            readme,
            committedScopes,
            moduleName((name) => name),
        ],
        checkName: zshPluginName,
    },
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/templates.js test/templates.test.js test/bin.test.js test/zsh.test.js && npm test 2>&1 | grep -E "^not ok|^# (tests|pass|fail|skipped)"`

Expected: PASS, the whole suite, 192 tests and none skipped (zsh is installed
here). In particular "every combination copies and initialises, leaving no
identity" now covers `zsh`, and "every template header names the template and
its own path" covers the new layer.

- [ ] **Step 7: Commit**

```bash
git add lib/templates.js test/templates.test.js test/bin.test.js test/zsh.test.js
git commit -m "feat: Add the zsh template"
```

- [ ] **Step 8: Check that the layer's own tests can fail**

The plugin's tests must catch each thing the plugin does. Materialise the
template and break the plugin seven ways, one at a time:

```bash
bash -c '
rm -rf /tmp/mut && node scripts/materialize.js zsh /tmp/mut >/dev/null && cd /tmp/mut || exit 1
run() { zsh -f tests/run.zsh 2>&1 | grep -E "^FAIL|tests," | tr "\n" " "; echo; }
cp repo_tmpl.plugin.zsh /tmp/plug.orig
echo "unmutated:"; run
sed -i "s/^if \[\[ \${zsh_loaded_plugins\[-1\]-} != \*\/repo_tmpl && -z \${fpath\[(r)\${0:h}\/functions\]-} \]\] {/if true {/" repo_tmpl.plugin.zsh
echo "no once-guard:"; run; cp /tmp/plug.orig repo_tmpl.plugin.zsh
sed -i "/fpath=(\${fpath:#/d" repo_tmpl.plugin.zsh
echo "unload keeps fpath:"; run; cp /tmp/plug.orig repo_tmpl.plugin.zsh
sed -i "/unset \"Plugins\[repo_tmpl_dir\]\"/d" repo_tmpl.plugin.zsh
echo "unload keeps the Plugins key:"; run; cp /tmp/plug.orig repo_tmpl.plugin.zsh
sed -i "/^autoload -Uz repo_tmpl/d" repo_tmpl.plugin.zsh
echo "no autoload:"; run; cp /tmp/plug.orig repo_tmpl.plugin.zsh
sed -i "/unfunction repo_tmpl_plugin_unload/d" repo_tmpl.plugin.zsh
echo "unload keeps itself:"; run; cp /tmp/plug.orig repo_tmpl.plugin.zsh
sed -i "/unfunction repo_tmpl\$/d" repo_tmpl.plugin.zsh
echo "unload keeps the function:"; run
'
```

Expected:

```text
unmutated:
4 tests, 0 failed
no once-guard:
FAIL test_greets_each_argument FAIL test_greets_the_world FAIL test_sourcing_twice_leaves_one_entry_on_fpath FAIL test_unloading_undoes_the_plugin 4 tests, 4 failed
unload keeps fpath:
FAIL test_unloading_undoes_the_plugin 4 tests, 1 failed
unload keeps the Plugins key:
FAIL test_unloading_undoes_the_plugin 4 tests, 1 failed
no autoload:
FAIL test_greets_each_argument FAIL test_greets_the_world 4 tests, 2 failed
unload keeps itself:
FAIL test_unloading_undoes_the_plugin 4 tests, 1 failed
unload keeps the function:
FAIL test_unloading_undoes_the_plugin 4 tests, 1 failed
```

A mutant that reports `0 failed` is a test that cannot fail: find which
assertion is missing or does not end its test, fix the layer's test, and
rerun this step. Then `rm -rf /tmp/mut /tmp/plug.orig`.

### Task 2: CI and documentation

**Files:**

- Modify: `.github/workflows/create-repo.yaml`, `README.md`,
  `docs/specs/2026-09-30-multiple-templates-design.md`

**Interfaces:**

- Consumes: Task 1's layer and catalogue entry.
- Produces: nothing later tasks use. The Create Repo matrix (from
  `scripts/materialize.js --list`) already holds `zsh`; this task makes its
  dry run able to run.

- [ ] **Step 1: Install zsh for the zsh dry run**

In `.github/workflows/create-repo.yaml`, in the `dry-run` job, replace

```yaml
            - name: NPM Clean Install
              run: npm ci

            - name: Dry Run
```

with

```yaml
            - name: NPM Clean Install
              run: npm ci

            # What a template's checks need and mise does not provide.
            - name: Install System Packages
              if: matrix.template == 'zsh'
              run: |
                  sudo apt-get update
                  sudo apt-get install --yes --no-install-recommends zsh

            - name: Dry Run
```

Also in the `Dry Run` step's comment, change `(Neovim, luafmt)` to `(Neovim,
luafmt, shuck)`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/create-repo.yaml
git commit -m "ci: Install zsh for the zsh dry run"
```

- [ ] **Step 3: Document the template**

In `README.md`, add to the templates table, after the `nvim` rows:

```text
| `zsh`        | A zsh plugin without npm, following the Zsh Plugin        |
|              | Standard, tested with zsh and linted with shuck           |
```

In the paragraph that begins "It needs Node 24 or later", replace

```markdown
It needs Node 24 or later, `git`, `mise`, and `gh` logged in with
`gh auth login`.
```

with

```markdown
It needs Node 24 or later, `git`, `mise`, and `gh` logged in with
`gh auth login`. The `zsh` template also needs zsh, which mise does not
install.
```

In the paragraph that begins "Each template is an ordered list of layers",
replace

```markdown
tasks, and `rust-bin` or `rust-lib` the source. `nvim` adds the plugin, its
tests and the Lua tools' mise tasks. A layer that holds a `package.json` holds
```

with

```markdown
tasks, and `rust-bin` or `rust-lib` the source. `nvim` adds the plugin, its
tests and the Lua tools' mise tasks, and `zsh` the plugin, its tests, shuck's
configuration and its mise tasks. A layer that holds a `package.json` holds
```

and in the paragraph on the templates' identity, replace

```markdown
with `lib` names its crate in a doc test as `repo_tmpl`, and `nvim` names its
module so in code and in paths (`lua/repo_tmpl/`); the `moduleName` edit
rewrites them.
```

with

```markdown
with `lib` names its crate in a doc test as `repo_tmpl`, and `nvim` and `zsh`
name their module so in code and in paths (`lua/repo_tmpl/`,
`repo_tmpl.plugin.zsh`); the `moduleName` edit rewrites them.
```

- [ ] **Step 4: Amend the spec**

In `docs/specs/2026-09-30-multiple-templates-design.md`, make these edits,
each replacing the exact old text with the new:

1. In "Layout and composition", the `zsh` row of the layer table. Old:

```text
| `zsh`                | The plugin, its tests, `.github/apt-packages.txt` and    |
|                      | its mise tasks; replaces `README.md`                     |
```

   New:

```text
| `zsh`                | The plugin, its tests, `.shuck.toml`,                    |
|                      | `.github/apt-packages.txt` and its mise tasks;           |
|                      | replaces `README.md`                                     |
```

2. In "Name rules", the `zsh` row. Old:

```text
| `zsh`                | Plugin and function      | `^[A-Za-z0-9_-]+$`                       |
```

   New:

```text
| `zsh`                | Plugin and function      | `^[A-Za-z0-9_][A-Za-z0-9_-]*$`, and not  |
|                      |                          | a word zsh reads as syntax, such as `if` |
|                      |                          | or `while`, which a function cannot be   |
|                      |                          | named                                    |
```

3. The "zsh" section, from its `### zsh` heading to the end of its last
   bullet. Old:

```text
### zsh

`common`, `native`, `zsh`, following the Zsh Plugin Standard as `zsh-als`
does.

- `repo_tmpl.plugin.zsh`: the standard's `$0` handling, `functions/` on
  `fpath` once, `autoload -Uz repo_tmpl`, and `repo_tmpl_plugin_unload`.
- `functions/repo_tmpl`, an example function; `tests/test_repo_tmpl.zsh` and
  `tests/run.zsh`, which sources the plugin, runs every `test_*` function
  and fails when there are none.
- Tools: `github:ewhauser/shuck`.
- Tasks: `lint:zsh` (`zsh -n` on each tracked zsh file, then shuck),
  `test:zsh` (`zsh tests/run.zsh`), `pre-commit:zsh` (`zsh -n` on staged
  files).
- zsh is a system prerequisite, named in the README;
  `.github/apt-packages.txt` lists `zsh` for CI.
```

   New:

```text
### zsh

`common`, `native`, `zsh`, following the Zsh Plugin Standard as `zsh-als`
does.

- `repo_tmpl.plugin.zsh`: the standard's `$0` handling, the plugin's directory
  kept in `Plugins[repo_tmpl_dir]` (`$0` inside a function is the function's
  name, so `repo_tmpl_plugin_unload` could not find it otherwise), `functions/`
  on `fpath` once, `autoload -Uz repo_tmpl`, and `repo_tmpl_plugin_unload`,
  which undoes all of it.
- `functions/repo_tmpl`, an example function; `tests/test_repo_tmpl.zsh` and
  `tests/run.zsh`, which sources the plugin and every `test_*.zsh` under
  `tests/`, runs each `test_*` function in a subshell of its own and fails
  when there are none. `assert_equal` ends its test with `exit 1`, since a
  test's status is its last command's, and `plugin_root` is the plugin's
  directory.
- Tools: `github:ewhauser/shuck`, configured by `.shuck.toml`:
  `[per-file-shell]` maps `**/*.zsh` and `functions/*` to zsh, which shuck
  would read as sh, and `[format]` sets four-space indentation and nothing
  else. A repository with a shuck configuration makes the shared CI run shuck
  over every shell script, and the native hooks are formatted as shfmt does,
  so the other format options stay at their defaults. The lint ignores C001 to
  C003, and a contract gives `tests/` the `plugin_root` that `run.zsh` sets.
- Tasks: `lint:zsh` (`zsh -n` on each tracked zsh file, then `shuck check` and
  `shuck format --diff`), `test:zsh` (`zsh -f tests/run.zsh`, so the machine's
  startup files cannot change the result), `format:zsh` (`shuck format`) and
  `pre-commit:zsh` (the same checks on staged files). The tasks name the files,
  `*.zsh` and `functions/*`: shuck finds a file by its extension or shebang,
  and an autoloaded function has neither.
- zsh is a system prerequisite, named in the README;
  `.github/apt-packages.txt` lists `zsh` for CI, and the Create Repo workflow
  installs it for the `zsh` entry.
```

4. In "Testing", the paragraph on the Create Repo workflow. Old:

```text
The Create Repo workflow runs a matrix: `standard`, `typescript`,
`typescript` with `publish`, `cloudflare`, `rust`, `rust` with `lib`,
`nvim`, `zsh`. Each materialises the pristine template with
`scripts/materialize.js`, installs it and runs its family's format check,
replacing `npm run lint:template`; then runs the dry run with `--template`
and `--with`, and the sentinel grep. The dry run step passes
`MISE_GITHUB_TOKEN`, so mise's `github:` backend (Neovim, luafmt) is not held
to the unauthenticated API rate limit. Publish needs the whole matrix.
```

   New:

```text
The Create Repo workflow runs a matrix: `standard`, `typescript`,
`typescript` with `publish`, `cloudflare`, `rust`, `rust` with `lib`,
`nvim`, `zsh`. Each materialises the pristine template with
`scripts/materialize.js`, installs it and runs its family's format check,
replacing `npm run lint:template`; then runs the dry run with `--template`
and `--with`, and the sentinel grep. The dry run step passes
`MISE_GITHUB_TOKEN`, so mise's `github:` backend (Neovim, luafmt, shuck) is
not held to the unauthenticated API rate limit, and the `zsh` entry installs
zsh first, which mise does not provide. Publish needs the whole matrix.
```

5. In "Deferred", item 4, which gains two items after it. Old:

```text
4. Bumping the native templates' mise pins and the tag `deps` clones:
   Dependabot has no mise ecosystem, so they are bumped by hand.
```

   New:

```text
4. Bumping the native templates' mise pins and the tag `deps` clones:
   Dependabot has no mise ecosystem, so they are bumped by hand.
5. zsh on the machine that runs `create-repo`: the `zsh` template's first
   check needs it, and the README names it. No preflight asks for it, since
   the template may be chosen at the prompt, after the preflight.
6. `functions/*` in the shared `lint-zsh`: with a shuck configuration it runs
   shuck over the tree, which finds no extensionless file, so the functions
   are checked only by the repository's own `mise run check`.
```

- [ ] **Step 5: Check the repository**

Run: `npm run check`

Expected: exit 0, and the tests report `# fail 0`. `lint:templates` runs Biome
in the materialised `zsh`.

Run: `mise exec aqua:editorconfig-checker/editorconfig-checker@4.0.2 -- editorconfig-checker -disable-indent-size`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/specs/2026-09-30-multiple-templates-design.md
git commit -m "docs: Describe the zsh template" \
    -m "Records where the built layer differs from the spec: the Plugins
array for the unload function, the shuck configuration and the tasks
that name their files, zsh -f, assertions that end their test, and
the tighter name rule."
```

### Task 3: The real run

**Files:**

- None. Scratch directories under `/tmp` only.

**Interfaces:**

- Consumes: Tasks 1 and 2.
- Produces: nothing later tasks use. The phase is done when a real run of
  `zsh` creates repositories whose own `mise run check`, hooks and
  `commitlint` task pass, whose tests and lint fail when they should, and
  which the shared CI tools accept, and when the shared `lint-zsh` accepts
  the layer inside this repository.

- [ ] **Step 1: Run it for real, as CI's dry run does**

Run, with no scratch state left from an earlier run:

```bash
rm -rf /tmp/e2e && mkdir /tmp/e2e
git config --global --get user.name >/dev/null || git config --global user.name "create-repo dry run"
git config --global --get user.email >/dev/null || git config --global user.email "create-repo@users.noreply.github.com"
for name in zsh-my-plugin under_score _lead 9-lives; do
    GH_TOKEN="" node bin/create-repo.js "$name" \
        --template zsh \
        --description 'Dry run of "create-repo": a bundled template.' \
        --topics ci --scopes api --owner example \
        --dir "/tmp/e2e/$name" --no-metadata --dry-run --yes || break
done
```

Expected: all four runs exit 0, each ending with the dry run's `gh repo
create` and `git push` lines. None prints `Stopped;`. The first commit's body
is `Generated by @chewygumxx/create-repo <version> (zsh).` (Step 2 reads it).
The tools are mostly cached, so this is quicker than phase 5's; a first run
installs shuck.

- [ ] **Step 2: Check what the runs made, and that the checks can fail**

Run:

```bash
for dir in /tmp/e2e/*; do
    echo "== $dir"
    git -C "$dir" log --format='%s%n%b' -1
    git -C "$dir" grep -n -e repo-tmpl -e repo_tmpl -e is_template -e 'Using this template' || echo "no identity"
    git -C "$dir" config core.hooksPath
    (cd "$dir" && mise run commitlint -- -1 HEAD && echo "commitlint ok")
    git -C "$dir" ls-files '*.zsh' 'functions/*'
done
```

Expected, for each: the subject `chore: Initialise from template` and a body
naming the template; `no identity`; `.githooks`; `commitlint ok`; and four zsh
files: `functions/<name>`, `tests/run.zsh`, `tests/test_<name>.zsh` and
`<name>.plugin.zsh`, with `<name>` the repository's name as given (`_lead`,
`9-lives`, ...). No `repo_tmpl` path.

Then prove the checks fail when they should, in the first repository:

```bash
cd /tmp/e2e/zsh-my-plugin
printf 'test_early() {\n    assert_equal a b\n    true\n}\n' > tests/test_early.zsh
if mise run test:zsh >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else grep -m1 '^\[test:zsh\] FAIL\|^FAIL' /tmp/probe.log; fi
rm tests/test_early.zsh
mv tests/test_zsh-my-plugin.zsh /tmp/held.zsh
if mise run test:zsh >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else grep -m1 'collected no tests' /tmp/probe.log; fi
mv /tmp/held.zsh tests/test_zsh-my-plugin.zsh
cp functions/zsh-my-plugin /tmp/held-fn
printf 'if then\n' >> functions/zsh-my-plugin
if mise run lint:zsh >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else grep -m1 'parse error' /tmp/probe.log; fi
cp /tmp/held-fn functions/zsh-my-plugin
printf 'echo $never_set_anywhere\n' >> functions/zsh-my-plugin
if mise run lint:zsh >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else grep -m1 'C006' /tmp/probe.log; fi
cp /tmp/held-fn functions/zsh-my-plugin
printf 'x=(  a   b )\n' >> functions/zsh-my-plugin
if mise run lint:zsh >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else echo "formatting drift fails the task"; fi
git add functions/zsh-my-plugin
if mise run pre-commit >/tmp/probe.log 2>&1; then echo "UNEXPECTED: passed"; else echo "the pre-commit task fails on staged drift"; fi
mise run format:zsh >/dev/null 2>&1
if mise run lint:zsh >/dev/null 2>&1; then echo "format:zsh repairs it"; else echo "UNEXPECTED: still failing"; fi
git reset -q && git checkout -- . && git status --short
```

Expected: a `FAIL test_early` line, `collected no tests`, a `parse error` line,
a `C006` line (shuck's finding in `functions/zsh-my-plugin`, which its own
walk never reaches), `formatting drift fails the task`, `the pre-commit task
fails on staged drift`, `format:zsh repairs it`, and then no output from
`git status --short`.

- [ ] **Step 3: Check them with the shared CI tools**

The shared `lint-format` job runs tombi, shuck, actionlint and
editorconfig-checker over a new repository, and `lint-zsh` runs shuck over this
repository's own `templates/zsh`. Run the same tools from
`chewygumxx/.github`'s `actions/mise.toml`, with its tombi configuration:

```bash
bash -c '
set -u
repo=$PWD
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
    shuck check --output-format concise && echo "shuck check ok"
    shuck format --diff && echo "shuck format ok"
    actionlint && echo "actionlint ok"
    editorconfig-checker -disable-indent-size && echo "editorconfig ok"
done
cd "$repo" || exit 1
echo "== this repository: templates/zsh"
mapfile -d "" zsh < <("$tools/lib/filetype.sh" zsh)
printf "%s\n" "${zsh[@]}" | grep -c "^templates/zsh/"
config=(--config "per-file-shell = { \"**\" = \"zsh\" }")
shuck "${config[@]}" check --output-format concise -- "${zsh[@]}" && echo "shuck check ok"
shuck "${config[@]}" format --diff -- "${zsh[@]}" && echo "shuck format ok"
'
```

Expected: `ok` for every line of all four directories, and for this repository
the count `4` (the layer's zsh files), then `shuck check ok` and `shuck format
ok`: the layer's own `.shuck.toml` applies to the files under it, so the
shared job accepts them although this repository has no shuck configuration.
A `FAILED` line, or a shuck finding, names a file the CI would reject: fix the
layer (`tombi format --offline <file>`, or `shuck format` with the layer's
`.shuck.toml`), copy the result back into `templates/zsh`, and rerun from
Step 1.

- [ ] **Step 4: Clean up**

Run: `rm -rf /tmp/e2e /tmp/held.zsh /tmp/held-fn /tmp/probe.log /tmp/mut /tmp/plug.orig && git status --short`

Expected: no output; the tree is clean.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
