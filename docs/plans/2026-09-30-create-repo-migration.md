---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/shared-config.git
  # ::: :/docs/plans/2026-09-30-create-repo-migration.md
  #
  #

ctime: 2026-09-30
title: >-
  Implementation Plan: create-repo Migration
description: ""
tags: []
---

# Implementation Plan: create-repo Migration

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

### Objective

`@chewygumxx/create-repo` moves out of shared-config into its own
repository, `chewygumxx/create-repo`, carrying the contents of
`chewygumxx/repo-tmpl` inside the npm package under `template/`, so one
package version pins the CLI, the template and the edits made to it.

### Architecture

The package copies its bundled `template/` instead of cloning
`repo-tmpl`, and rewrites the copy's identity in-process with `lib/init.js`,
a port of the template's `scripts/init.mjs`. The template keeps its own
identity (`chewygumxx/repo-tmpl`) as a sentinel that init replaces; the
header sync is told to leave `template/` alone. Both histories carry over
through `git filter-repo`.

### Tech Stack

- Node ≥ 24 standard library, `node:test`, JSDoc checked by `tsc`
- `jsonc-parser`, the package's single runtime dependency
- `@biomejs/biome`, `remark`, `prettier`, `yamllint`
- `git filter-repo`, run with `uvx`
- GitHub Actions, `gh`, `mise`, npm trusted publishing

**Spec:** the Decisions section below, extending
[`docs/specs/2026-09-29-create-repo-design.md`](../specs/2026-09-29-create-repo-design.md).

## Decisions

- New repository: `chewygumxx/create-repo`, public.
- History: both carried over. shared-config's `packages/create-repo` lands
  at the root, repo-tmpl's history under `template/`, joined by one merge.
- `--template <owner/name>` is removed. The release is `2.0.0`.
- The metadata App client ID is read from `chewygumxx/create-repo`'s
  `METADATA_APP_CLIENT_ID` variable instead of the template repository's.
- `repo-tmpl` is archived, keeping the README structure 1.x's
  `scripts/init.mjs` edits, and 1.x is deprecated on npm.
- Node 24 is the floor: `engines.node` becomes `">=24"` and the README
  says "Node 24 or later".
- The npm 12 pin (`"npm:npm" = "12"` in `mise.toml`) is dropped, from the
  new repository and from the template: node 24's bundled npm is used.

## Global Constraints

- `engines.node` is `">=24"`; mise pins `node = "24"` and no npm.
- Runtime dependencies: exactly `"jsonc-parser": "^3.3.1"`.
- `package.json` has no `preinstall`, `install` or `postinstall` script:
  `patch-package` and husky run from `prepare`.
- The only template file stored under another name is `.gitignore`, as
  `template/_gitignore`.
- Root files carry headers naming `~chewygumxx/create-repo.git`; template
  files keep `~chewygumxx/repo-tmpl.git`.
- `repository.url` is `git+https://github.com/chewygumxx/create-repo.git`,
  which npm provenance checks against the publishing repository.
- Commits: single-line Conventional Commits; the new repository's scopes are
  `claude` and `template`. No em dashes anywhere; the hooks refuse them.
- Nothing reaches GitHub or npm before Task 8. Every step marked
  **Confirm** needs the maintainer's go-ahead at the time.
- JavaScript follows the existing files: the vim and SPDX header block,
  `// @ts-check`, JSDoc types, four-space indent.

## Review Focus

1. `npm create` runs any install lifecycle script in the published
   `package.json`; repo-tmpl's `postinstall` would fail there. Pinned by the
   pack test in Task 3.
2. npm silently drops files named `.gitignore` or `.npmrc`, and anything
   an ignore rule matches, from a package. Pinned by the pack test in
   Task 3.
3. A template change init does not know about must fail, not leave the
   template's identity behind. Pinned in Task 4's tests and the dry-run
   workflow's identity check in Task 6.
4. The header sync would rewrite template headers to
   `~chewygumxx/create-repo.git ::: :/template/...`, breaking init's
   sentinel. Pinned by the header test in Task 3.
5. Published 1.x still clones repo-tmpl and edits its README. Task 11 keeps
   what 1.x edits and runs 1.x against the result.

---

### Task 1: Import Both Histories

**Files:**

- Create: `~/dev/create-repo/` (a new local repository)

**Interfaces:**

- Produces: `~/dev/create-repo` on `main` with the package at the root,
  the template under `template/`, and no remote.

- [ ] **Step 1: Commit this plan in shared-config and check both sources
      are clean and current**

```sh
git -C ~/dev/shared-config status --short
git -C ~/dev/repo-tmpl fetch && git -C ~/dev/repo-tmpl status -sb
```

Expected: no changes in either, and repo-tmpl's `main` neither ahead of nor
behind `origin/main`.

- [ ] **Step 2: Filter a fresh clone of shared-config**

`git filter-repo` refuses anything but a fresh clone, hence `--no-local`.

```sh
work=$(mktemp -d)
filter_repo() { mise exec aqua:astral-sh/uv@0.12.19 -- uvx git-filter-repo "$@"; }
git clone --no-local ~/dev/shared-config "$work/pkg"
(cd "$work/pkg" && filter_repo \
    --path packages/create-repo/ \
    --path .github/workflows/create-repo.yaml \
    --path docs/specs/2026-09-29-create-repo-design.md \
    --path docs/plans/2026-09-29-create-repo.md \
    --path docs/plans/2026-09-30-create-repo-migration.md \
    --path-rename packages/create-repo/:)
ls -a "$work/pkg"
```

Expected: `.github bin docs lib test LICENSE package.json README.md`.

- [ ] **Step 3: Filter a fresh clone of repo-tmpl into `template/`**

```sh
git clone --no-local ~/dev/repo-tmpl "$work/tmpl"
(cd "$work/tmpl" && filter_repo --to-subdirectory-filter template)
ls -a "$work/tmpl"
```

Expected: `.git template`.

- [ ] **Step 4: Merge them into `~/dev/create-repo`**

```sh
git clone "$work/pkg" ~/dev/create-repo
cd ~/dev/create-repo
git remote remove origin
git fetch "$work/tmpl" main:repo-tmpl
git merge --allow-unrelated-histories --no-edit \
    -m "chore: Import repo-tmpl as template/" repo-tmpl
git branch -D repo-tmpl
rm -rf "$work"
```

- [ ] **Step 5: Verify**

```sh
git log --oneline -- template/scripts/init.mjs | head -3
git log --oneline -- lib/args.js | head -3
git status --short
```

Expected: repo-tmpl commits (`fix: Rewrite file headers in init script`)
and create-repo commits (`feat(create-repo): Parse and validate flags`);
a clean tree.

### Task 2: Root Development Tooling

**Files:**

- Create: `mise.toml`, `biome.json`, `tsconfig.json`, `.commitlintrc.mts`,
  `.editorconfig`, `.gitattributes`, `.gitignore`, `.worktreeinclude`,
  `.husky/commit-msg`, `.husky/pre-commit`, `.github/dependabot.yml`,
  `.github/pull_request_template.md`, `.github/workflows/ci.yaml`,
  `.claude/`, `.repo-metadata.jsonc`, `patches/`, `package-lock.json`
- Modify: `package.json`

**Interfaces:**

- Produces: `npm run check` at the root (typecheck, format, lint, Markdown,
  YAML, `npm test`), and `npm test` running `node --test 'test/*.test.js'`.

- [ ] **Step 1: Copy the template's tooling to the root**

```sh
cd ~/dev/create-repo
cp -r template/{.editorconfig,.gitattributes,.worktreeinclude,.husky,.claude,.repo-metadata.jsonc,biome.json,tsconfig.json,.commitlintrc.mts,mise.toml,patches} .
cp template/.gitignore .gitignore
mkdir -p .github/workflows
cp template/.github/{dependabot.yml,pull_request_template.md} .github/
cp template/.github/workflows/ci.yaml .github/workflows/
```

- [ ] **Step 2: Drop the npm pin from the root `mise.toml`**

Delete the `"npm:npm" = "12"` line and the comment paragraph above it that
begins `npm is pinned ahead of node on purpose`, keeping `node = "24"`.

- [ ] **Step 3: Merge the tooling into `package.json`**

Replace `package.json` with the following. `prepare` runs `patch-package`,
not `postinstall`, because npm runs `postinstall` for everyone who runs
`npm create` and `patch-package` is a devDependency.

```json
{
  "name": "@chewygumxx/create-repo",
  "version": "1.0.1",
  "description": "Creates a repository from chewygumxx/repo-tmpl: npm create @chewygumxx/repo",
  "keywords": ["create", "template", "repository"],
  "license": "GPL-3.0-only",
  "homepage": "https://github.com/chewygumxx/create-repo#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/chewygumxx/create-repo.git"
  },
  "type": "module",
  "bin": {
    "create-repo": "bin/create-repo.js"
  },
  "files": ["bin", "lib"],
  "engines": {
    "node": ">=24"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "dependencies": {
    "jsonc-parser": "^3.3.1"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.14",
    "@chewygumxx/biome-config": "^1.0.0",
    "@chewygumxx/commitlint-config": "^1.0.0",
    "@chewygumxx/remark-preset": "^1.0.0",
    "@chewygumxx/yamllint-config": "^1.0.0",
    "@commitlint/cli": "^21.2.2",
    "@commitlint/cz-commitlint": "^21.2.3",
    "@types/node": "^24.19.0",
    "commitizen": "^4.3.2",
    "husky": "^9.1.7",
    "patch-package": "^8.0.1",
    "prettier": "^3.9.9",
    "remark-cli": "^12.0.1",
    "typescript": "^7.0.2"
  },
  "scripts": {
    "check": "npm run typecheck && npm run format:check && npm run lint && npm run lint:md && npm run lint:yaml && npm test",
    "commit": "cz",
    "format": "biome format --write . && npm run format:yaml",
    "format:check": "biome format .",
    "format:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --write --log-level warn",
    "lint": "biome lint .",
    "lint:md": "git ls-files -z '*.md' | xargs -0 -r remark --frail --quiet --no-stdout",
    "lint:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --check && git ls-files -z '*.yaml' '*.yml' | YAMLLINT_CONFIG_FILE=node_modules/@chewygumxx/yamllint-config/config.yaml xargs -0 -r yamllint --strict",
    "prepare": "patch-package >/dev/null && (test -d node_modules/husky && husky || true)",
    "test": "node --test 'test/*.test.js'",
    "typecheck": "tsc"
  },
  "config": {
    "commitizen": {
      "path": "@commitlint/cz-commitlint"
    }
  },
  "remarkConfig": {
    "plugins": ["@chewygumxx/remark-preset"]
  }
}
```

- [ ] **Step 4: Point `tsconfig.json` at the package's code**

Set `include` to:

```json
    "include": [".commitlintrc.mts", "bin/*.js", "lib/*.js", "test/*.js"]
```

- [ ] **Step 5: Keep Biome and the header sync out of `template/`**

The template's `biome.json` is a root configuration of its own; its files
are checked by the generated repository's `npm run check` in the dry-run
workflow. Replace `biome.json` with:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
  "extends": ["@chewygumxx/biome-config"],
  "files": {
    "includes": ["**", "!!**/template"]
  }
}
```

Append to `.gitattributes`:

```gitattributes

# The bundled template's headers name the template itself, a sentinel that
# lib/init.js rewrites for each new repository; the header sync must leave
# them alone.
/template/** -sync-header-metadata
```

- [ ] **Step 6: Set the repository's identity and scopes**

In `.repo-metadata.jsonc`, set `"name": "create-repo"`,
`"slug": "chewygumxx/create-repo"`,
`"description": "Creates a GitHub repository from a bundled template: npm create @chewygumxx/repo"`,
`"topics": ["create", "template", "repository"]`, and delete the
`"is_template": true,` line.

In `.commitlintrc.mts`, add after the `claude` scope:

```ts
        {
            name: "template",
            fullName: "Template",
            description: "The bundled template under template/",
        },
```

Append to `.claude/CLAUDE.md`:

```markdown
`template/` is the template this package copies into every new repository.
Its `.claude/`, `README.md` and configuration describe those repositories,
not this one.
```

- [ ] **Step 7: Keep the template's dependencies and actions current**

Append to `.github/dependabot.yml`'s `updates`:

```yaml
- package-ecosystem: npm
  directory: /template
  schedule:
    interval: weekly
  commit-message:
    prefix: build(template)

- package-ecosystem: github-actions
  directory: /template
  schedule:
    interval: weekly
  commit-message:
    prefix: ci(template)
```

- [ ] **Step 8: Install, rewrite headers, verify**

```sh
mise trust --quiet && mise install
npm install --no-fund --no-audit
git add --all
npx --yes --allow-git=all github:chewygumxx/sync-header-metadata#v2 \
    --mode update --repo chewygumxx/create-repo
git add --all
git check-attr sync-header-metadata template/mise.toml mise.toml
git grep -n -e '~chewygumxx/shared-config.git' -e '~chewygumxx/repo-tmpl.git' -- ':!:template'
npx biome format template/biome.json
npm run check
```

Expected: `template/mise.toml: sync-header-metadata: unset` and
`mise.toml: ... unspecified`; `git grep` prints nothing; Biome reports the
template file ignored or no files processed, with no nested-configuration
error; `npm run check` passes, the existing tests included. If Biome
still reads `template/`, use `"!!template"` in Step 5 and repeat.

- [ ] **Step 9: Commit**

```sh
git commit -m "build: Add development tooling from the template"
```

### Task 3: Bundle the Template

**Files:**

- Create: `lib/template.js`, `test/template.test.js`, `test/pack.test.js`
- Rename: `template/.gitignore` to `template/_gitignore`
- Modify: `package.json` (`files`)

**Interfaces:**

- Produces, from `lib/template.js`:
  - `TEMPLATE_DIR: string`, the absolute path of `template/`
  - `RENAMED: Record<string, string>`, stored name to real name
  - `VERSION: string`, this package's version
  - `class TemplateError extends Error`
  - `listFiles(dir: string): string[]`, sorted paths relative to `dir`
  - `copyTemplate(dir: string, from?: string): string[]`, the copy's files
    relative to `dir` with renames applied; throws `TemplateError` when
    `dir` exists

- [ ] **Step 1: Write the failing tests**

`test/template.test.js`:

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
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import {
  copyTemplate,
  listFiles,
  RENAMED,
  TEMPLATE_DIR,
  TemplateError,
} from "../lib/template.js";

/** @param {(root: string) => void} body */
function inTemp(body) {
  const root = mkdtempSync(join(tmpdir(), "create-repo-template-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("copies every file, restoring .gitignore", () =>
  inTemp((root) => {
    const files = copyTemplate(join(root, "x"));
    assert.ok(files.includes(".gitignore"));
    assert.ok(!files.includes("_gitignore"));
    assert.equal(files.length, listFiles(TEMPLATE_DIR).length);
    assert.equal(
      readFileSync(join(root, "x", ".gitignore"), "utf8"),
      readFileSync(join(TEMPLATE_DIR, "_gitignore"), "utf8"),
    );
  }));

test("refuses a directory that exists", () =>
  inTemp((root) => {
    mkdirSync(join(root, "x"));
    assert.throws(
      () => copyTemplate(join(root, "x")),
      (error) =>
        error instanceof TemplateError && /already exists/.test(error.message),
    );
  }));

// The header sync would rewrite these to name create-repo and template/,
// and init would then find no header to rewrite.
test("every template header names the template and its own path", () => {
  const slug = parse(
    readFileSync(join(TEMPLATE_DIR, ".repo-metadata.jsonc"), "utf8"),
  ).slug;
  const stray = listFiles(TEMPLATE_DIR).filter((file) => {
    const text = readFileSync(join(TEMPLATE_DIR, file), "utf8");
    const path = RENAMED[file] ?? file;
    return (
      text.includes("::: :/") &&
      !(text.includes(`~${slug}.git`) && text.includes(`::: :/${path}`))
    );
  });
  assert.deepEqual(stray, []);
});
```

`test/pack.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/pack.test.js
//
//

// @ts-check

// What npm publishes: it drops files named .gitignore or .npmrc and anything
// an ignore rule matches, and `npm create` runs install scripts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { listFiles, TEMPLATE_DIR } from "../lib/template.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The paths `npm pack` would publish. */
function packed() {
  const result = spawnSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  // npm 11 prints an array, npm 12 an object keyed by package name.
  const parsed = JSON.parse(result.stdout);
  const [pack] = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return new Set(
    pack.files.map((/** @type {{ path: string }} */ file) => file.path),
  );
}

test("the package carries every template file", () => {
  const files = packed();
  assert.deepEqual(
    listFiles(TEMPLATE_DIR)
      .map((file) => `template/${file}`)
      .filter((file) => !files.has(file)),
    [],
  );
});

test("installing the package runs none of its scripts", () => {
  const { scripts = {} } = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  );
  assert.deepEqual(
    ["preinstall", "install", "postinstall"].filter((name) => name in scripts),
    [],
  );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../lib/template.js'`.

- [ ] **Step 3: Implement `lib/template.js`**

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/template.js
//
//

// @ts-check

// The bundled template, template/ in this package. npm drops any file named
// .gitignore from a package, so the template stores it as _gitignore and
// copyTemplate() renames it back.

import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATE_DIR = fileURLToPath(
  new URL("../template", import.meta.url),
);

/** @type {Record<string, string>} Stored name to real name. */
export const RENAMED = { _gitignore: ".gitignore" };

/** @type {string} This package's version, recorded in the first commit. */
export const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

/** The template and the edits init makes to it disagree. */
export class TemplateError extends Error {}

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
 * Copies the template into `dir`, which must not exist.
 * @param {string} dir
 * @param {string} [from]
 * @returns {string[]} the copy's files, relative to `dir`
 */
export function copyTemplate(dir, from = TEMPLATE_DIR) {
  if (existsSync(dir)) throw new TemplateError(`${dir} already exists.`);
  cpSync(from, dir, { recursive: true });
  for (const [stored, name] of Object.entries(RENAMED)) {
    renameSync(join(dir, stored), join(dir, name));
  }
  return listFiles(dir);
}
```

- [ ] **Step 4: Rename the template's `.gitignore` and run the tests**

```sh
git mv template/.gitignore template/_gitignore
npm test
```

Expected: `template.test.js` passes; `pack.test.js` fails
`the package carries every template file`, listing every template path.

- [ ] **Step 5: Publish the template**

In `package.json`, set `"files": ["bin", "lib", "template"]`.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
npm run check
git add lib/template.js test/template.test.js test/pack.test.js package.json template
git commit -m "feat: Bundle the template in the package"
```

### Task 4: Port init into the Package

**Files:**

- Create: `lib/init.js`, `test/init.test.js`
- Delete: `template/scripts/init.mjs`, `template/scripts/test-init.sh`,
  `template/.github/workflows/template.yaml`
- Modify: `template/package.json`, `template/package-lock.json`,
  `template/tsconfig.json`, `template/README.md`, `template/mise.toml`

**Interfaces:**

- Consumes: `TemplateError`, `copyTemplate`, `TEMPLATE_DIR` from Task 3;
  `Scope` from `lib/args.js` (`{ name: string, fullName: string }`).
- Produces: `init(dir: string, identity: Identity, files: string[],
options?: { today?: string }): void`, where `Identity` is
  `{ owner, name, description: string, topics: string[], scopes: Scope[] }`.
  `Answers` from `lib/prompt.js` satisfies `Identity`. Throws
  `TemplateError` when a target is missing. Does not format.

- [ ] **Step 1: Write the failing tests**

`test/init.test.js` carries over every assertion of
`template/scripts/test-init.sh`, without npm or git:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/init.test.js
//
//

// @ts-check

// The description has quotes, a colon, a bare URL and more than 80
// characters, so the README frontmatter's folded scalar, the body's links and
// its wrapping are exercised.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import { init } from "../lib/init.js";
import { copyTemplate, TEMPLATE_DIR, TemplateError } from "../lib/template.js";

const IDENTITY = {
  owner: "example",
  name: "derived-repo",
  description:
    'Tests "init": a description with quotes, a colon, a link to https://example.com/docs, and enough words to wrap past eighty columns.',
  topics: ["alpha", "beta"],
  scopes: [
    { name: "api", fullName: "Api" },
    { name: "cli", fullName: "Command Line" },
  ],
};

/**
 * @param {string} dir
 * @param {string} file
 */
const read = (dir, file) => readFileSync(join(dir, file), "utf8");

/**
 * Copies the template, lets `before` change the copy, initialises it, and
 * hands it to `body`.
 * @param {(dir: string, files: string[]) => void} body
 * @param {Partial<typeof IDENTITY>} [changes]
 * @param {(dir: string) => void} [before]
 */
function initialised(body, changes = {}, before = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
  try {
    const dir = join(root, "derived");
    const files = copyTemplate(dir);
    before(dir);
    init(dir, { ...IDENTITY, ...changes }, files, { today: "2026-10-01" });
    body(dir, files);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("no template identity remains", () =>
  initialised((dir, files) => {
    assert.deepEqual(
      files.filter((file) =>
        /repo-tmpl|is_template|Using this template/.test(read(dir, file)),
      ),
      [],
    );
  }));

// CI's header sync cannot push changes to workflow files.
test("headers name the new repository, workflows included", () =>
  initialised((dir) => {
    assert.match(
      read(dir, ".github/workflows/ci.yaml"),
      /~example\/derived-repo\.git/,
    );
  }));

test("metadata, package and lockfile carry the identity", () =>
  initialised((dir) => {
    const metadata = parse(read(dir, ".repo-metadata.jsonc"));
    assert.equal(metadata.slug, "example/derived-repo");
    assert.deepEqual(metadata.topics, ["alpha", "beta"]);
    assert.ok(!("is_template" in metadata));
    const pkg = JSON.parse(read(dir, "package.json"));
    assert.equal(pkg.name, "derived-repo");
    assert.equal(pkg.repository, "github:example/derived-repo");
    assert.equal(pkg.homepage, "https://github.com/example/derived-repo");
    assert.deepEqual(pkg.keywords, ["alpha", "beta"]);
    const lock = JSON.parse(read(dir, "package-lock.json"));
    assert.equal(lock.name, "derived-repo");
    assert.equal(lock.packages[""].name, "derived-repo");
  }));

test("README frontmatter, heading and body", () =>
  initialised((dir) => {
    const readme = read(dir, "README.md");
    assert.match(readme, /^ctime: 2026-10-01$/m);
    assert.match(readme, /^description: >-$/m);
    assert.match(readme, /^tags:\n {2}- alpha\n {2}- beta\n/m);
    assert.match(readme, /^# derived-repo$/m);
    assert.match(readme, /<https:\/\/example\.com\/docs>/);
  }));

test("scopes are added after the template's own", () =>
  initialised((dir) => {
    const config = read(dir, ".commitlintrc.mts");
    assert.match(config, /name: "claude"/);
    assert.match(config, /fullName: "Command Line"/);
  }));

test("no topics leaves empty tags; no scopes leaves commitlint alone", () =>
  initialised(
    (dir) => {
      assert.match(read(dir, "README.md"), /^tags: \[\]$/m);
      assert.equal(
        read(dir, ".commitlintrc.mts"),
        read(TEMPLATE_DIR, ".commitlintrc.mts").replaceAll(
          "~chewygumxx/repo-tmpl.git",
          "~example/derived-repo.git",
        ),
      );
    },
    { topics: [], scopes: [] },
  ));

test("a template change init does not know about fails", () => {
  assert.throws(
    () =>
      initialised(
        () => {},
        {},
        (dir) =>
          writeFileSync(
            join(dir, "README.md"),
            read(dir, "README.md").replace(/^ctime: .*\n/m, ""),
          ),
      ),
    (error) =>
      error instanceof TemplateError && /ctime not found/.test(error.message),
  );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../lib/init.js'`.

- [ ] **Step 3: Implement `lib/init.js`**

A port of `template/scripts/init.mjs`: the same edits and error messages,
working under `dir` instead of the current directory, throwing instead of
exiting, and without validating (the answers are validated already),
uninstalling `jsonc-parser`, formatting or deleting anything.

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/init.js
//
//

// @ts-check

// Turns a fresh copy of the template into a new repository by rewriting the
// identity in the files that carry it. The caller formats the copy after.
//
// Every edit fails when its target is missing, so a template change this
// module does not know about fails its tests rather than being skipped.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";
import { TemplateError } from "./template.js";

/** @typedef {import("./args.js").Scope} Scope */

/**
 * @typedef {object} Identity
 * @property {string} owner
 * @property {string} name
 * @property {string} description
 * @property {string[]} topics
 * @property {Scope[]} scopes
 */

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new TemplateError(`init: ${message}`);
}

/**
 * Replaces the first match of `pattern`, failing when there is none.
 * @param {string} text
 * @param {RegExp} pattern
 * @param {(...groups: string[]) => string} replacement
 * @param {string} what names the target in the error
 */
function replace(text, pattern, replacement, what) {
  if (!pattern.test(text)) fail(`${what} not found`);
  return text.replace(pattern, replacement);
}

/**
 * @param {string} path
 * @param {(text: string) => string} change
 */
function editText(path, change) {
  writeFileSync(path, change(readFileSync(path, "utf8")));
}

/**
 * Rewrites a JSON file, keeping its indentation.
 * @param {string} path
 * @param {(data: any) => void} change
 */
function editJson(path, change) {
  const text = readFileSync(path, "utf8");
  const indent = /^[ \t]+/m.exec(text)?.[0] ?? "    ";
  const data = JSON.parse(text);
  change(data);
  writeFileSync(path, `${JSON.stringify(data, null, indent)}\n`);
}

/**
 * Sets top-level keys of a JSONC file with jsonc-parser, keeping its
 * comments and layout. A value of `undefined` removes the key.
 * @param {string} path
 * @param {string} name names the file in errors
 * @param {[string, unknown][]} changes
 */
function editJsonc(path, name, changes) {
  let text = readFileSync(path, "utf8");
  /** @type {import("jsonc-parser").ParseError[]} */
  const errors = [];
  const data = parse(text, errors);
  if (errors.length) {
    fail(
      `${name}: ${errors.map((e) => printParseErrorCode(e.error)).join(", ")}`,
    );
  }
  for (const [key, value] of changes) {
    if (!(key in data)) fail(`"${key}" in ${name} not found`);
    const edits = modify(text, [key], value, {
      formattingOptions: { insertSpaces: true, tabSize: 4 },
    });
    text = applyEdits(text, edits);
  }
  writeFileSync(path, text);
}

/**
 * Requires top-level keys in parsed JSON.
 * @param {Record<string, unknown>} data
 * @param {string[]} keys
 * @param {string} name
 */
function requireKeys(data, keys, name) {
  for (const key of keys) {
    if (!(key in data)) fail(`"${key}" in ${name} not found`);
  }
}

/**
 * Wraps prose at `width` columns.
 * @param {string} text
 * @param {number} [width]
 */
function wrap(text, width = 80) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/**
 * Turns bare URLs into links remark accepts, leaving trailing punctuation
 * outside: `<https://…>`, and `[www.…](https://www.…)` since an autolink
 * needs a scheme.
 * @param {string} text
 */
function linkUrls(text) {
  return text.replace(
    /\b(https?:\/\/|www\.)[^\s<>]*[^\s<>.,;:!?'")\]]/g,
    (url, start) =>
      start === "www." ? `[${url}](https://${url})` : `<${url}>`,
  );
}

/**
 * A YAML frontmatter entry: a quoted scalar when it fits in 80 columns,
 * otherwise a `>-` folded scalar wrapped under a two-space indent.
 * @param {string} key
 * @param {string} value
 */
function yamlEntry(key, value) {
  const line = `${key}: ${JSON.stringify(value)}`;
  if (line.length <= 80) return line;
  return `${key}: >-\n${wrap(value, 78).replace(/^/gm, "  ")}`;
}

/**
 * @param {string} dir the copy
 * @param {Identity} identity
 * @param {string[]} files the copy's files, relative to `dir`
 * @param {{ today?: string }} [options] `today` as YYYY-MM-DD
 */
export function init(
  dir,
  { owner, name, description, topics, scopes },
  files,
  { today = new Date().toISOString().slice(0, 10) } = {},
) {
  const slug = `${owner}/${name}`;
  const at = (/** @type {string} */ file) => join(dir, file);

  // File headers name the repository as `~owner/name.git`. CI's header
  // sync would correct them, but its token may not push changes to
  // workflow files, so they are rewritten here.
  const template = parse(
    readFileSync(at(".repo-metadata.jsonc"), "utf8"),
  )?.slug;
  if (typeof template !== "string") {
    fail(`"slug" in .repo-metadata.jsonc not found`);
  }
  let headers = 0;
  for (const file of files) {
    const text = readFileSync(at(file), "utf8");
    if (!text.includes(`~${template}.git`)) continue;
    writeFileSync(
      at(file),
      text.replaceAll(`~${template}.git`, `~${slug}.git`),
    );
    headers += 1;
  }
  if (headers === 0) fail(`no file header naming ~${template}.git found`);

  editJsonc(at(".repo-metadata.jsonc"), ".repo-metadata.jsonc", [
    ["name", name],
    ["owner", owner],
    ["slug", slug],
    ["description", description],
    ["topics", topics],
    ["is_template", undefined],
  ]);

  editJson(at("package.json"), (data) => {
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

  editJson(at("package-lock.json"), (data) => {
    requireKeys(data, ["name", "packages"], "package-lock.json");
    requireKeys(data.packages, [""], "package-lock.json packages");
    data.name = name;
    data.packages[""].name = name;
  });

  editText(at("README.md"), (text) => {
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

  if (scopes.length) {
    editText(at(".commitlintrc.mts"), (text) =>
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
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, the existing tests included.

- [ ] **Step 5: Commit**

```sh
git add lib/init.js test/init.test.js
git commit -m "feat: Port the template's init script into the package"
```

- [ ] **Step 6: Remove the template's own init and its test**

```sh
git rm -q template/scripts/init.mjs template/scripts/test-init.sh \
    template/.github/workflows/template.yaml
(cd template && npm uninstall jsonc-parser --package-lock-only --no-fund --no-audit)
```

In `template/tsconfig.json`, set `"include": [".commitlintrc.mts"]`.

Run: `npm test && git status --short template`
Expected: PASS; `template/node_modules` does not exist; `package.json` and
`package-lock.json` no longer name `jsonc-parser`.

```sh
git add template
git commit -m "refactor(template): Drop init script now in the package"
```

- [ ] **Step 7: Point the template's README at the package**

In `template/README.md`, replace the body of `## Using this template`
(everything up to `## CI`, the heading kept, since init removes the section
by it) with:

````markdown
## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
npm create @chewygumxx/repo my-thing
```
````

Run: `npm test && npm run lint:md`
Expected: PASS.

```sh
git add template/README.md
git commit -m "docs(template): Point to create-repo"
```

- [ ] **Step 8: Drop the template's npm pin**

In `template/mise.toml`, delete the `"npm:npm" = "12"` line and the
comment paragraph beginning `npm is pinned ahead of node on purpose`.

Run: `npm test`
Expected: PASS.

```sh
git add template/mise.toml
git commit -m "build(template): Use the npm bundled with node"
```

### Task 5: Create from the Bundled Template

**Files:**

- Modify: `bin/create-repo.js`, `lib/args.js`, `lib/prompt.js`,
  `lib/preflight.js`, `package.json`
- Test: `test/args.test.js`, `test/prompt.test.js`,
  `test/preflight.test.js`, `test/bin.test.js`

**Interfaces:**

- Consumes: `copyTemplate`, `TemplateError`, `VERSION` (Task 3); `init`
  (Task 4).
- Produces: `METADATA_REPO = "chewygumxx/create-repo"` exported from
  `lib/preflight.js`. `Options` and `Answers` lose `template`;
  `DEFAULT_TEMPLATE` is gone.

- [ ] **Step 1: Change the tests first**

`test/args.test.js`: remove `DEFAULT_TEMPLATE` from the import; remove
`"--template", "someone/tmpl",` from the argv and `template: "someone/tmpl",`
from the expected object in `reads the name and every flag`; remove
`assert.equal(options.template, DEFAULT_TEMPLATE);` from
`defaults leave prompted values undefined`; remove the
`["--template", "no-slash"],` entry from
`rejects mistakes before anything is created`. Add:

```js
test("--template is no longer accepted", () => {
  assert.throws(() => parseOptions(["--template", "a/b"]), UsageError);
});
```

`test/prompt.test.js`: remove `template: "chewygumxx/repo-tmpl",` at
line 57.

`test/preflight.test.js`: import `METADATA_REPO` alongside `checkTarget`
and `checkTools`; make the client ID fixture key
`` `gh variable get METADATA_APP_CLIENT_ID --repo ${METADATA_REPO}` ``;
rename `the client ID comes from the template's variable` to
`the client ID comes from create-repo's variable` and add, inside it:

```js
assert.equal(METADATA_REPO, "chewygumxx/create-repo");
```

`test/bin.test.js`: in `standIn`, delete the `"git clone")` case (three
lines) and the sentence `` `git clone` creates its target, `` from its doc
comment. Make `dryRun` return what the copy became before it is removed:

```js
assert.equal(result.status, 0, result.stderr);
const dir = join(root, "x");
return {
  lines: readFileSync(log, "utf8").trim().split("\n"),
  pkg: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")),
  gitignore: existsSync(join(dir, ".gitignore")),
};
```

add `existsSync` to its `node:fs` import, change both existing tests to
`const { lines } = dryRun();`, and add:

```js
test("the copy is the bundled template, initialised", () => {
  const { lines, pkg, gitignore } = dryRun();
  assert.ok(!lines.some((line) => line.startsWith("git clone")));
  assert.equal(pkg.name, "x");
  assert.equal(pkg.repository, "github:example/x");
  assert.ok(gitignore);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: FAIL: `--template is no longer accepted`, the preflight client ID
test (it still reads `chewygumxx/repo-tmpl`), and the bin tests (`git
clone` is a stand-in that copies nothing).

- [ ] **Step 3: Remove `--template` from `lib/args.js`**

Delete the `@property {string} template` line, `DEFAULT_TEMPLATE`,
`checkTemplate`, the `template:` entry in `parseArgs` options and the
`template: checkTemplate(values.template),` line. Replace
`// Keep in step with repo-tmpl's scripts/init.mjs.` with
`// GitHub's rules for names, owners and topics; commitlint's for scopes.`

- [ ] **Step 4: Remove `template` from `lib/prompt.js`**

Delete `@property {string} template` from `Answers`,
`template: options.template,` from `completeAnswers`, and the
`["Template", answers.template],` row from `summary`.

- [ ] **Step 5: Read the client ID from create-repo in `lib/preflight.js`**

Below the typedefs add:

```js
/** Its METADATA_APP_CLIENT_ID variable is copied to new repositories. */
export const METADATA_REPO = "chewygumxx/create-repo";
```

and replace both `options.template` with `METADATA_REPO`.

- [ ] **Step 6: Copy and initialise in `bin/create-repo.js`**

Imports: drop `rmSync` and the `node:path` import, and add

```js
import { init } from "../lib/init.js";
import { checkTarget, checkTools, METADATA_REPO } from "../lib/preflight.js";
import { copyTemplate, TemplateError, VERSION } from "../lib/template.js";
```

(replacing the existing `preflight.js` import). Change the top comment's
first line to
``// `npm create @chewygumxx/repo`: copies the bundled template, rewrites its``
`// identity, checks and commits locally, and only then creates the GitHub`,
remove the `--template` line from `USAGE`, and change
`const { dir, template } = answers;` to `const { dir } = answers;`.

Replace the `try` block's body up to `step("Installing …")` with:

```js
step("Copying the template");
const files = copyTemplate(dir);
await run("git", ["init", "--quiet", "--initial-branch", "main"], local);
```

replace the `step("Initialising")` call through the end of its `run(...)`
with:

```js
step("Initialising");
init(dir, answers, files);
await run("npm", ["run", "--silent", "format"], local);
```

and change the commit's second message to
`` `Generated by @chewygumxx/create-repo ${VERSION}.` ``.

Change the client ID fallback to
``const id = clientId ?? `<METADATA_APP_CLIENT_ID of ${METADATA_REPO}>`;``
and in the final error handler change
`} else if (error instanceof CommandError) {` to
`} else if (error instanceof CommandError || error instanceof TemplateError) {`.

- [ ] **Step 7: Run the tests**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```sh
git add bin lib test
git commit -m "feat!: Create from the bundled template, not repo-tmpl"
```

- [ ] **Step 9: Version 2.0.0**

In `package.json`, set `"version": "2.0.0"` and
`"description": "Creates a GitHub repository from a bundled template: npm create @chewygumxx/repo"`.

```sh
npm install --package-lock-only --no-fund --no-audit
npm run check
git add package.json package-lock.json
git commit -m "chore: Version 2.0.0"
```

### Task 6: Workflows and a Local Dry Run

**Files:**

- Modify: `.github/workflows/create-repo.yaml`
- Create: `.github/workflows/publish.yaml`

- [ ] **Step 1: Dry run the bundled template in CI**

In `.github/workflows/create-repo.yaml`, replace the leading comment with:

```yaml
# Runs `create-repo --dry-run` on the bundled template: copy, install, init,
# check and commit for real, with nothing created on GitHub. Catches the
# template drifting from lib/init.js and from its own checks. gh is not
# logged in here, so the dry run reads nothing from GitHub.
```

After `Setup mise`, add:

```yaml
- name: NPM Clean Install
  run: npm ci
```

In `Dry Run`, change `node packages/create-repo/bin/create-repo.js` to
`node bin/create-repo.js` and append:

```yaml
if git -C "$RUNNER_TEMP/dry-run" grep -n \
-e repo-tmpl -e is_template -e 'Using this template'; then
echo "::error::template identity remains"
exit 1
fi
```

- [ ] **Step 2: Publish on `v*` tags**

`.github/workflows/publish.yaml`:

```yaml
# vim:set expandtab shiftwidth=4 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/create-repo.git
# ::: :/.github/workflows/publish.yaml
#
#

# Stages the package for a `v<version>` tag, e.g. `v2.0.0`, if package.json
# has that version. A staged version is not installable until it is approved
# on npmjs.com with the maintainer's 2FA, so this workflow alone can never
# release it.
#
# Authentication is npm trusted publishing: npm exchanges this job's OIDC
# token for a short-lived credential, so no NPM_TOKEN secret exists. The
# package's npm Settings > Trusted Publisher must name this repository and
# workflow with the stage publish permission.

name: Publish

on:
  push:
    tags:
      - "v*"

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  check:
    uses: chewygumxx/.github/.github/workflows/lint.yaml@v1

  publish:
    needs: check
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Setup Node and NPM
        uses: jdx/mise-action@v4

      - name: NPM Clean Install
        run: npm ci

      - name: Check Version
        env:
          TAG: ${{ github.ref_name }}
        run: |
          actual=$(node -p "require('./package.json').version")
          test "v$actual" = "$TAG" || { echo "::error::package.json is $actual, tag says $TAG"; exit 1; }

      - name: Publish
        run: npm stage publish
```

- [ ] **Step 3: Run the dry run locally, as CI does**

```sh
out=$(mktemp -d)
GH_TOKEN= node bin/create-repo.js dry-run \
    --description 'Dry run of "create-repo": the bundled template, initialised and committed.' \
    --topics ci --scopes api --owner example \
    --dir "$out/dry-run" --no-metadata --dry-run --yes
git -C "$out/dry-run" log --format=%B -1
git -C "$out/dry-run" grep -n -e repo-tmpl -e is_template -e 'Using this template'
grep -c 'npm:npm' "$out/dry-run/mise.toml"
```

Expected: the dry run ends printing `gh repo create example/dry-run ...`;
the commit body reads `Generated by @chewygumxx/create-repo 2.0.0.`;
`git grep` prints nothing; `grep -c` prints `0`, no npm pin. Then
`rm -rf "$out"`.

- [ ] **Step 4: Commit**

```sh
npm run check
git add .github/workflows
git commit -m "ci: Dry run the bundled template and publish on v tags"
```

- [ ] **Step 5: Package README**

In `README.md`: the first paragraph becomes "Creates a GitHub repository
from the template bundled in this package, whose first CI run passes,
including the repository metadata sync."; the second paragraph's "copies
the template, ... runs the template's `scripts/init.mjs`, and commits"
becomes "copies the template, installs its toolchain with mise and its
dependencies with npm, rewrites its identity, and commits"; "It needs Node
22 or later" becomes "It needs Node 24 or later"; in "The
metadata App private key", "read from the template repository's variable"
becomes "read from the `chewygumxx/create-repo` repository's variable".
Add before `## Flags`:

```markdown
## The template

`template/` is the whole template. A package version always creates the
same repository, and the first commit names the version that made it.
```

Run: `npm run lint:md`
Expected: PASS.

```sh
git add README.md
git commit -m "docs: Describe the bundled template"
```

### Task 7: Whole-Branch Review

- [ ] **Step 1:** Run `npm run check` and `npm pack --dry-run` in
      `~/dev/create-repo`; confirm `template/_gitignore` and
      `template/package-lock.json` are listed and nothing under
      `node_modules`, `test` or `docs` is.
- [ ] **Step 2:** Dispatch the whole-branch review
      (superpowers:requesting-code-review) against the Decisions, Global
      Constraints and Review Focus above, and address its findings before
      anything is pushed.

### Task 8: Create `chewygumxx/create-repo` (Confirm)

- [ ] **Step 1: Create the repository without pushing**

```sh
cd ~/dev/create-repo
gh repo create chewygumxx/create-repo --public \
    --description "Creates a GitHub repository from a bundled template: npm create @chewygumxx/repo" \
    --source . --remote origin
```

- [ ] **Step 2: Copy the metadata App's variable and secret**

```sh
gh variable set METADATA_APP_CLIENT_ID --repo chewygumxx/create-repo \
    --body "$(gh variable get METADATA_APP_CLIENT_ID --repo chewygumxx/repo-tmpl)"
eval "$(grep '^CREATE_REPO_METADATA_KEY_COMMAND=' ~/.config/chewygumxx/create-repo.env)"
sh -c "$CREATE_REPO_METADATA_KEY_COMMAND" |
    gh secret set METADATA_APP_PRIVATE_KEY --repo chewygumxx/create-repo
```

- [ ] **Step 3: Push and watch CI**

```sh
git push -u origin main
gh run watch --repo chewygumxx/create-repo --exit-status
```

Expected: CI and Create Repo pass. The first push lints only the tip
commit, so the imported history is not linted. If the metadata sync fails
for want of an installation, add the repository to the metadata App's
installation on GitHub and re-run with `gh workflow run CI`.

### Task 9: Release 2.0.0 (Confirm)

- [ ] **Step 1: Move trusted publishing (maintainer, npmjs.com, 2FA)**

In `@chewygumxx/create-repo`'s npm Settings > Trusted Publisher, replace
`chewygumxx/shared-config` / `publish.yaml` with `chewygumxx/create-repo` /
`publish.yaml`, with the stage publish permission.

- [ ] **Step 2: Tag and stage**

```sh
git tag v2.0.0 && git push origin v2.0.0
gh run watch --repo chewygumxx/create-repo --exit-status
```

Then approve the staged version on npmjs.com (maintainer, 2FA).

- [ ] **Step 3: Verify the published package**

```sh
npm view @chewygumxx/create-repo@2.0.0 repository.url dependencies
cd "$(mktemp -d)"
npm create @chewygumxx/repo@2.0.0 -- smoke \
    --description "Smoke test of create-repo 2.0.0." \
    --owner chewygumxx --no-metadata --dry-run --yes
git -C smoke log --format=%B -1
```

Expected: `git+https://github.com/chewygumxx/create-repo.git` and
`{ 'jsonc-parser': '^3.3.1' }`; the dry run completes; the body reads
`Generated by @chewygumxx/create-repo 2.0.0.`

### Task 10: Remove create-repo from shared-config (Confirm before push)

**Files:**

- Delete: `packages/create-repo/`, `.github/workflows/create-repo.yaml`,
  `docs/specs/2026-09-29-create-repo-design.md`,
  `docs/plans/2026-09-29-create-repo.md`,
  `docs/plans/2026-09-30-create-repo-migration.md`
- Modify: `package.json`, `package-lock.json`, `tsconfig.json`,
  `.commitlintrc.mts`, `README.md`

- [ ] **Step 1: Remove the package and its workflow and docs**

```sh
cd ~/dev/shared-config
git rm -rq packages/create-repo .github/workflows/create-repo.yaml \
    docs/specs/2026-09-29-create-repo-design.md \
    docs/plans/2026-09-29-create-repo.md \
    docs/plans/2026-09-30-create-repo-migration.md
npm install --no-fund --no-audit
```

- [ ] **Step 2: Drop what only create-repo used**

In `package.json`, delete the `test` script and ` && npm run test` from
`check` (no other package has tests). In `tsconfig.json`, delete the
`packages/*/bin/*.js`, `packages/*/lib/*.js` and `packages/*/test/*.js`
include entries. In `.commitlintrc.mts`, delete the `create-repo` scope
entry. In `README.md`, point the create-repo row at
`https://github.com/chewygumxx/create-repo` with the text
"`npm create @chewygumxx/repo`: new repositories; now its own repository".

- [ ] **Step 3: Verify and commit**

Run: `npm run check`
Expected: PASS.

```sh
git add --all
git commit -m "chore: Move create-repo to chewygumxx/create-repo"
```

Push only once the maintainer confirms: `git push`.

### Task 11: Archive repo-tmpl (Confirm)

1.x clones repo-tmpl and its `scripts/init.mjs` edits the README from
`# repo-tmpl` through `## Using this template` and removes `is_template`,
so both stay.

- [ ] **Step 1: Add a notice 1.x removes**

In `~/dev/repo-tmpl/README.md`, insert after `# repo-tmpl`:

```markdown
> [!NOTE]
> Archived. The template now ships inside
> [`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo)
> 2.0.0 and later.
```

In `.repo-metadata.jsonc`, set `"is_template": false`.

```sh
cd ~/dev/repo-tmpl
npm run check && scripts/test-init.sh
git add README.md .repo-metadata.jsonc
git commit -m "docs: Point to create-repo and stop being a template"
git push
gh run watch --exit-status
```

Expected: CI passes and its metadata sync clears the template flag.

- [ ] **Step 2: Check 1.x still works, then archive**

```sh
cd "$(mktemp -d)"
npm create @chewygumxx/repo@1.0.1 -- legacy \
    --description "Checks 1.x against the archived template." \
    --owner chewygumxx --no-metadata --dry-run --yes
gh repo archive chewygumxx/repo-tmpl --yes
gh repo view chewygumxx/repo-tmpl --json isArchived,isTemplate
npm deprecate @chewygumxx/create-repo@"<2" \
    "Use 2.x: the template is now bundled; repo-tmpl is archived."
```

Expected: the 1.x dry run completes; `{"isArchived":true,"isTemplate":false}`.
