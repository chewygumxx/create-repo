---
ctime: 2026-09-30
mtime: 2026-10-05
spdx: GPL-3.0-only
title: >-
  Implementation Plan: multiple templates, phase 1
description: >-
  Plan for the engine behind several bundled templates: layers, a catalogue,
  --template and --with, identity edits and a CI matrix.
tags:
  - create-repo
  - plan
  - templates
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/docs/plans/2026-09-30-multiple-templates-phase-1.md
   -
   -->

# Implementation Plan: multiple templates, phase 1

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The engine for several bundled templates (layers, a catalogue,
`--template` and `--with`, named identity edits, a sentinel guard, a CI
matrix), shipping `standard`, today's template, as its only template.

**Architecture:** `template/` splits into two layer directories,
`templates/common` and `templates/npm`, which `lib/template.js` composes in
order, a later layer's file replacing an earlier one's. `lib/templates.js`
is the catalogue: each template's layers (a function of its chosen
features), family (its setup, format and check commands), identity edits
and name rule. `lib/init.js` becomes named edits followed by a guard that
fails if the template's identity remains.

**Tech Stack:** Node 24 standard library, `node:test`, JSDoc checked by
`tsc`; `jsonc-parser`; Biome, remark, prettier, yamllint; GitHub Actions
with `jdx/mise-action`.

**Spec:**
[`docs/specs/2026-09-30-multiple-templates-design.md`](../specs/2026-09-30-multiple-templates-design.md),
its "Phases" item 1. Phases 2 to 6 each get their own plan once the phase
before has landed.

## Global Constraints

- Node `>=24`; ES modules; every `.js` file starts with its header and
  `// @ts-check`, and is typechecked by `npm run typecheck`.
- No runtime dependency is added; `jsonc-parser` stays the only one.
- A new file's header follows its neighbours': the vim modeline, the SPDX
  line, `~chewygumxx/create-repo.git`, and `::: :/<its path>`.
- No em dash (U+2014) anywhere; `npm run lint:emdash` and the hooks reject
  them.
- Markdown wraps at 80 columns with `-` bullets (remark).
- JavaScript is Biome-formatted: 4 spaces, double quotes. Run
  `npx --no -- biome check --write <files>` before committing; the
  pre-commit hook rejects unformatted staged files.
- Commits are single-line Conventional Commits, header at most 50
  characters, scopes `claude` or `template` or none. Commit at the end of
  every task.
- The templates keep the `chewygumxx/repo-tmpl` identity in file headers
  and `.repo-metadata.jsonc`; `lib/init.js` rewrites it.
- `--template` defaults to `standard`; without a terminal, no features are
  chosen. `standard`'s output is today's template, byte for byte, apart
  from the first commit's body, which gains ` (standard)`.
- `UsageError` exits 2; `TemplateError` and `CommandError` exit 1.

## Deviations from the Spec

- `.worktreeinclude` goes in the `npm` layer, not `common`: it lists
  `/node_modules/`.
- `npm run templates:lock` is not built: an npm layer holds its
  `package.json` beside its lock, so `npm install --package-lock-only` in
  the layer's directory regenerates it. The Cargo lock, which needs `src/`
  from another layer, gets the materialising lock script in phase 4.
- The interim `lint:template` of Task 1 checks only `templates/npm`; Task 7
  replaces it with `lint:templates`, which checks every materialised
  combination. The matrix's pristine format check for native templates
  arrives with them in phase 4.

## Review Focus

1. `--with ""` or `--with " , "`, as CI passes for a template with no
   features: no features, no error (Task 4).
2. `--template Standard` or `--template a/b`: refused before anything runs
   with "Invalid template", not an unknown-template error after preflight
   (Task 4).
3. A prompted template reply of `0`, `9` or an unknown name: asks again
   with the range or the list, rather than failing (Task 5).
4. `--template` given with `--metadata-key-file -`, so nothing can be
   prompted, for a template with features: no features, never a prompt
   (Task 5).
5. A layer directory holding ignored files, such as a `node_modules/` left
   by `npm install --package-lock-only` experiments or `.templates/`
   materialisations in the root: never copied, never walked, never linted
   by the root's checks (Tasks 1 and 7).

---

### Task 1: Compose templates from layers

**Files:**

- Move: `template/**` to `templates/common/**` and `templates/npm/**`
- Modify: `lib/template.js` (whole file)
- Modify: `bin/create-repo.js` (the `copyTemplate(dir)` call)
- Modify: `test/template.test.js` (whole file), `test/init.test.js`,
  `test/pack.test.js`
- Modify: `package.json`, `.gitattributes`, `.biome.json`,
  `.github/dependabot.yml`, `.commitlintrc.mts`

**Interfaces:**

- Produces: `TEMPLATES_DIR: string`;
  `compose(layers: string[], root?: string): Map<string, string>` (each
  composed file, relative and as stored, to its absolute source, sorted);
  `templateFiles(layers: string[], root?: string): string[]`;
  `copyTemplate(dir: string, layers: string[], root?: string): string[]`.
  `RENAMED`, `VERSION`, `TemplateError`, `TargetExistsError`, `listFiles`
  are unchanged. `TEMPLATE_DIR` is removed.

- [ ] **Step 1: Move the template into two layers**

```sh
common='LICENSE .editorconfig .gitattributes .repo-metadata.jsonc
.claude/CLAUDE.md .claude/settings.json .claude/rules/repo-metadata.md
.claude/hooks/prohibit-em-dash.sh .github/pull_request_template.md'
npm='.biome.json .claude/hooks/install-deps.sh .commitlintrc.mts
.github/dependabot.yml .github/workflows/ci.yaml .husky/commit-msg
.husky/pre-commit .yamllint.yaml .worktreeinclude README.md _gitignore
mise.toml package-lock.json package.json tsconfig.json'
for layer in common npm; do
    eval "files=\$$layer"
    for file in $files; do
        mkdir -p "templates/$layer/$(dirname "$file")"
        git mv "template/$file" "templates/$layer/$file"
    done
done
git ls-files template | wc -l
find template -type d -empty -delete; ls template 2>&1
```

Expected: `0` files left in `template/`, and `ls` reports that `template`
does not exist.

- [ ] **Step 2: Write the failing tests**

Replace `test/template.test.js` with:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/template.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import {
    compose,
    copyTemplate,
    RENAMED,
    TargetExistsError,
    TEMPLATES_DIR,
    TemplateError,
    templateFiles,
} from "../lib/template.js";

/** The standard template's layers. */
const LAYERS = ["common", "npm"];

/** @param {(root: string) => void} body */
function inTemp(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-template-"));
    try {
        body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * Writes `files` under `root`, creating directories.
 * @param {string} root
 * @param {Record<string, string>} files
 */
function write(root, files) {
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), text);
    }
}

test("copies every file, restoring .gitignore", () =>
    inTemp((root) => {
        const files = copyTemplate(join(root, "x"), LAYERS);
        assert.ok(files.includes(".gitignore"));
        assert.ok(!files.includes("_gitignore"));
        assert.equal(files.length, templateFiles(LAYERS).length);
        assert.equal(
            readFileSync(join(root, "x", ".gitignore"), "utf8"),
            readFileSync(join(TEMPLATES_DIR, "npm", "_gitignore"), "utf8"),
        );
    }));

test("a later layer's file replaces an earlier one's", () =>
    inTemp((root) => {
        const from = join(root, "layers");
        write(from, {
            "a/_gitignore": "",
            "a/same.txt": "a\n",
            "a/only-a.txt": "a\n",
            "b/same.txt": "b\n",
            "b/sub/only-b.txt": "b\n",
        });
        const files = copyTemplate(join(root, "x"), ["a", "b"], from);
        assert.deepEqual(files, [
            ".gitignore",
            "only-a.txt",
            "same.txt",
            "sub/only-b.txt",
        ]);
        assert.equal(readFileSync(join(root, "x", "same.txt"), "utf8"), "b\n");
    }));

test("the last layer's _gitignore applies to every layer", () =>
    inTemp((root) => {
        const from = join(root, "layers");
        write(from, {
            "a/_gitignore": "a.txt\n",
            "a/a.txt": "",
            "a/b.txt": "",
            "b/_gitignore": "b.txt\n",
        });
        const files = copyTemplate(join(root, "x"), ["a", "b"], from);
        assert.deepEqual(files, [".gitignore", "a.txt"]);
        assert.equal(
            readFileSync(join(root, "x", ".gitignore"), "utf8"),
            "b.txt\n",
        );
    }));

test("a missing layer is a TemplateError naming it; nothing is copied", () =>
    inTemp((root) => {
        assert.throws(
            () => copyTemplate(join(root, "x"), ["common", "nope"]),
            (error) =>
                error instanceof TemplateError && /"nope"/.test(error.message),
        );
        assert.ok(!existsSync(join(root, "x")));
    }));

test("refuses a directory that exists", () =>
    inTemp((root) => {
        mkdirSync(join(root, "x"));
        assert.throws(
            () => copyTemplate(join(root, "x"), LAYERS),
            (error) =>
                error instanceof TargetExistsError &&
                error instanceof TemplateError &&
                /already exists/.test(error.message),
        );
    }));

// The header sync would rewrite these to name create-repo and templates/,
// and init would then find no header to rewrite.
test("every template header names the template and its own path", () => {
    const slug = parse(
        readFileSync(join(TEMPLATES_DIR, "common", ".repo-metadata.jsonc"), "utf8"),
    ).slug;
    const stray = [...compose(LAYERS)]
        .filter(([file, source]) => {
            const text = readFileSync(source, "utf8");
            const path = RENAMED[file] ?? file;
            return (
                text.includes("::: :/") &&
                !(
                    text.includes(`~${slug}.git`) &&
                    text.includes(`::: :/${path}`)
                )
            );
        })
        .map(([file]) => file);
    assert.deepEqual(stray, []);
});

/** Files a checkout's layers may gain, all ignored by the _gitignore. */
const STRAY = [
    "node_modules/pkg/index.js",
    ".env.local",
    "docs/notes.local.md",
    ".claude/worktrees/x/file",
];

/**
 * A copy of the layers with stray files added to each of the standard's.
 * @param {string} root
 */
function strayTemplates(root) {
    const from = join(root, "templates");
    cpSync(TEMPLATES_DIR, from, { recursive: true });
    for (const layer of LAYERS) {
        write(
            join(from, layer),
            Object.fromEntries(STRAY.map((file) => [file, "stray\n"])),
        );
    }
    return from;
}

test("lists no file the composed _gitignore ignores", () =>
    inTemp((root) => {
        const files = templateFiles(LAYERS, strayTemplates(root));
        assert.deepEqual(
            STRAY.filter((file) => files.includes(file)),
            [],
        );
        assert.deepEqual(files, templateFiles(LAYERS));
    }));

test("copies no file the composed _gitignore ignores", () =>
    inTemp((root) => {
        const from = strayTemplates(root);
        const files = copyTemplate(join(root, "x"), LAYERS, from);
        assert.deepEqual(
            STRAY.filter(
                (file) =>
                    files.includes(file) || existsSync(join(root, "x", file)),
            ),
            [],
        );
    }));

test("an ignore rule it cannot follow fails loudly", () =>
    inTemp((root) => {
        const from = strayTemplates(root);
        writeFileSync(join(from, "npm", "_gitignore"), "*.log\n!keep.log\n");
        assert.throws(
            () => templateFiles(LAYERS, from),
            (error) =>
                error instanceof TemplateError &&
                /!keep\.log/.test(error.message),
        );
    }));

test("layers without a _gitignore are a TemplateError naming it", () =>
    inTemp((root) => {
        const from = strayTemplates(root);
        rmSync(join(from, "npm", "_gitignore"));
        assert.throws(
            () => copyTemplate(join(root, "x"), LAYERS, from),
            (error) =>
                error instanceof TemplateError &&
                /_gitignore/.test(error.message),
        );
    }));
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `node --test test/template.test.js`

Expected: FAIL, `SyntaxError: The requested module '../lib/template.js'
does not provide an export named 'compose'`.

- [ ] **Step 4: Compose layers in `lib/template.js`**

Replace everything from the file's comment block down to the end with:

```js
// The bundled templates, templates/ in this package. Each subdirectory is a
// layer, and a template is an ordered list of layers, a later layer's file
// replacing the same path from an earlier one. npm drops any file named
// .gitignore from a package, so layers store it as _gitignore and
// copyTemplate() renames it back. The last layer's _gitignore applies to
// every layer: a checkout's layers may hold files it ignores, such as
// node_modules or .env.local, which neither templateFiles() nor
// copyTemplate() includes.

import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATES_DIR = fileURLToPath(
    new URL("../templates", import.meta.url),
);

/** @type {Record<string, string>} Stored name to real name. */
export const RENAMED = { _gitignore: ".gitignore" };

/** @type {string} This package's version, recorded in the first commit. */
export const VERSION = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

/** The template and the edits init makes to it disagree. */
export class TemplateError extends Error {}

/** The copy's target exists already; nothing was copied into it. */
export class TargetExistsError extends TemplateError {}

/**
 * The files under `dir`, relative to it, sorted.
 * @param {string} dir
 */
export function listFiles(dir) {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
        .sort();
}

/**
 * One `.gitignore` rule as a test of a path relative to a layer, a
 * directory's with a trailing slash. Only `*`, `?`, a leading `/` and a
 * trailing `/` are understood; anything else fails loudly.
 * @param {string} pattern
 */
function ignoreRule(pattern) {
    if (/^!|\*\*|\[|\\/.test(pattern)) {
        throw new TemplateError(
            `Unsupported rule "${pattern}" in the template's .gitignore.`,
        );
    }
    const dirOnly = pattern.endsWith("/");
    const body = dirOnly ? pattern.slice(0, -1) : pattern;
    const anchored = body.includes("/");
    const source = body
        .replace(/^\//, "")
        .replace(/[.+^${}()|\]]/g, "\\$&")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]");
    return new RegExp(
        `${anchored ? "^" : "(^|/)"}${source}${dirOnly ? "/" : "(/|$)"}`,
    );
}

/**
 * Tells whether a path relative to a layer is ignored by `gitignore`.
 * @param {string} gitignore the composed _gitignore's path
 * @returns {(path: string) => boolean}
 */
function ignoredBy(gitignore) {
    const rules = readFileSync(gitignore, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map(ignoreRule);
    return (path) => rules.some((rule) => rule.test(path));
}

/**
 * A layer's files, relative to it, without what `ignored` matches and
 * without descending into an ignored directory.
 * @param {string} root the layer
 * @param {(path: string) => boolean} ignored
 * @param {string} [dir] relative to `root`
 * @returns {string[]}
 */
function walk(root, ignored, dir = "") {
    /** @type {string[]} */
    const files = [];
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (!ignored(`${path}/`)) files.push(...walk(root, ignored, path));
        } else if (entry.isFile() && !ignored(path)) {
            files.push(path);
        }
    }
    return files;
}

/**
 * The template `layers` compose: each file, relative to the template and as
 * stored, to the layer file it comes from, sorted.
 * @param {string[]} layers
 * @param {string} [root]
 * @returns {Map<string, string>}
 */
export function compose(layers, root = TEMPLATES_DIR) {
    const dirs = layers.map((layer) => {
        const dir = join(root, layer);
        if (!existsSync(dir)) {
            throw new TemplateError(`No layer "${layer}" in ${root}.`);
        }
        return dir;
    });
    const gitignore = dirs
        .map((dir) => join(dir, "_gitignore"))
        .findLast((path) => existsSync(path));
    if (!gitignore) {
        throw new TemplateError(
            `None of the layers ${layers.join(", ")} has a _gitignore.`,
        );
    }
    const ignored = ignoredBy(gitignore);
    /** @type {Map<string, string>} */
    const files = new Map();
    for (const dir of dirs) {
        for (const file of walk(dir, ignored)) files.set(file, join(dir, file));
    }
    return new Map([...files].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * The files of the template `layers` compose, relative to it, sorted, as
 * stored.
 * @param {string[]} layers
 * @param {string} [root]
 */
export function templateFiles(layers, root = TEMPLATES_DIR) {
    return [...compose(layers, root).keys()];
}

/**
 * Copies the template `layers` compose into `dir`, which must not exist.
 * @param {string} dir
 * @param {string[]} layers
 * @param {string} [root]
 * @returns {string[]} the copy's files, relative to `dir`
 */
export function copyTemplate(dir, layers, root = TEMPLATES_DIR) {
    if (existsSync(dir)) throw new TargetExistsError(`${dir} already exists.`);
    try {
        return copy(dir, layers, root);
    } catch (error) {
        if (error instanceof TemplateError) throw error;
        throw new TemplateError(
            `Cannot copy the template to ${dir}: ${error instanceof Error ? error.message : error}`,
            { cause: error },
        );
    }
}

/**
 * @param {string} dir
 * @param {string[]} layers
 * @param {string} root
 */
function copy(dir, layers, root) {
    for (const [file, source] of compose(layers, root)) {
        const target = join(dir, RENAMED[file] ?? file);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(source, target);
    }
    return listFiles(dir);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test test/template.test.js`

Expected: PASS, 10 tests.

- [ ] **Step 6: Point the other callers at the layers**

In `bin/create-repo.js`, replace `const files = copyTemplate(dir);` with:

```js
        const files = copyTemplate(dir, ["common", "npm"]);
```

In `test/init.test.js`, replace the `../lib/template.js` import with:

```js
import {
    copyTemplate,
    TEMPLATES_DIR,
    TemplateError,
} from "../lib/template.js";
```

Replace `const files = copyTemplate(dir);` with
`const files = copyTemplate(dir, ["common", "npm"]);`, and
`read(TEMPLATE_DIR, ".commitlintrc.mts")` with
`read(join(TEMPLATES_DIR, "npm"), ".commitlintrc.mts")`.

In `test/pack.test.js`, change the imports to:

```js
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compose } from "../lib/template.js";
```

and the first test to:

```js
test("the package carries every template file", () => {
    const files = packed();
    assert.deepEqual(
        [...compose(["common", "npm"]).values()]
            .map((source) => relative(ROOT, source))
            .filter((file) => !files.has(file)),
        [],
    );
});
```

- [ ] **Step 7: Point the repository's configuration at `templates/`**

- `package.json`: in `files`, `"template"` becomes `"templates"`; the
  `lint:template` script becomes
  `"cd templates/npm && biome ci --vcs-use-ignore-file=false ."`.
- `.gitattributes`: `/template/** -sync-header-metadata` becomes
  `/templates/** -sync-header-metadata`, and the comment above it reads
  `# The bundled templates' headers name the template itself, a sentinel`.
- `.biome.json`: `"!!**/template"` becomes `"!!**/templates"`.
- `.github/dependabot.yml`: both `directory: /template` become
  `directory: /templates/npm`.
- `.commitlintrc.mts`: the `template` scope's description becomes
  `"The bundled templates under templates/"`.

- [ ] **Step 8: Run the whole check**

Run: `npm run check`

Expected: every step passes, ending with the test summary `# fail 0`.

- [ ] **Step 9: Commit**

```sh
npx --no -- biome check --write lib/template.js bin/create-repo.js test
git add -A templates lib bin test package.json .gitattributes \
    .biome.json .github/dependabot.yml .commitlintrc.mts
git commit -m "refactor(template): Compose templates from layers"
```

---

### Task 2: Named identity edits and the sentinel guard

**Files:**

- Modify: `lib/init.js` (from the `Identity` typedef to the end)
- Modify: `bin/create-repo.js` (the `init` import and call)
- Test: `test/init.test.js`

**Interfaces:**

- Consumes: `copyTemplate(dir, layers)` from Task 1.
- Produces:
  - `EditContext`: `{ dir: string, identity: Identity, files: string[],
    features: ReadonlySet<string>, slug: string, template: string,
    today: string }`; an edit that renames a file updates `files`.
  - `Edit`: `(context: EditContext) => void`.
  - Edits: `headers`, `repoMetadata`, `packageJson`, `packageLock`,
    `readme`, `commitlintScopes`.
  - `init(dir: string, identity: Identity, files: string[], options: {
    edits: Edit[], features?: string[], today?: string }): void`, which
    after the edits throws `TemplateError` if any path or content of
    `files` still matches
    `/repo-tmpl|repo_tmpl|is_template|Using this template/`.

- [ ] **Step 1: Write the failing tests**

In `test/init.test.js`, replace the imports with:

```js
import assert from "node:assert/strict";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    rmSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import {
    commitlintScopes,
    headers,
    init,
    packageJson,
    packageLock,
    readme,
    repoMetadata,
} from "../lib/init.js";
import {
    copyTemplate,
    TEMPLATES_DIR,
    TemplateError,
} from "../lib/template.js";
```

Below `IDENTITY`, add:

```js
/** The standard template's edits. */
const EDITS = [
    headers,
    repoMetadata,
    packageJson,
    packageLock,
    readme,
    commitlintScopes,
];
```

In `initialised`, replace the `init(...)` call with:

```js
        init(
            dir,
            { ...IDENTITY, ...changes },
            files,
            { edits: EDITS, today: "2026-10-01" },
        );
```

Append:

```js
/** @param {(root: string) => void} body */
function inTemp(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
    try {
        body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * A copy holding only `files`, and its file list.
 * @param {string} root
 * @param {Record<string, string>} files
 */
function bare(root, files) {
    const dir = join(root, "bare");
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, file)), { recursive: true });
        writeFileSync(join(dir, file), text);
    }
    return { dir, files: Object.keys(files).sort() };
}

/** Metadata naming a template slug the guard does not look for. */
const METADATA = { ".repo-metadata.jsonc": '{ "slug": "someone/tmpl" }\n' };

test("each edit sees the identity, features and both slugs", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, { ...METADATA, "a.txt": "a\n" });
        /** @type {import("../lib/init.js").EditContext[]} */
        const seen = [];
        init(dir, IDENTITY, files, {
            edits: [
                (context) => {
                    seen.push(context);
                },
            ],
            features: ["lib"],
            today: "2026-10-01",
        });
        assert.equal(seen.length, 1);
        assert.equal(seen[0].slug, "example/derived-repo");
        assert.equal(seen[0].template, "someone/tmpl");
        assert.deepEqual([...seen[0].features], ["lib"]);
        assert.equal(seen[0].today, "2026-10-01");
    }));

test("the template's identity left in a file fails, naming it", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, {
            ...METADATA,
            "a.txt": "see repo-tmpl\n",
            "b.txt": "fine\n",
        });
        assert.throws(
            () => init(dir, IDENTITY, files, { edits: [] }),
            (error) =>
                error instanceof TemplateError &&
                /remains in a\.txt$/.test(error.message),
        );
    }));

test("the template's identity left in a path fails, naming it", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, {
            ...METADATA,
            "lua/repo_tmpl/init.lua": "return {}\n",
        });
        assert.throws(
            () => init(dir, IDENTITY, files, { edits: [] }),
            (error) =>
                error instanceof TemplateError &&
                /lua\/repo_tmpl\/init\.lua/.test(error.message),
        );
    }));

test("a path an edit renames is checked under its new name", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, {
            ...METADATA,
            "repo_tmpl.txt": "x\n",
        });
        init(dir, IDENTITY, files, {
            edits: [
                (context) => {
                    renameSync(
                        join(dir, "repo_tmpl.txt"),
                        join(dir, "derived.txt"),
                    );
                    context.files = context.files.map((file) =>
                        file === "repo_tmpl.txt" ? "derived.txt" : file,
                    );
                },
            ],
        });
        assert.ok(existsSync(join(dir, "derived.txt")));
    }));

test("an edit left out leaves identity the guard reports", () =>
    assert.throws(
        () =>
            inTemp((root) => {
                const dir = join(root, "derived");
                const files = copyTemplate(dir, ["common", "npm"]);
                init(dir, IDENTITY, files, {
                    edits: EDITS.filter((edit) => edit !== readme),
                });
            }),
        (error) =>
            error instanceof TemplateError &&
            /remains in .*README\.md/.test(error.message),
    ));
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/init.test.js`

Expected: FAIL, `does not provide an export named 'commitlintScopes'`.

- [ ] **Step 3: Split `lib/init.js` into edits**

Keep the header, imports, `Identity` typedef and the helpers `fail`,
`replace`, `editText`, `editJson`, `editJsonc`, `requireKeys`, `wrap`,
`linkUrls` and `yamlEntry` as they are. Change the file's comment to:

```js
// Turns a fresh copy of a template into a new repository by rewriting the
// identity in the files that carry it: each template names the edits it
// needs, and a guard then fails if its identity remains anywhere. The caller
// formats the copy after.
//
// Every edit fails when its target is missing, so a template change this
// module does not know about fails its tests rather than being skipped.
```

Replace `init`, `rewrite` and everything after them with:

```js
/**
 * What an edit works on.
 * @typedef {object} EditContext
 * @property {string} dir the copy
 * @property {Identity} identity
 * @property {string[]} files the copy's files, relative to `dir`; an edit
 *     that renames a file updates this list
 * @property {ReadonlySet<string>} features the template's chosen features
 * @property {string} slug the new repository's `owner/name`
 * @property {string} template the template's own slug, from its
 *     .repo-metadata.jsonc
 * @property {string} today YYYY-MM-DD
 */

/** @typedef {(context: EditContext) => void} Edit */

/** A path or text naming the template rather than the new repository. */
const TEMPLATE_IDENTITY =
    /repo-tmpl|repo_tmpl|is_template|Using this template/;

/**
 * @param {string} dir the copy
 * @param {Identity} identity
 * @param {string[]} files the copy's files, relative to `dir`
 * @param {{ edits: Edit[], features?: string[], today?: string }} options
 *     the template's edits, its chosen features, and `today` as YYYY-MM-DD
 * @throws {TemplateError} for any failure, a missing or unreadable file
 *     included, and when the template's identity remains after the edits
 */
export function init(dir, identity, files, options) {
    try {
        rewrite(dir, identity, files, options);
    } catch (error) {
        if (error instanceof TemplateError) throw error;
        throw new TemplateError(
            `init: ${error instanceof Error ? error.message : error}`,
            { cause: error },
        );
    }
}

/**
 * @param {string} dir
 * @param {Identity} identity
 * @param {string[]} files
 * @param {{ edits: Edit[], features?: string[], today?: string }} options
 */
function rewrite(
    dir,
    identity,
    files,
    {
        edits,
        features = [],
        today = new Date().toISOString().slice(0, 10),
    },
) {
    const template = parse(
        readFileSync(join(dir, ".repo-metadata.jsonc"), "utf8"),
    )?.slug;
    if (typeof template !== "string") {
        fail(`"slug" in .repo-metadata.jsonc not found`);
    }
    /** @type {EditContext} */
    const context = {
        dir,
        identity,
        files: [...files],
        features: new Set(features),
        slug: `${identity.owner}/${identity.name}`,
        template,
        today,
    };
    for (const edit of edits) edit(context);
    const remains = context.files.filter(
        (file) =>
            TEMPLATE_IDENTITY.test(file) ||
            TEMPLATE_IDENTITY.test(readFileSync(join(dir, file), "utf8")),
    );
    if (remains.length) {
        fail(`the template's identity remains in ${remains.join(", ")}`);
    }
}

/**
 * File headers name the repository as `~owner/name.git`. CI's header sync
 * would correct them, but its token may not push changes to workflow
 * files, so they are rewritten here.
 * @param {EditContext} context
 */
export function headers({ dir, files, template, slug }) {
    let count = 0;
    for (const file of files) {
        const path = join(dir, file);
        const text = readFileSync(path, "utf8");
        if (!text.includes(`~${template}.git`)) continue;
        writeFileSync(
            path,
            text.replaceAll(`~${template}.git`, `~${slug}.git`),
        );
        count += 1;
    }
    if (count === 0) fail(`no file header naming ~${template}.git found`);
}

/** @param {EditContext} context */
export function repoMetadata({
    dir,
    identity: { owner, name, description, topics },
    slug,
}) {
    editJsonc(join(dir, ".repo-metadata.jsonc"), ".repo-metadata.jsonc", [
        ["name", name],
        ["owner", owner],
        ["slug", slug],
        ["description", description],
        ["topics", topics],
        ["is_template", undefined],
    ]);
}

/** @param {EditContext} context */
export function packageJson({
    dir,
    identity: { name, description, topics },
    slug,
}) {
    editJson(join(dir, "package.json"), (data) => {
        requireKeys(
            data,
            ["name", "description", "keywords", "homepage", "repository"],
            "package.json",
        );
        data.name = name;
        data.description = description;
        data.keywords = topics;
        data.homepage = `https://github.com/${slug}`;
        data.repository = `github:${slug}`;
    });
}

/** @param {EditContext} context */
export function packageLock({ dir, identity: { name } }) {
    editJson(join(dir, "package-lock.json"), (data) => {
        requireKeys(data, ["name", "packages"], "package-lock.json");
        requireKeys(data.packages, [""], "package-lock.json packages");
        data.name = name;
        data.packages[""].name = name;
    });
}

/**
 * The frontmatter, and the heading, introduction and "Using this template"
 * section, which become the name and the description.
 * @param {EditContext} context
 */
export function readme({ dir, identity: { name, description, topics }, today }) {
    editText(join(dir, "README.md"), (text) => {
        const tags = topics.length
            ? `tags:\n${topics.map((topic) => `  - ${topic}\n`).join("")}`
            : "tags: []\n";
        // An entry is its key line plus any more-indented continuation
        // lines, so a folded scalar is replaced whole.
        const entry = (/** @type {string} */ key) =>
            new RegExp(`^${key}:.*(?:\\n {2}.*)*$`, "m");
        text = replace(text, /^ctime: .*$/m, () => `ctime: ${today}`, "ctime");
        text = replace(
            text,
            entry("title"),
            () => yamlEntry("title", name),
            "title",
        );
        text = replace(
            text,
            entry("description"),
            () => yamlEntry("description", description),
            "description",
        );
        text = replace(text, /^tags:\n(?: {2}- .*\n)+/m, () => tags, "tags");
        return replace(
            text,
            /^# repo-tmpl\n\n[\s\S]*?\n## Using this template\n[\s\S]*?\n(?=## )/m,
            () => `# ${name}\n\n${wrap(linkUrls(description))}\n\n`,
            'the heading, intro and "Using this template" in README.md',
        );
    });
}

/**
 * The scopes asked for, after the template's own.
 * @param {EditContext} context
 */
export function commitlintScopes({ dir, identity: { scopes } }) {
    if (!scopes.length) return;
    editText(join(dir, ".commitlintrc.mts"), (text) =>
        replace(
            text,
            /\n {4}\],\n\}\);\n$/,
            () =>
                `${scopes
                    .map(
                        (scope) =>
                            `\n        {\n` +
                            `            name: ${JSON.stringify(scope.name)},\n` +
                            `            fullName: ${JSON.stringify(scope.fullName)},\n` +
                            `            description: ${JSON.stringify(scope.fullName)},\n` +
                            `        },`,
                    )
                    .join("")}\n    ],\n});\n`,
            "the end of the scopes in .commitlintrc.mts",
        ),
    );
}
```

- [ ] **Step 4: Pass the standard edits from `bin/create-repo.js`**

Add `commitlintScopes, headers, packageJson, packageLock, readme,
repoMetadata` to the `../lib/init.js` import, and replace
`init(dir, answers, files);` with:

```js
        init(dir, answers, files, {
            edits: [
                headers,
                repoMetadata,
                packageJson,
                packageLock,
                readme,
                commitlintScopes,
            ],
        });
```

(Task 6 replaces this list with the catalogue's.)

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm run typecheck && node --test test/init.test.js test/bin.test.js`

Expected: PASS, `# fail 0`.

- [ ] **Step 6: Commit**

```sh
npx --no -- biome check --write lib/init.js bin/create-repo.js test/init.test.js
git add lib/init.js bin/create-repo.js test/init.test.js
git commit -m "refactor: Split init into named edits"
```

---

### Task 3: The template catalogue

**Files:**

- Create: `lib/templates.js`
- Create: `test/templates.test.js`
- Modify: `test/template.test.js` (remove the header test, which moves)
- Modify: `test/pack.test.js`

**Interfaces:**

- Consumes: the edits and `Edit` from Task 2; `compose`, `copyTemplate`,
  `TEMPLATES_DIR` from Task 1; `UsageError` from `lib/args.js`.
- Produces:
  - `Command`: `{ file: string, args: string[] }`.
  - `Family`: `{ setup: Command[], format: Command, check: Command }`;
    `FAMILIES: Record<string, Family>`, with `npm`.
  - `Template`: `{ description: string, family: string, features:
    Record<string, string>, layers: (features: ReadonlySet<string>) =>
    string[], edits: Edit[], checkName?: (identity: { owner: string, name:
    string }, features: ReadonlySet<string>) => void }`.
  - `TEMPLATES: Record<string, Template>`, with `standard`;
    `DEFAULT_TEMPLATE = "standard"`.
  - `getTemplate(name: string, templates?): Template`, a `UsageError` for
    an unknown name.
  - `checkFeatures(name: string, template: Template, features: string[]):
    string[]`, in the template's order, deduplicated, a `UsageError` for an
    unknown feature.
  - `label(name: string, features: string[]): string`, `"rust, with lib"`.
  - `combinations(templates?): { template: string, features: string[] }[]`.

- [ ] **Step 1: Write the failing tests**

Create `test/templates.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/templates.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import { UsageError } from "../lib/args.js";
import { init } from "../lib/init.js";
import {
    compose,
    copyTemplate,
    RENAMED,
    TEMPLATES_DIR,
} from "../lib/template.js";
import {
    checkFeatures,
    combinations,
    FAMILIES,
    getTemplate,
    label,
    TEMPLATES,
} from "../lib/templates.js";

/** @typedef {import("../lib/templates.js").Template} Template */

const IDENTITY = {
    owner: "example",
    name: "derived-repo",
    description: "A derived repository.",
    topics: ["alpha"],
    scopes: [{ name: "api", fullName: "Api" }],
};

/**
 * @param {{ template: string, features: string[] }} combination
 */
const layersOf = ({ template, features }) =>
    TEMPLATES[template].layers(new Set(features));

test("every template has a family, and layers that exist", () => {
    const layers = readdirSync(TEMPLATES_DIR);
    for (const combination of combinations()) {
        const name = label(combination.template, combination.features);
        assert.ok(
            Object.hasOwn(FAMILIES, TEMPLATES[combination.template].family),
            name,
        );
        assert.deepEqual(
            layersOf(combination).filter((layer) => !layers.includes(layer)),
            [],
            name,
        );
    }
});

test("every layer belongs to a template", () => {
    const used = new Set(combinations().flatMap(layersOf));
    assert.deepEqual(
        readdirSync(TEMPLATES_DIR).filter((layer) => !used.has(layer)),
        [],
    );
});

// The header sync would rewrite these to name create-repo and templates/,
// and init would then find no header to rewrite.
test("every template header names the template and its own path", () => {
    for (const combination of combinations()) {
        const sources = compose(layersOf(combination));
        const slug = parse(
            readFileSync(sources.get(".repo-metadata.jsonc") ?? "", "utf8"),
        ).slug;
        const stray = [...sources]
            .filter(([file, source]) => {
                const text = readFileSync(source, "utf8");
                const path = RENAMED[file] ?? file;
                return (
                    text.includes("::: :/") &&
                    !(
                        text.includes(`~${slug}.git`) &&
                        text.includes(`::: :/${path}`)
                    )
                );
            })
            .map(([file]) => file);
        assert.deepEqual(
            stray,
            [],
            label(combination.template, combination.features),
        );
    }
});

test("every combination copies and initialises, leaving no identity", () => {
    for (const combination of combinations()) {
        const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
        try {
            const dir = join(root, "x");
            const files = copyTemplate(dir, layersOf(combination));
            assert.ok(files.includes(".gitignore"));
            init(dir, IDENTITY, files, {
                edits: TEMPLATES[combination.template].edits,
                features: combination.features,
                today: "2026-10-01",
            });
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    }
});

/** @type {Record<string, Template>} */
const FAKE = {
    plain: {
        description: "P",
        family: "npm",
        features: {},
        layers: () => ["common"],
        edits: [],
    },
    crate: {
        description: "C",
        family: "npm",
        features: { lib: "L", bin: "B" },
        layers: () => ["common"],
        edits: [],
    },
};

test("an unknown template is a UsageError listing the templates", () => {
    assert.throws(
        () => getTemplate("nope", FAKE),
        (error) =>
            error instanceof UsageError &&
            /"nope".*plain, crate/.test(error.message),
    );
    assert.throws(() => getTemplate("constructor", FAKE), UsageError);
    assert.equal(getTemplate("crate", FAKE), FAKE.crate);
});

test("features are checked, deduplicated and in the template's order", () => {
    assert.deepEqual(
        checkFeatures("crate", FAKE.crate, ["bin", "lib", "bin"]),
        ["lib", "bin"],
    );
    assert.throws(
        () => checkFeatures("crate", FAKE.crate, ["wasm"]),
        (error) =>
            error instanceof UsageError &&
            /no feature "wasm".*lib, bin/.test(error.message),
    );
    assert.throws(
        () => checkFeatures("plain", FAKE.plain, ["lib"]),
        (error) =>
            error instanceof UsageError &&
            /has no features/.test(error.message),
    );
});

test("combinations cover every subset of every template's features", () => {
    assert.deepEqual(combinations(FAKE), [
        { template: "plain", features: [] },
        { template: "crate", features: [] },
        { template: "crate", features: ["lib"] },
        { template: "crate", features: ["bin"] },
        { template: "crate", features: ["lib", "bin"] },
    ]);
});

test("a label names the template and its features", () => {
    assert.equal(label("standard", []), "standard");
    assert.equal(label("rust", ["lib"]), "rust, with lib");
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/templates.test.js`

Expected: FAIL, `Cannot find module '.../lib/templates.js'`.

- [ ] **Step 3: Write `lib/templates.js`**

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/templates.js
//
//

// @ts-check

// The templates this package bundles: for each, the layers it is composed
// of, its optional features, the family that installs, formats and checks
// it, the identity edits init makes, and any rule its name must meet.

import { UsageError } from "./args.js";
import {
    commitlintScopes,
    headers,
    packageJson,
    packageLock,
    readme,
    repoMetadata,
} from "./init.js";

/** @typedef {import("./init.js").Edit} Edit */
/** @typedef {{ file: string, args: string[] }} Command */

/**
 * How a family's templates are installed, formatted and checked, once mise
 * has installed their toolchain.
 * @typedef {object} Family
 * @property {Command[]} setup
 * @property {Command} format
 * @property {Command} check
 */

/** @type {Record<string, Family>} */
export const FAMILIES = {
    npm: {
        setup: [{ file: "npm", args: ["ci", "--no-fund", "--no-audit"] }],
        format: { file: "npm", args: ["run", "--silent", "format"] },
        check: { file: "npm", args: ["run", "check"] },
    },
};

/**
 * @typedef {object} Template
 * @property {string} description one line, for --help and the prompt
 * @property {string} family a key of FAMILIES
 * @property {Record<string, string>} features each optional feature's name
 *     and one-line description
 * @property {(features: ReadonlySet<string>) => string[]} layers
 * @property {Edit[]} edits
 * @property {(identity: { owner: string, name: string }, features: ReadonlySet<string>) => void} [checkName]
 *     throws UsageError when the template cannot use the name
 */

export const DEFAULT_TEMPLATE = "standard";

/** @type {Record<string, Template>} */
export const TEMPLATES = {
    standard: {
        description:
            "Any repository: commit rules, lint and format checks, CI and Claude Code settings",
        family: "npm",
        features: {},
        layers: () => ["common", "npm"],
        edits: [
            headers,
            repoMetadata,
            packageJson,
            packageLock,
            readme,
            commitlintScopes,
        ],
    },
};

/**
 * @param {string} name
 * @param {Record<string, Template>} [templates]
 */
export function getTemplate(name, templates = TEMPLATES) {
    if (!Object.hasOwn(templates, name)) {
        throw new UsageError(
            `Unknown template "${name}": choose one of ${Object.keys(templates).join(", ")}.`,
        );
    }
    return templates[name];
}

/**
 * Checks features against the template's, returning them in its order
 * without duplicates.
 * @param {string} name the template's
 * @param {Template} template
 * @param {string[]} features
 */
export function checkFeatures(name, template, features) {
    const known = Object.keys(template.features);
    for (const feature of features) {
        if (known.includes(feature)) continue;
        throw new UsageError(
            known.length
                ? `The ${name} template has no feature "${feature}": choose from ${known.join(", ")}.`
                : `The ${name} template has no features; leave out --with.`,
        );
    }
    return known.filter((feature) => features.includes(feature));
}

/**
 * The template and its features, for the summary and the first commit:
 * `standard`, or `rust, with lib`.
 * @param {string} name
 * @param {string[]} features
 */
export function label(name, features) {
    return features.length ? `${name}, with ${features.join(", ")}` : name;
}

/**
 * Every template with every combination of its features.
 * @param {Record<string, Template>} [templates]
 * @returns {{ template: string, features: string[] }[]}
 */
export function combinations(templates = TEMPLATES) {
    return Object.entries(templates).flatMap(([template, { features }]) =>
        Object.keys(features)
            .reduce(
                (subsets, feature) => [
                    ...subsets,
                    ...subsets.map((subset) => [...subset, feature]),
                ],
                /** @type {string[][]} */ ([[]]),
            )
            .map((chosen) => ({ template, features: chosen })),
    );
}
```

- [ ] **Step 4: Move the header test and widen the pack test**

Delete the `every template header names the template and its own path`
test and its comment from `test/template.test.js`, and drop `compose`,
`parse` and `RENAMED` from its imports, which nothing else there uses.

In `test/pack.test.js`, add
`import { combinations, TEMPLATES } from "../lib/templates.js";` and make
the first test:

```js
test("the package carries every template file", () => {
    const files = packed();
    const sources = new Set(
        combinations().flatMap(({ template, features }) => [
            ...compose(TEMPLATES[template].layers(new Set(features))).values(),
        ]),
    );
    assert.deepEqual(
        [...sources]
            .map((source) => relative(ROOT, source))
            .filter((file) => !files.has(file)),
        [],
    );
});
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm run typecheck && node --test test/templates.test.js test/template.test.js test/pack.test.js`

Expected: PASS, `# fail 0`.

- [ ] **Step 6: Commit**

```sh
npx --no -- biome check --write lib/templates.js test
git add lib/templates.js test/templates.test.js test/template.test.js \
    test/pack.test.js
git commit -m "feat: Add the template catalogue"
```

---

### Task 4: `--template` and `--with`

**Files:**

- Modify: `lib/args.js` (the `Options` typedef, a new
  `checkTemplateName` and `parseFeatures`, `parseOptions`)
- Test: `test/args.test.js`

**Interfaces:**

- Produces: `Options.template?: string`, `Options.features?: string[]`;
  `parseFeatures(text: string): string[]` (comma separated, trimmed,
  deduplicated, each `^[a-z][a-z0-9-]*$`). The template name is checked for
  shape only here (`^[a-z][a-z0-9-]*$`); Task 5 checks it exists, since
  `lib/templates.js` imports this module.

- [ ] **Step 1: Write the failing tests**

In `test/args.test.js`, import `parseFeatures` too. In `reads the name and
every flag`, add `"--template", "standard", "--with", "a, b",` after
`"api,cli:Command Line",`, and in its expected object add, after `scopes`:

```js
        template: "standard",
        features: ["a", "b"],
```

Replace the `--template is no longer accepted` test with:

```js
// It once named a GitHub repository; now it names a bundled template.
test("--template takes a bundled template's name, not a repository", () => {
    for (const name of ["a/b", "Standard", "x_y", ""]) {
        assert.throws(
            () => parseOptions(["--template", name]),
            (error) =>
                error instanceof UsageError &&
                /Invalid template/.test(error.message),
            name,
        );
    }
});

test("an empty --with is no features", () => {
    assert.deepEqual(parseOptions(["--with", ""]).features, []);
    assert.deepEqual(parseOptions(["--with", " , "]).features, []);
    assert.deepEqual(parseFeatures("lib, lib,bin"), ["lib", "bin"]);
});
```

In `defaults leave prompted values undefined`, add:

```js
    assert.equal(options.template, undefined);
    assert.equal(options.features, undefined);
```

In `rejects mistakes before anything is created`, add
`["--with", "Bad"],` and `["--with", "a b"],` to the list.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/args.test.js`

Expected: FAIL, `does not provide an export named 'parseFeatures'`.

- [ ] **Step 3: Parse the flags**

In `lib/args.js`, add to the `Options` typedef after `scopes`:

```js
 * @property {string} [template]
 * @property {string[]} [features]
```

After the `SCOPE` constant, add:

```js
// A bundled template's name or feature; lib/templates.js has the list.
const TEMPLATE = /^[a-z][a-z0-9-]*$/;
```

After `parseScopes`, add:

```js
/** @param {string} name */
function checkTemplateName(name) {
    if (!TEMPLATE.test(name)) {
        throw new UsageError(
            `Invalid template "${name}": name one bundled with this package; --help lists them.`,
        );
    }
    return name;
}

/** @param {string} text comma separated */
export function parseFeatures(text) {
    const features = [...new Set(list(text))];
    for (const feature of features) {
        if (!TEMPLATE.test(feature)) {
            throw new UsageError(
                `Invalid feature "${feature}": --help lists each template's.`,
            );
        }
    }
    return features;
}
```

In `parseOptions`, add to the `parseArgs` options after `scopes`:

```js
                template: { type: "string" },
                with: { type: "string" },
```

and to the returned `options` after `scopes`:

```js
        template:
            values.template === undefined
                ? undefined
                : checkTemplateName(values.template),
        features:
            values.with === undefined
                ? undefined
                : parseFeatures(values.with),
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm run typecheck && node --test test/args.test.js`

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```sh
npx --no -- biome check --write lib/args.js test/args.test.js
git add lib/args.js test/args.test.js
git commit -m "feat: Accept --template and --with"
```

---

### Task 5: Choosing the template and features

**Files:**

- Modify: `lib/prompt.js` (imports, `Answers`, `completeAnswers`,
  `summary`; new `templateQuestion`, `pickTemplate`, `featureQuestion`)
- Test: `test/prompt.test.js`

**Interfaces:**

- Consumes: `Options.template`, `Options.features`, `parseFeatures` (Task
  4); `TEMPLATES`, `DEFAULT_TEMPLATE`, `getTemplate`, `checkFeatures`,
  `label`, `Template` (Task 3).
- Produces: `Answers.template: string`, `Answers.features: string[]`;
  `completeAnswers(options, { owner, ask?, warn?, templates? })`, where
  `templates` defaults to `TEMPLATES`. Prompt order: template (only when
  not a flag, there is a terminal, and there is more than one template),
  features (only when not a flag, there is a terminal, and the template has
  some), name, description, topics, scopes. The name must pass the
  template's `checkName`: a prompt asks again, a flag is a `UsageError`.

- [ ] **Step 1: Write the failing tests**

In `test/prompt.test.js`, in `prompts for every missing value`, add to the
expected object after `scopes`:

```js
        template: "standard",
        features: [],
```

In `without a terminal, a missing name fails and topics are empty`, add
after the last assertion:

```js
    assert.equal(answers.template, "standard");
    assert.deepEqual(answers.features, []);
```

Append:

```js
/** @type {Record<string, import("../lib/templates.js").Template>} */
const CATALOGUE = {
    standard: {
        description: "S",
        family: "npm",
        features: {},
        layers: () => [],
        edits: [],
    },
    crate: {
        description: "C",
        family: "npm",
        features: { lib: "L", bin: "B" },
        layers: () => [],
        edits: [],
        checkName: ({ name }) => {
            if (name.includes(".")) throw new UsageError("No dots.");
        },
    },
};

test("prompts for the template and its features when there is a choice", async () => {
    const { ask, asked } = asker(["2", "lib", "my-thing", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: CATALOGUE,
    });
    assert.equal(answers.template, "crate");
    assert.deepEqual(answers.features, ["lib"]);
    assert.match(asked[0], /1\. standard +S\n {2}2\. crate +C\nTemplate \[standard\]: $/);
    assert.match(asked[1], /lib +L/);
});

test("an empty reply takes standard, which asks for no features", async () => {
    const { ask, asked } = asker(["", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: CATALOGUE,
    });
    assert.equal(answers.template, "standard");
    assert.deepEqual(answers.features, []);
    assert.equal(asked.length, 5);
});

test("a bad template reply asks again", async () => {
    /** @type {string[]} */
    const warnings = [];
    const { ask } = asker(["0", "9", "nope", "crate", "", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        warn: (message) => warnings.push(message),
        templates: CATALOGUE,
    });
    assert.equal(answers.template, "crate");
    assert.deepEqual(warnings.slice(0, 2), [
        "Choose 1 to 2.",
        "Choose 1 to 2.",
    ]);
    assert.match(warnings[2], /Unknown template "nope"/);
});

test("the template's name rule asks again, and refuses a flag", async () => {
    /** @type {string[]} */
    const warnings = [];
    const { ask } = asker(["crate", "", "a.b", "ab", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        warn: (message) => warnings.push(message),
        templates: CATALOGUE,
    });
    assert.equal(answers.name, "ab");
    assert.deepEqual(warnings, ["No dots."]);
    await assert.rejects(
        completeAnswers(
            parseOptions(["a.b", "--template", "crate", "--description", "D"]),
            { owner: "o", templates: CATALOGUE },
        ),
        /No dots\./,
    );
});

test("flags choose the template and features without asking", async () => {
    const answers = await completeAnswers(
        parseOptions([
            "x",
            "--description",
            "D",
            "--template",
            "crate",
            "--with",
            "bin,lib",
            "--topics",
            "",
            "--scopes",
            "",
        ]),
        { owner: "o", ask: asker([]).ask, templates: CATALOGUE },
    );
    assert.equal(answers.template, "crate");
    assert.deepEqual(answers.features, ["lib", "bin"]);
});

test("without a terminal, a template's features default to none", async () => {
    const answers = await completeAnswers(
        parseOptions(["x", "--description", "D", "--template", "crate"]),
        { owner: "o", templates: CATALOGUE },
    );
    assert.deepEqual(answers.features, []);
});

test("unknown templates and features are refused", async () => {
    const run = (/** @type {string[]} */ argv) =>
        completeAnswers(parseOptions(["x", "--description", "D", ...argv]), {
            owner: "o",
            templates: CATALOGUE,
        });
    await assert.rejects(run(["--template", "nope"]), /Unknown template "nope"/);
    await assert.rejects(
        run(["--template", "crate", "--with", "wasm"]),
        /no feature "wasm"/,
    );
    await assert.rejects(run(["--with", "lib"]), /has no features/);
});

test("the summary names the template and its features", async () => {
    const answers = await completeAnswers(
        parseOptions(["x", "--description", "D", "--template", "crate", "--with", "lib"]),
        { owner: "o", templates: CATALOGUE },
    );
    assert.match(summary(answers, { dryRun: false }), /Template +crate, with lib/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/prompt.test.js`

Expected: FAIL; the first two tests' expected objects lack `template`, and
the catalogue tests ask the name first.

- [ ] **Step 3: Choose the template in `lib/prompt.js`**

Replace the imports with:

```js
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
    checkDescription,
    checkName,
    parseFeatures,
    parseScopes,
    parseTopics,
    UsageError,
} from "./args.js";
import {
    checkFeatures,
    DEFAULT_TEMPLATE,
    getTemplate,
    label,
    TEMPLATES,
} from "./templates.js";
```

Below the existing typedefs, add
`/** @typedef {import("./templates.js").Template} Template */`, and add to
`Answers` after `scopes`:

```js
 * @property {string} template
 * @property {string[]} features
```

After `askUntil`, add:

```js
/**
 * The numbered list of templates, then the question.
 * @param {Record<string, Template>} templates
 * @param {string} fallback
 */
function templateQuestion(templates, fallback) {
    const names = Object.keys(templates);
    const width = Math.max(...names.map((name) => name.length));
    const rows = names.map(
        (name, index) =>
            `  ${index + 1}. ${name.padEnd(width)}  ${templates[name].description}`,
    );
    return `Templates:\n${rows.join("\n")}\nTemplate [${fallback}]: `;
}

/**
 * A template by number or name; an empty reply is the fallback.
 * @param {string} reply
 * @param {Record<string, Template>} templates
 * @param {string} fallback
 */
function pickTemplate(reply, templates, fallback) {
    if (!reply) return fallback;
    const names = Object.keys(templates);
    if (/^\d+$/.test(reply)) {
        const name = names[Number(reply) - 1];
        if (name === undefined) {
            throw new UsageError(`Choose 1 to ${names.length}.`);
        }
        return name;
    }
    getTemplate(reply, templates);
    return reply;
}

/**
 * The template's features, then the question.
 * @param {string} name
 * @param {Template} template
 */
function featureQuestion(name, template) {
    const entries = Object.entries(template.features);
    const width = Math.max(...entries.map(([feature]) => feature.length));
    const rows = entries.map(
        ([feature, description]) =>
            `  ${feature.padEnd(width)}  ${description}`,
    );
    return `Features of ${name}:\n${rows.join("\n")}\nFeatures (comma separated, may be empty): `;
}
```

In `completeAnswers`, change the context's type to
`{ owner: string, ask?: Ask, warn?: (message: string) => void, templates?: Record<string, Template> }`,
and replace the `const name = await value(...)` statement with:

```js
    const templates = context.templates ?? TEMPLATES;
    const owner = options.owner ?? context.owner;
    const names = Object.keys(templates);
    const fallback = names.includes(DEFAULT_TEMPLATE)
        ? DEFAULT_TEMPLATE
        : names[0];
    /** @type {string} */
    let templateName;
    if (options.template !== undefined) {
        getTemplate(options.template, templates);
        templateName = options.template;
    } else if (ask && names.length > 1) {
        templateName = await askUntil(
            ask,
            templateQuestion(templates, fallback),
            (reply) => pickTemplate(reply, templates, fallback),
            warn,
        );
    } else {
        templateName = fallback;
    }
    const template = templates[templateName];
    const features =
        options.features !== undefined
            ? checkFeatures(templateName, template, options.features)
            : ask && Object.keys(template.features).length
              ? await askUntil(
                    ask,
                    featureQuestion(templateName, template),
                    (reply) =>
                        checkFeatures(
                            templateName,
                            template,
                            parseFeatures(reply),
                        ),
                    warn,
                )
              : [];
    const chosen = new Set(features);
    /** @param {string} reply */
    const nameFor = (reply) => {
        const name = checkName(reply);
        template.checkName?.({ owner, name }, chosen);
        return name;
    };
    const name = await value(
        options.name === undefined ? undefined : nameFor(options.name),
        "the repository name",
        "Repository name: ",
        nameFor,
    );
```

In the returned object, add `template: templateName,` and `features,`
after `scopes,`, and replace `owner: options.owner ?? context.owner,` with
`owner,`.

In `summary`, add after the `Repository` row:

```js
        ["Template", label(answers.template, answers.features)],
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm run typecheck && node --test test/prompt.test.js`

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```sh
npx --no -- biome check --write lib/prompt.js test/prompt.test.js
git add lib/prompt.js test/prompt.test.js
git commit -m "feat: Prompt for the template and features"
```

---

### Task 6: Create from the chosen template

**Files:**

- Modify: `bin/create-repo.js` (imports, `USAGE`, `main`)
- Test: `test/bin.test.js`

**Interfaces:**

- Consumes: `Answers.template`, `Answers.features` (Task 5); `TEMPLATES`,
  `FAMILIES`, `label` (Task 3); `copyTemplate(dir, layers)` (Task 1);
  `init(dir, identity, files, { edits, features })` (Task 2).
- Produces: the first commit's body
  `Generated by @chewygumxx/create-repo <version> (<label>).`; `--help`
  ends with a `Templates:` list naming each template's features as
  `--with <feature>`.

- [ ] **Step 1: Write the failing tests**

In `test/bin.test.js`, add a line to `standIn`'s `case`, before `esac`:

```js
"git commit") printf '%s\\n' "$*" >> '${log}.commit' ;;
```

Replace `dryRun` with a general runner and a dry run built on it:

```js
/**
 * Runs the entry point with stand-ins first on PATH.
 * @param {(root: string) => string[]} argv given the temporary root
 */
function runBin(argv) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-bin-"));
    try {
        const bin = join(root, "bin");
        const log = join(root, "log");
        mkdirSync(bin);
        writeFileSync(log, "");
        writeFileSync(`${log}.commit`, "");
        for (const tool of ["gh", "git", "mise", "npm", "node"]) {
            writeFileSync(join(bin, tool), standIn(log));
            chmodSync(join(bin, tool), 0o755);
        }
        const result = spawnSync(process.execPath, [BIN, ...argv(root)], {
            input: "",
            encoding: "utf8",
            env: {
                HOME: root,
                PATH: `${bin}:/usr/bin:/bin`,
                METADATA_APP_PRIVATE_KEY: "not for children",
            },
        });
        const dir = join(root, "x");
        return {
            result,
            lines: readFileSync(log, "utf8").trim().split("\n"),
            commit: readFileSync(`${log}.commit`, "utf8"),
            copied: existsSync(dir),
            pkg: existsSync(join(dir, "package.json"))
                ? JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
                : undefined,
            gitignore: existsSync(join(dir, ".gitignore")),
        };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * A dry run that must succeed.
 * @param {string[]} [extra] more flags
 */
function dryRun(extra = []) {
    const run = runBin((root) => [
        "x",
        "--description",
        "D",
        "--owner",
        "example",
        "--dir",
        join(root, "x"),
        "--no-metadata",
        "--dry-run",
        "--yes",
        ...extra,
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    return run;
}
```

Append:

```js
test("the first commit names the template", () => {
    assert.match(dryRun().commit, /create-repo \S+ \(standard\)\./);
    assert.match(
        dryRun(["--template", "standard"]).commit,
        /\(standard\)\./,
    );
});

test("an unknown template stops before anything is copied", () => {
    const { result, copied } = runBin((root) => [
        "x",
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
        "nope",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown template "nope": choose one of standard/);
    assert.ok(!copied);
});

test("--help lists the templates", () => {
    const { result } = runBin(() => ["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--template <name>/);
    assert.match(result.stdout, /\nTemplates:\n {2}standard {2}Any repository/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/bin.test.js`

Expected: FAIL: the commit body has no `(standard)`, and `--help` has no
`Templates:`.

- [ ] **Step 3: Drive the run from the catalogue**

In `bin/create-repo.js`, import `init` alone from `../lib/init.js` again,
and add:

```js
import { FAMILIES, label, TEMPLATES } from "../lib/templates.js";
```

In `USAGE`, add after the `--scopes` line:

```text
  --template <name>              Default: standard; listed below
  --with <feature,…>             The template's optional features
```

After `USAGE`, add:

```js
/** USAGE, then each template and its features. */
function usage() {
    const names = Object.keys(TEMPLATES);
    const width = Math.max(...names.map((name) => name.length));
    const rows = Object.entries(TEMPLATES).flatMap(([name, template]) => [
        `  ${name.padEnd(width)}  ${template.description}`,
        ...Object.entries(template.features).map(
            ([feature, description]) =>
                `  ${"".padEnd(width)}  --with ${feature}: ${description}`,
        ),
    ]);
    return `${USAGE}\n\nTemplates:\n${rows.join("\n")}`;
}
```

and make `--help` print `usage()` instead of `USAGE`.

After `const { dir } = answers;`, add:

```js
    const template = TEMPLATES[answers.template];
    const family = FAMILIES[template.family];
    const chosen = label(answers.template, answers.features);
```

Then, inside the `try`:

- `step("Copying the template");` and the copy become:

```js
        step(`Copying the ${chosen} template`);
        const files = copyTemplate(
            dir,
            template.layers(new Set(answers.features)),
        );
```

- `await run("npm", ["ci", "--no-fund", "--no-audit"], local);` becomes:

```js
        for (const command of family.setup) {
            await run(command.file, command.args, local);
        }
```

- The `init(...)` call becomes:

```js
        init(dir, answers, files, {
            edits: template.edits,
            features: answers.features,
        });
```

- Both `await run("npm", ["run", "--silent", "format"], local);` and
  `await run("npm", ["run", "check"], local);` become
  `await run(family.format.file, family.format.args, local);` and
  `await run(family.check.file, family.check.args, local);`.
- The commit's second message becomes:

```js
                `Generated by @chewygumxx/create-repo ${VERSION} (${chosen}).`,
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm run typecheck && node --test test/bin.test.js`

Expected: PASS, `# fail 0`, the four existing tests included.

- [ ] **Step 5: Commit**

```sh
npx --no -- biome check --write bin/create-repo.js test/bin.test.js
git add bin/create-repo.js test/bin.test.js
git commit -m "feat: Create from the chosen template"
```

---

### Task 7: Materialise and lint every combination

**Files:**

- Create: `scripts/materialize.js`
- Create: `test/materialize.test.js`
- Modify: `package.json` (`lint:template` becomes `lint:templates`;
  `check`), `.gitignore`, `tsconfig.json`

**Interfaces:**

- Consumes: `copyTemplate` (Task 1); `combinations`, `getTemplate`,
  `checkFeatures` (Task 3); `parseFeatures`, `UsageError` (Task 4).
- Produces, exiting 2 on a `UsageError` and 1 on a `TemplateError`:

```text
node scripts/materialize.js <template> [--with <features>] <dir>
node scripts/materialize.js --all <root>
    each combination in <root>/<template>[+<feature>...]
node scripts/materialize.js --list
    {"include":[{"template":"standard","with":"","name":"standard"},...]}
```

- [ ] **Step 1: Write the failing tests**

Create `test/materialize.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/materialize.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { combinations } from "../lib/templates.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "materialize.js");

/** @param {string[]} args */
const materialize = (args) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

/** @param {(root: string) => void} body */
function inTemp(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-materialize-"));
    try {
        body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("--list is a matrix of every combination", () => {
    const result = materialize(["--list"]);
    assert.equal(result.status, 0, result.stderr);
    const { include } = JSON.parse(result.stdout);
    assert.equal(include.length, combinations().length);
    assert.deepEqual(include[0], {
        template: "standard",
        with: "",
        name: "standard",
    });
});

test("writes one template, as it is before init", () =>
    inTemp((root) => {
        const result = materialize(["standard", join(root, "x")]);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(existsSync(join(root, "x", ".gitignore")));
        assert.ok(existsSync(join(root, "x", ".repo-metadata.jsonc")));
    }));

test("--all writes every combination under its name", () =>
    inTemp((root) => {
        const result = materialize(["--all", join(root, "all")]);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(existsSync(join(root, "all", "standard", "package.json")));
    }));

test("an unknown template is a usage error", () =>
    inTemp((root) => {
        const result = materialize(["nope", join(root, "x")]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Unknown template "nope"/);
    }));

test("materialisations in the root are ignored by git", () => {
    const result = spawnSync(
        "git",
        ["check-ignore", "--quiet", ".templates/standard/package.json"],
        { cwd: ROOT },
    );
    assert.equal(result.status, 0);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/materialize.test.js`

Expected: FAIL; the script does not exist, and `.templates/` is not
ignored.

- [ ] **Step 3: Write `scripts/materialize.js`**

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/scripts/materialize.js
//
//

// @ts-check

// Writes templates as they are before init, for checks of the templates
// themselves:
//
//   node scripts/materialize.js <template> [--with <features>] <dir>
//   node scripts/materialize.js --all <root>
//       every combination, each in <root>/<template>[+<feature>...]
//   node scripts/materialize.js --list
//       every combination, as a GitHub Actions matrix

import { rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseFeatures, UsageError } from "../lib/args.js";
import { copyTemplate, TemplateError } from "../lib/template.js";
import { checkFeatures, combinations, getTemplate } from "../lib/templates.js";

const USAGE =
    "Usage: node scripts/materialize.js <template> [--with <features>] <dir> | --all <root> | --list";

/**
 * @param {string} template
 * @param {string[]} features
 */
const nameOf = (template, features) => [template, ...features].join("+");

/**
 * @param {string} dir
 * @param {string} name
 * @param {string[]} features
 */
function materialize(dir, name, features) {
    const template = getTemplate(name);
    const chosen = checkFeatures(name, template, features);
    copyTemplate(dir, template.layers(new Set(chosen)));
}

/** @param {string[]} argv */
function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                with: { type: "string" },
                all: { type: "string" },
                list: { type: "boolean", default: false },
            },
        });
    } catch (error) {
        throw new UsageError(
            error instanceof Error ? error.message : String(error),
        );
    }
    const { values, positionals } = parsed;
    if (values.list) {
        const include = combinations().map(({ template, features }) => ({
            template,
            with: features.join(","),
            name: nameOf(template, features),
        }));
        console.log(JSON.stringify({ include }));
    } else if (values.all !== undefined) {
        rmSync(values.all, { recursive: true, force: true });
        for (const { template, features } of combinations()) {
            materialize(
                join(values.all, nameOf(template, features)),
                template,
                features,
            );
        }
    } else if (positionals.length === 2) {
        const [template, dir] = positionals;
        materialize(
            dir,
            template,
            values.with === undefined ? [] : parseFeatures(values.with),
        );
    } else {
        throw new UsageError(USAGE);
    }
}

try {
    main(process.argv.slice(2));
} catch (error) {
    if (error instanceof UsageError) {
        console.error(error.message);
        process.exitCode = 2;
    } else if (error instanceof TemplateError) {
        console.error(error.message);
        process.exitCode = 1;
    } else {
        throw error;
    }
}
```

- [ ] **Step 4: Wire it into the checks**

- `.gitignore`: add `/.templates/` after `/.claude/worktrees/`.
- `tsconfig.json`: add `"scripts/*.js"` to `include`.
- `package.json`: replace the `lint:template` script with:

```json
"lint:templates": "node scripts/materialize.js --all .templates && for dir in .templates/*/; do (cd \"$dir\" && biome ci --vcs-use-ignore-file=false .) || exit 1; done",
```

  and in `check`, `npm run lint:template` becomes
  `npm run lint:templates`.

- [ ] **Step 5: Run the tests and the check**

Run: `node --test test/materialize.test.js && npm run lint:templates`

Expected: PASS, and Biome reports `Checked N files` with no errors for
`.templates/standard`.

Run: `npm run check`

Expected: every step passes, `# fail 0`.

- [ ] **Step 6: Commit**

```sh
npx --no -- biome check --write scripts test/materialize.test.js
git add scripts test/materialize.test.js package.json .gitignore \
    tsconfig.json
git commit -m "build: Lint every template combination"
```

---

### Task 8: Dry run every combination in CI

**Files:**

- Modify: `.github/workflows/create-repo.yaml`

**Interfaces:**

- Consumes: `node scripts/materialize.js --list` (Task 7);
  `--template`/`--with` (Tasks 4 to 6).

- [ ] **Step 1: Replace the workflow's comment and `jobs`**

The comment block becomes:

```yaml
# Runs `create-repo --dry-run` on every bundled template and combination of
# its features: copy, install, init, check and commit for real, with
# nothing created on GitHub. Catches a template drifting from lib/init.js
# and from its own checks, though not from its Biome formatting, which the
# run applies before checking; the root `npm run lint:templates` catches
# that. gh is not logged in here, so the dry run reads nothing from GitHub.
# Publish calls it too, so no version is staged whose templates fail their
# own checks.
```

`jobs` becomes:

```yaml
jobs:
    matrix:
        runs-on: ubuntu-latest

        outputs:
            matrix: ${{ steps.list.outputs.matrix }}

        steps:
            - name: Checkout
              uses: actions/checkout@v7
              with:
                  persist-credentials: false

            - name: Setup mise
              uses: jdx/mise-action@v4

            - name: NPM Clean Install
              run: npm ci

            - name: List Templates
              id: list
              run: echo "matrix=$(node scripts/materialize.js --list)" >> "$GITHUB_OUTPUT"

    dry-run:
        needs: matrix
        name: Dry Run (${{ matrix.name }})
        runs-on: ubuntu-latest

        strategy:
            fail-fast: false
            matrix: ${{ fromJSON(needs.matrix.outputs.matrix) }}

        steps:
            - name: Checkout
              uses: actions/checkout@v7
              with:
                  persist-credentials: false

            - name: Setup mise
              uses: jdx/mise-action@v4

            - name: NPM Clean Install
              run: npm ci

            - name: Dry Run
              env:
                  GH_TOKEN: ""
                  TEMPLATE: ${{ matrix.template }}
                  WITH: ${{ matrix.with }}
              run: |
                  git config --global user.name "create-repo dry run"
                  git config --global user.email "create-repo@users.noreply.github.com"
                  node bin/create-repo.js dry-run \
                      --template "$TEMPLATE" \
                      --with "$WITH" \
                      --description 'Dry run of "create-repo": a bundled template, initialised and committed.' \
                      --topics ci \
                      --scopes api \
                      --owner example \
                      --dir "$RUNNER_TEMP/dry-run" \
                      --no-metadata \
                      --dry-run \
                      --yes
                  git -C "$RUNNER_TEMP/dry-run" log --format=%B -1
                  if git -C "$RUNNER_TEMP/dry-run" grep -n \
                      -e repo-tmpl -e repo_tmpl -e is_template \
                      -e 'Using this template'; then
                      echo "::error::template identity remains"
                      exit 1
                  fi
```

- [ ] **Step 2: Lint the workflow**

Run: `npm run lint:yaml && mise exec aqua:rhysd/actionlint@1.7.12 -- actionlint .github/workflows/create-repo.yaml`

Expected: no output from either, exit 0.

- [ ] **Step 3: Rehearse the dry run locally**

Run:

```sh
dir=$(mktemp -d)/dry-run
node bin/create-repo.js dry-run --template standard --with "" \
    --description "Local rehearsal." --owner example --dir "$dir" \
    --no-metadata --dry-run --yes
git -C "$dir" log --format=%B -1
```

Expected: the run ends by printing the GitHub commands it would run, and
the commit body reads `Generated by @chewygumxx/create-repo 2.0.2
(standard).`

- [ ] **Step 4: Commit**

```sh
git add .github/workflows/create-repo.yaml
git commit -m "ci: Dry run every template combination"
```

---

### Task 9: Describe the templates

**Files:**

- Modify: `README.md`, `.claude/CLAUDE.md`

- [ ] **Step 1: Update `.claude/CLAUDE.md`**

Replace its two paragraphs about the template with:

```markdown
`templates/` holds the templates this package copies into every new
repository, as layer directories that `lib/templates.js` composes. Their
`.claude/`, `README.md` and configuration describe those repositories, not
this one.

Leave the templates' `chewygumxx/repo-tmpl` identity in their file headers
and `.repo-metadata.jsonc` as it is: `lib/init.js` finds and rewrites it in
each new repository, and fails if `repo-tmpl` or `repo_tmpl` remains
anywhere. Each layer's `_gitignore` is renamed to `.gitignore` on copy.
```

- [ ] **Step 2: Update `README.md`**

- The first paragraph becomes: "Creates a GitHub repository from one of the
  templates bundled in this package, whose first CI run passes, including
  the repository metadata sync."
- In the second paragraph, "copies the template" becomes "copies the
  chosen template", and "installs its toolchain with mise and its
  dependencies with npm" stays.
- Replace `## The template` and its paragraphs with:

```markdown
## The templates

| Template   | For                                                  |
| ---------- | ---------------------------------------------------- |
| `standard` | Any repository: commit rules, lint and format checks |
|            | CI and Claude Code settings                          |

`--template` chooses one, `standard` by default, and `--with` turns on its
optional features; `--help` lists both. A package version always creates
the same repository, and the first commit names the version and template
that made it.

Each template is an ordered list of layers under `templates/`, declared in
`lib/templates.js`: a later layer's file replaces the same file from an
earlier one. `common` holds what every repository carries, and `npm` the
npm-based checks.

The templates' identity stays `chewygumxx/repo-tmpl`:
`~chewygumxx/repo-tmpl.git` in every file header and the slug in
`.repo-metadata.jsonc` are what `lib/init.js` finds and rewrites for each
new repository. They look stale but are not, so `.gitattributes` keeps the
header sync out of `templates/`. After its edits, init fails if
`repo-tmpl`, or the identifier form `repo_tmpl`, remains anywhere.

A layer stores `.gitignore` as `_gitignore`, since npm drops nested
`.gitignore` files from the package, and it is renamed back on copy. The
last layer's applies to all of them.
```

- In `## Development`, "`npm run lint:template` (the template's own Biome
  rules)" becomes "`npm run lint:templates` (each template's own Biome
  rules, run on every combination materialised under `.templates/`)", and
  "The Create Repo workflow runs `--dry-run` on the template" becomes "The
  Create Repo workflow runs `--dry-run` on every template and combination
  of features". Add a paragraph:

```markdown
`node scripts/materialize.js <template> [--with <features>] <dir>` writes
a template as it is before init. To update an npm layer's lock after
changing its `package.json`, run `npm install --package-lock-only` in the
layer's directory.
```

- In `## Flags`, add `--template standard \` after `my-thing \` in the
  example.

- [ ] **Step 3: Check and commit**

Run: `npm run lint:md && npm run lint:emdash`

Expected: no output, exit 0.

```sh
git add README.md .claude/CLAUDE.md
git commit -m "docs: Describe the template layers"
```

- [ ] **Step 4: Final verification**

Run: `npm run check`

Expected: every step passes, `# fail 0`.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
