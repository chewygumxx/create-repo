---
ctime: 2026-10-01
mtime: 2026-10-05
spdx: GPL-3.0-only
title: >-
  Implementation Plan: multiple templates, phase 2
description: Plan for the typescript template and its publish feature
tags:
  - create-repo
  - plan
  - templates
  - typescript
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/docs/plans/2026-10-01-multiple-templates-phase-2.md
   -
   -->

# Implementation Plan: multiple templates, phase 2

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `typescript` template, and its `publish` feature, on the phase 1
engine.

**Architecture:** Two new layers over `common` and `npm`. `typescript`
replaces `package.json`, its lock, `tsconfig.json` and `README.md` and adds
`src/`; `typescript-publish` replaces `package.json`, its lock, `_gitignore`
and `README.md` and adds `tsconfig.build.json` and the publish workflow. The
catalogue gains one entry whose layers depend on the `publish` feature; init's
`packageJson` and `packageLock` edits name a published package `@owner/name`;
a `checkName` rule refuses a name npm cannot use.

**Tech Stack:** As phase 1. The templates use Node 24's type stripping,
TypeScript 7 (typecheck and emit), `node:test`, and npm trusted publishing.

**Spec:**
[`docs/specs/2026-09-30-multiple-templates-design.md`](../specs/2026-09-30-multiple-templates-design.md),
its "Phases" item 2, the "typescript" section and the "Name rules" table.
Phase 1 is
[`2026-09-30-multiple-templates-phase-1.md`](2026-09-30-multiple-templates-phase-1.md)
and has landed on `main`.

## Global Constraints

- Node `>=24`; ES modules; every `.js` file starts with its header and
  `// @ts-check`, and is typechecked by `npm run typecheck`.
- No runtime dependency is added; `jsonc-parser` stays the only one.
- A new file's header follows its neighbours': the vim modeline, the SPDX
  line, `~chewygumxx/create-repo.git` (in the templates,
  `~chewygumxx/repo-tmpl.git`), and `::: :/<its path>`. The templates keep
  the `chewygumxx/repo-tmpl` identity; `lib/init.js` rewrites it.
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
- `standard`'s output does not change, and Task 3 does not change what
  `typescript` makes without `publish`.
- `UsageError` exits 2; `TemplateError` and `CommandError` exit 1.
- Without a terminal no feature is chosen, whatever a template's defaults.
- A layer holding a `package.json` holds its `package-lock.json`, and
  regenerating it is `npm install --package-lock-only --no-fund --no-audit`
  in the layer's directory.

## Deviations from the Spec

- **`publish`'s `check` also runs `build`.** The spec's `check` runs only
  `test`. TypeScript 7 refuses to emit without an explicit `rootDir`
  (found while writing this plan), so a broken `tsconfig.build.json` would
  fail at the first release. `npm run build` inside `check` moves that
  failure to the first CI run. `dist/` is ignored, so nothing else sees it.
- **`tsconfig.build.json` sets `rootDir: "src"`.** Required by TypeScript 7
  when emitting; without it `dist/` would also mirror `src/`.
- **The name rule for `publish` also refuses a leading `.` or `_`.** GitHub
  allows `.github` as a repository name; npm does not allow such a package
  name. Refused with the rule, never derived, as the spec's "Reject, never
  derive" decision says.
- **The published layer's version is `0.0.0`.** The spec does not name one;
  the first release bumps it, as this repository's README describes.
- **The prompt takes `publish` by default; the flags do not.** Your decision
  on 2026-10-01, in place of the spec's opt-in only. A template may name
  `defaultFeatures`: an empty reply to the features prompt takes them and
  `none` takes no feature. `--with`, including `--with ""`, and a missing
  terminal never take them, so non-interactive callers are unaffected.
  Task 4 amends the spec to say so.
- **`typescript` without `publish` keeps `private: true`.** As the spec says.
  Its `package.json` and lock are its own layer's, not the `npm` layer's,
  because `"type": "module"`, `engines` and the `test` script differ.

## Review Focus

1. `--with publish` with an uppercase owner or name (`MyOrg`, `MyThing`):
   refused with the lowercase rule before anything is copied, not a
   `npm publish` failure after the first release (Task 3).
2. `--with publish` with a repository name npm rejects that GitHub allows,
   such as `.github` or `_notes`: refused with the rule (Task 3).
3. A layer's lock drifting from its `package.json`, as when a dependency is
   bumped by hand and the lock is not regenerated: `npm test` fails, not
   only CI's matrix (Task 2).
4. `typescript` without `publish`: no publish workflow, no `dist/` entry in
   `.gitignore`, and `private` still true, so it can never be published by
   accident (Task 3).
5. The features prompt: an empty reply takes `publish` for `typescript` and
   `none` takes no feature, while `--with ""` and a missing terminal never
   take the default, so scripts keep today's behaviour (Task 4).

---

### Task 1: Name a published package `@owner/name`

**Files:**

- Modify: `lib/init.js` (`packageJson` and `packageLock`)
- Test: `test/init.test.js`

**Interfaces:**

- Consumes: `EditContext.features: ReadonlySet<string>` (phase 1), and
  `identity.owner`.
- Produces: `packageJson` and `packageLock` set the package's name to
  `@owner/name` when `features` has `publish`, and to `name` otherwise. Task 3
  relies on it.

- [ ] **Step 1: Write the failing test**

In `test/init.test.js`, let `initialised` take the chosen features. Its
signature and body become:

```js
/**
 * Copies the template, lets `before` change the copy, initialises it, and
 * hands it to `body`.
 * @param {(dir: string, files: string[]) => void} body
 * @param {Partial<typeof IDENTITY>} [changes]
 * @param {(dir: string) => void} [before]
 * @param {string[]} [features] the template's chosen features
 */
function initialised(body, changes = {}, before = () => {}, features = []) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
    try {
        const dir = join(root, "derived");
        const files = copyTemplate(dir, ["common", "npm"]);
        before(dir);
        init(dir, { ...IDENTITY, ...changes }, files, {
            edits: EDITS,
            features,
            today: "2026-10-01",
        });
        body(dir, files);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}
```

Add after the "metadata, package and lockfile carry the identity" test:

```js
test("a published package is @owner/name, in package and lockfile", () =>
    initialised(
        (dir) => {
            const name = "@example/derived-repo";
            assert.equal(JSON.parse(read(dir, "package.json")).name, name);
            const lock = JSON.parse(read(dir, "package-lock.json"));
            assert.equal(lock.name, name);
            assert.equal(lock.packages[""].name, name);
        },
        {},
        undefined,
        ["publish"],
    ));
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/init.test.js`

Expected: FAIL, "a published package is @owner/name, in package and
lockfile", `'derived-repo' !== '@example/derived-repo'`; the rest pass.

- [ ] **Step 3: Implement**

In `lib/init.js`, above `packageJson`, add:

```js
/**
 * The npm package's name: the repository's, or `@owner/name` when the
 * template publishes it.
 * @param {EditContext} context
 */
const packageName = ({ identity: { owner, name }, features }) =>
    features.has("publish") ? `@${owner}/${name}` : name;
```

Replace `packageJson` and `packageLock` with:

```js
/** @param {EditContext} context */
export function packageJson(context) {
    const {
        dir,
        identity: { description, topics },
        slug,
    } = context;
    editJson(join(dir, "package.json"), (data) => {
        requireKeys(
            data,
            ["name", "description", "keywords", "homepage", "repository"],
            "package.json",
        );
        data.name = packageName(context);
        data.description = description;
        data.keywords = topics;
        data.homepage = `https://github.com/${slug}`;
        data.repository = `github:${slug}`;
    });
}

/** @param {EditContext} context */
export function packageLock(context) {
    const name = packageName(context);
    editJson(join(context.dir, "package-lock.json"), (data) => {
        requireKeys(data, ["name", "packages"], "package-lock.json");
        requireKeys(data.packages, [""], "package-lock.json packages");
        data.name = name;
        data.packages[""].name = name;
    });
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx --no -- biome check --write lib/init.js test/init.test.js && npm test`

Expected: `# fail 0`.

- [ ] **Step 5: Typecheck and commit**

```sh
npm run typecheck
git add lib/init.js test/init.test.js
git commit -m "feat: Name a published package @owner/name"
```

Expected: no typecheck errors.

---

### Task 2: The `typescript` template

**Files:**

- Create: `templates/typescript/package.json`,
  `templates/typescript/package-lock.json`, `templates/typescript/tsconfig.json`,
  `templates/typescript/README.md`, `templates/typescript/src/index.ts`,
  `templates/typescript/src/index.test.ts`
- Modify: `lib/templates.js`
- Test: `test/templates.test.js`, `test/bin.test.js`

**Interfaces:**

- Consumes: `TEMPLATES`, `Template`, the six edits, `compose` (phase 1).
- Produces: `TEMPLATES.typescript` (layers `["common", "npm", "typescript"]`,
  no features yet) and the `NPM_EDITS` constant Task 3 and later npm
  templates share.

- [ ] **Step 1: Write the failing tests**

In `test/templates.test.js`, add `existsSync` to the `node:fs` import, then
add after "every layer belongs to a template":

```js
test("typescript adds sources, tests and its own package over npm", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set()));
    for (const file of [
        "src/index.ts",
        "src/index.test.ts",
        "tsconfig.json",
        "package.json",
        "package-lock.json",
        "README.md",
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(sources.get(file) ?? "", /templates\/typescript\//, file);
    }
    const pkg = JSON.parse(readFileSync(sources.get("package.json") ?? "", "utf8"));
    assert.equal(pkg.type, "module");
    assert.equal(pkg.private, true);
    assert.equal(pkg.engines.node, ">=24");
    assert.equal(pkg.scripts.test, "node --test 'src/**/*.test.ts'");
    assert.match(pkg.scripts.check, /npm run test/);
});

// `npm ci` fails when they differ, which only the CI matrix would notice.
test("each layer's lockfile matches its package.json", () => {
    for (const layer of readdirSync(TEMPLATES_DIR)) {
        const dir = join(TEMPLATES_DIR, layer);
        if (!existsSync(join(dir, "package.json"))) continue;
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        const lock = JSON.parse(
            readFileSync(join(dir, "package-lock.json"), "utf8"),
        );
        assert.equal(lock.name, pkg.name, layer);
        assert.equal(lock.version, pkg.version, layer);
        assert.equal(lock.packages[""].name, pkg.name, layer);
        assert.deepEqual(
            lock.packages[""].devDependencies,
            pkg.devDependencies,
            layer,
        );
    }
});
```

In `test/bin.test.js`, replace the "--help lists the templates" test with:

```js
test("--help lists the templates", () => {
    const { result } = runBin(() => ["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--template <name>/);
    assert.match(result.stdout, /\nTemplates:\n {2}standard {4}Any repository/);
    assert.match(result.stdout, /\n {2}typescript {2}A Node library or CLI/);
});
```

and add after "the first commit names the template":

```js
test("typescript is copied, initialised and named in the commit", () => {
    const { commit, pkg } = dryRun(["--template", "typescript"]);
    assert.match(commit, /\(typescript\)\./);
    assert.equal(pkg.name, "x");
    assert.equal(pkg.type, "module");
    assert.equal(pkg.private, true);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/templates.test.js test/bin.test.js`

Expected: FAIL. "typescript adds sources..." with `TypeError: Cannot read
properties of undefined (reading 'layers')`; "typescript is copied..." with
`Unknown template "typescript"`; "--help lists the templates" on the
`typescript` row. "each layer's lockfile matches its package.json" passes for
the `npm` layer alone.

- [ ] **Step 3: Add the layer's files**

`templates/typescript/package.json`:

```json
{
    "name": "repo-tmpl",
    "description": "Repository Template",
    "private": true,
    "type": "module",
    "keywords": [
        "repo",
        "template",
        "repository"
    ],
    "license": "GPL-3.0-only",
    "homepage": "https://github.com/chewygumxx/repo-tmpl",
    "repository": "github:chewygumxx/repo-tmpl",
    "engines": {
        "node": ">=24"
    },
    "devDependencies": {
        "@biomejs/biome": "2.5.14",
        "@chewygumxx/biome-config": "^1.0.0",
        "@chewygumxx/commitlint-config": "^1.0.0",
        "@chewygumxx/cz-commitlint": "^1.0.2",
        "@chewygumxx/remark-preset": "^1.0.3",
        "@chewygumxx/yamllint-config": "^1.0.0",
        "@commitlint/cli": "^21.2.2",
        "@types/node": "^24.19.0",
        "commitizen": "^4.3.2",
        "husky": "^9.1.7",
        "prettier": "^3.9.9",
        "remark-cli": "^12.0.1",
        "typescript": "^7.0.2"
    },
    "scripts": {
        "check": "npm run typecheck && npm run test && npm run lint:biome && npm run lint:md && npm run lint:yaml && npm run lint:emdash",
        "commit": "cz",
        "format": "biome format --write . && npm run format:yaml",
        "format:check": "biome format .",
        "format:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --write --log-level warn",
        "lint": "biome lint .",
        "lint:biome": "biome ci .",
        "lint:emdash": "git grep -nIP --untracked '\\x{2014}'; test $? -eq 1",
        "lint:md": "git ls-files -z '*.md' | xargs -0 remark --frail --quiet --no-stdout",
        "lint:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --check && git ls-files -z '*.yaml' '*.yml' | xargs -0 -r yamllint --strict",
        "prepare": "test -d node_modules/husky && husky || true",
        "test": "node --test 'src/**/*.test.ts'",
        "typecheck": "tsc"
    },
    "config": {
        "commitizen": {
            "path": "@chewygumxx/cz-commitlint"
        }
    },
    "remarkConfig": {
        "plugins": [
            "@chewygumxx/remark-preset"
        ]
    }
}
```

`templates/typescript/tsconfig.json`:

```json
{
    "$schema": "https://json.schemastore.org/tsconfig.json",
    "compilerOptions": {
        "target": "esnext",
        "module": "nodenext",
        "moduleResolution": "nodenext",
        "strict": true,
        "noEmit": true,
        "allowJs": true,
        "checkJs": true,
        "erasableSyntaxOnly": true,
        "verbatimModuleSyntax": true,
        "allowImportingTsExtensions": true,
        "types": ["node"],
        "skipLibCheck": true
    },
    "include": ["src", ".commitlintrc.mts"]
}
```

`templates/typescript/src/index.ts`:

```ts
// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/index.ts
//
//

/** Greets `name`, or the world when there is none. */
export function greet(name = "world"): string {
    return `Hello, ${name}!`;
}
```

`templates/typescript/src/index.test.ts`:

```ts
// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/index.test.ts
//
//

import assert from "node:assert/strict";
import { test } from "node:test";
import { greet } from "./index.ts";

test("greets the world by default", () => {
    assert.equal(greet(), "Hello, world!");
});

test("greets a name", () => {
    assert.equal(greet("Ada"), "Hello, Ada!");
});
```

`templates/typescript/README.md`:

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
description: "TypeScript Repository Template"
tags:
  - repo
  - template
  - repository
  - typescript
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.
Its source is TypeScript in `src/`, which Node runs as it is, with no build.

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
commitlint, the header sync, generic lint and format checks for workflows,
shell and zsh scripts, TOML, YAML and `.editorconfig`, and the metadata sync.
This repository's own `npm run check` follows, against the commit the header
sync pushed.

## Development

- `npm run commit` composes a commit interactively.
- `npm test` runs `src/**/*.test.ts` with `node --test`. Node 24 strips the
  types itself, so `tsc` only typechecks, with `npm run typecheck`.
- `npm run check` runs the checks CI runs: the typecheck, the tests, Biome's
  format and lint checks, Markdown lint, the YAML checks (prettier, then
  yamllint with `@chewygumxx/yamllint-config`) and a check that rejects em
  dashes.
- `npm run format` applies Biome formatting, and prettier's to YAML, which Biome
  does not read.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs commitlint.
````

- [ ] **Step 4: Add the catalogue entry**

In `lib/templates.js`, above `TEMPLATES`, add:

```js
/** The identity edits every npm template makes. */
const NPM_EDITS = [
    headers,
    repoMetadata,
    packageJson,
    packageLock,
    readme,
    commitlintScopes,
];
```

Make `standard`'s `edits` `NPM_EDITS`, and add after `standard`:

```js
    typescript: {
        description: "A Node library or CLI in TypeScript, run without a build",
        family: "npm",
        features: {},
        layers: () => ["common", "npm", "typescript"],
        edits: NPM_EDITS,
    },
```

- [ ] **Step 5: Run the tests; the lock test must fail now**

Run: `node --test test/templates.test.js`

Expected: FAIL, only "each layer's lockfile matches its package.json", with
`ENOENT ... templates/typescript/package-lock.json`.

- [ ] **Step 6: Generate the lock**

Run:

```sh
(cd templates/typescript && npm install --package-lock-only --no-fund --no-audit)
```

Expected: `templates/typescript/package-lock.json` exists, its `name` is
`repo-tmpl`, and no `node_modules/` was created. (If one appears, delete it: it
is ignored, but the layer is filtered by the composed `_gitignore` only.)

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/templates.js test/templates.test.js test/bin.test.js && npm test`

Expected: `# fail 0`.

- [ ] **Step 8: Run the template's own check for real**

Run:

```sh
rm -rf /tmp/create-repo-typescript
node scripts/materialize.js typescript /tmp/create-repo-typescript
(cd /tmp/create-repo-typescript && git init -q . && git add -A \
  && npm ci --no-fund --no-audit && npm run check)
```

Expected: every step passes: `tsc`, `# pass 2` from the tests, Biome, remark and
yamllint. Then `rm -rf /tmp/create-repo-typescript`.

- [ ] **Step 9: Whole check, then commit**

Run: `npm run check`

Expected: every step passes, `# fail 0`; `lint:templates` now also lints
`.templates/typescript`.

```sh
git add templates/typescript lib/templates.js test/templates.test.js test/bin.test.js
git commit -m "feat(template): Add the typescript template" \
  -m "Node 24 runs src/*.ts by type stripping, so TypeScript only
typechecks. The layer replaces the npm layer's package.json, lock,
tsconfig.json and README.md, and adds src/ with a node:test test."
```

---

### Task 3: The `publish` feature

**Files:**

- Create: `templates/typescript-publish/package.json`,
  `templates/typescript-publish/package-lock.json`,
  `templates/typescript-publish/tsconfig.build.json`,
  `templates/typescript-publish/_gitignore`,
  `templates/typescript-publish/README.md`,
  `templates/typescript-publish/.github/workflows/publish.yaml`
- Modify: `lib/templates.js`
- Test: `test/templates.test.js`, `test/bin.test.js`

**Interfaces:**

- Consumes: `packageJson` and `packageLock` naming `@owner/name` (Task 1),
  `TEMPLATES.typescript` and `NPM_EDITS` (Task 2), `UsageError`.
- Produces: `TEMPLATES.typescript.features.publish`; its `layers` adds
  `typescript-publish`; its `checkName` refuses an owner or name npm cannot
  use for a published package.

- [ ] **Step 1: Write the failing tests**

In `test/templates.test.js`, add after the typescript composition test:

```js
test("publish replaces the package, adds the build and the workflow", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set(["publish"])));
    for (const file of [
        "package.json",
        "package-lock.json",
        "_gitignore",
        "README.md",
        "tsconfig.build.json",
        ".github/workflows/publish.yaml",
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            /templates\/typescript-publish\//,
            file,
        );
    }
    const pkg = JSON.parse(readFileSync(sources.get("package.json") ?? "", "utf8"));
    assert.ok(!("private" in pkg));
    assert.equal(pkg.name, "@chewygumxx/repo-tmpl");
    assert.deepEqual(pkg.files, ["dist"]);
    assert.equal(pkg.scripts.prepack, "npm run build");
    assert.equal(pkg.publishConfig.provenance, true);
    assert.match(pkg.scripts.check, /npm run build/);
    assert.match(readFileSync(sources.get("_gitignore") ?? "", "utf8"), /^\/dist\/$/m);
});

// The package stays private, and unpublishable by accident.
test("typescript without publish carries no publishing", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set()));
    assert.ok(!sources.has(".github/workflows/publish.yaml"));
    assert.ok(!sources.has("tsconfig.build.json"));
    assert.doesNotMatch(
        readFileSync(sources.get("_gitignore") ?? "", "utf8"),
        /dist/,
    );
});

test("a published package's owner and name must be lowercase npm names", () => {
    const { checkName } = TEMPLATES.typescript;
    assert.ok(checkName);
    const publish = new Set(["publish"]);
    checkName({ owner: "example", name: "my.thing_2" }, publish);
    // Not published: any GitHub name will do.
    checkName({ owner: "Example", name: ".Github" }, new Set());
    for (const identity of [
        { owner: "Example", name: "x" },
        { owner: "example", name: "X" },
        { owner: "example", name: ".github" },
        { owner: "example", name: "_notes" },
    ]) {
        assert.throws(
            () => checkName(identity, publish),
            (error) =>
                error instanceof UsageError &&
                /@\S+\/\S+/.test(error.message) &&
                /lowercase/.test(error.message),
            JSON.stringify(identity),
        );
    }
});
```

In `test/bin.test.js`, add after the typescript test:

```js
test("publish names the package @owner/name and the commit", () => {
    const { commit, pkg } = dryRun(["--template", "typescript", "--with", "publish"]);
    assert.match(commit, /\(typescript, with publish\)\./);
    assert.equal(pkg.name, "@example/x");
    assert.ok(!("private" in pkg));
    assert.equal(pkg.publishConfig.access, "public");
});

test("a name npm refuses stops publish before anything is copied", () => {
    const { result, copied } = runBin((root) => [
        "x",
        "--description",
        "D",
        "--owner",
        "Example",
        "--dir",
        join(root, "x"),
        "--no-metadata",
        "--dry-run",
        "--yes",
        "--template",
        "typescript",
        "--with",
        "publish",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /@Example\/x.*lowercase/);
    assert.ok(!copied);
});

test("--with publish is refused by a template without it", () => {
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
        "--with",
        "publish",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /standard template has no features/);
    assert.ok(!copied);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/templates.test.js test/bin.test.js`

Expected: FAIL. In `templates.test.js`, the composition test (`typescript-publish`
missing from the sources) and the name-rule test (`checkName` undefined); in
`bin.test.js`, "publish names the package..." with `The typescript template has
no feature "publish"` and "a name npm refuses..." likewise (status 2 but the
wrong message). "typescript without publish carries no publishing" and "--with
publish is refused by a template without it" already pass: they pin what must
stay true.

- [ ] **Step 3: Add the layer's files**

`templates/typescript-publish/package.json`:

```json
{
    "name": "@chewygumxx/repo-tmpl",
    "version": "0.0.0",
    "description": "Repository Template",
    "type": "module",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "default": "./dist/index.js"
        }
    },
    "types": "./dist/index.d.ts",
    "keywords": [
        "repo",
        "template",
        "repository"
    ],
    "license": "GPL-3.0-only",
    "homepage": "https://github.com/chewygumxx/repo-tmpl",
    "repository": "github:chewygumxx/repo-tmpl",
    "files": [
        "dist"
    ],
    "engines": {
        "node": ">=24"
    },
    "publishConfig": {
        "access": "public",
        "provenance": true
    },
    "devDependencies": {
        "@biomejs/biome": "2.5.14",
        "@chewygumxx/biome-config": "^1.0.0",
        "@chewygumxx/commitlint-config": "^1.0.0",
        "@chewygumxx/cz-commitlint": "^1.0.2",
        "@chewygumxx/remark-preset": "^1.0.3",
        "@chewygumxx/yamllint-config": "^1.0.0",
        "@commitlint/cli": "^21.2.2",
        "@types/node": "^24.19.0",
        "commitizen": "^4.3.2",
        "husky": "^9.1.7",
        "prettier": "^3.9.9",
        "remark-cli": "^12.0.1",
        "typescript": "^7.0.2"
    },
    "scripts": {
        "build": "tsc -p tsconfig.build.json",
        "check": "npm run typecheck && npm run build && npm run test && npm run lint:biome && npm run lint:md && npm run lint:yaml && npm run lint:emdash",
        "commit": "cz",
        "format": "biome format --write . && npm run format:yaml",
        "format:check": "biome format .",
        "format:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --write --log-level warn",
        "lint": "biome lint .",
        "lint:biome": "biome ci .",
        "lint:emdash": "git grep -nIP --untracked '\\x{2014}'; test $? -eq 1",
        "lint:md": "git ls-files -z '*.md' | xargs -0 remark --frail --quiet --no-stdout",
        "lint:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --check && git ls-files -z '*.yaml' '*.yml' | xargs -0 -r yamllint --strict",
        "prepack": "npm run build",
        "prepare": "test -d node_modules/husky && husky || true",
        "test": "node --test 'src/**/*.test.ts'",
        "typecheck": "tsc"
    },
    "config": {
        "commitizen": {
            "path": "@chewygumxx/cz-commitlint"
        }
    },
    "remarkConfig": {
        "plugins": [
            "@chewygumxx/remark-preset"
        ]
    }
}
```

`templates/typescript-publish/tsconfig.build.json`:

```json
{
    "$schema": "https://json.schemastore.org/tsconfig.json",
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "noEmit": false,
        "outDir": "dist",
        "rootDir": "src",
        "declaration": true,
        "rewriteRelativeImportExtensions": true
    },
    "include": ["src"],
    "exclude": ["src/**/*.test.ts"]
}
```

`templates/typescript-publish/_gitignore`:

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

node_modules/
/.herdr/
/.claude/worktrees/

/.remember/
/.superpowers/

/dist/
```

`templates/typescript-publish/.github/workflows/publish.yaml`:

```yaml
# vim:set expandtab shiftwidth=4 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.github/workflows/publish.yaml
#
#

# Stages the package for a `v<version>` tag, e.g. `v1.0.0`, if package.json
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

`templates/typescript-publish/README.md`:

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
description: "TypeScript Package Template"
tags:
  - repo
  - template
  - repository
  - typescript
  - npm
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.
Its source is TypeScript in `src/`, which Node runs as it is, and it publishes
to npm as a compiled package.

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
commitlint, the header sync, generic lint and format checks for workflows,
shell and zsh scripts, TOML, YAML and `.editorconfig`, and the metadata sync.
This repository's own `npm run check` follows, against the commit the header
sync pushed.

## Development

- `npm run commit` composes a commit interactively.
- `npm test` runs `src/**/*.test.ts` with `node --test`. Node 24 strips the
  types itself, so `tsc` only typechecks, with `npm run typecheck`.
- `npm run check` runs the checks CI runs: the typecheck, the tests, Biome's
  format and lint checks, Markdown lint, the YAML checks (prettier, then
  yamllint with `@chewygumxx/yamllint-config`) and a check that rejects em
  dashes.
- `npm run format` applies Biome formatting, and prettier's to YAML, which Biome
  does not read.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs commitlint.

## Publishing

`npm run build` compiles `src/` to `dist/` with its declarations, and
`prepack` runs it, so a tarball always holds a fresh build.

To release, bump `version` in `package.json` and `package-lock.json`, commit,
and push a matching `v*` tag. `.github/workflows/publish.yaml` runs the check,
compares the tag with `version`, then stages the version with
`npm stage publish`; approve it on npmjs.com to publish it.

Before the first release, add a Trusted Publisher in the package's npm
settings that names this repository and the `publish.yaml` workflow with the
stage publish permission. No `NPM_TOKEN` secret exists or is needed.
````

- [ ] **Step 4: Generate the lock**

Run:

```sh
(cd templates/typescript-publish && npm install --package-lock-only --no-fund --no-audit)
```

Expected: `templates/typescript-publish/package-lock.json` exists and its `name`
is `@chewygumxx/repo-tmpl` with `version` `0.0.0`; no `node_modules/`.

- [ ] **Step 5: Add the feature and the name rule to the catalogue**

In `lib/templates.js`, above `TEMPLATES`, add:

```js
/**
 * A published package is `@owner/name`, and npm scopes and package names are
 * lowercase, and a package name does not start with `.` or `_`. GitHub allows
 * more, so the name is refused, not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function publishedPackage({ owner, name }, features) {
    if (!features.has("publish")) return;
    if (owner === owner.toLowerCase() && /^[a-z0-9-][a-z0-9._-]*$/.test(name)) {
        return;
    }
    throw new UsageError(
        `The published package @${owner}/${name} is not a valid npm name: the owner and name must be lowercase, and the name must not start with "." or "_".`,
    );
}
```

Replace the `typescript` entry with:

```js
    typescript: {
        description: "A Node library or CLI in TypeScript, run without a build",
        family: "npm",
        features: {
            publish: "Publish to npm as @owner/name, compiled to dist/",
        },
        layers: (features) => [
            "common",
            "npm",
            "typescript",
            ...(features.has("publish") ? ["typescript-publish"] : []),
        ],
        edits: NPM_EDITS,
        checkName: publishedPackage,
    },
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/templates.js test/templates.test.js test/bin.test.js && npm test`

Expected: `# fail 0`; "every combination copies and initialises, leaving no
identity" now also covers `typescript, with publish`.

- [ ] **Step 7: Run the published template's own check for real**

Run:

```sh
rm -rf /tmp/create-repo-publish
node scripts/materialize.js typescript --with publish /tmp/create-repo-publish
(cd /tmp/create-repo-publish && git init -q . && git add -A \
  && npm ci --no-fund --no-audit && npm run check \
  && npm pack --dry-run 2>&1 | grep -E 'notice [0-9.]+[kM]?B ')
```

Expected: `npm run check` passes, including `tsc -p tsconfig.build.json`, and
the tarball lists exactly `LICENSE`, `README.md`, `dist/index.d.ts`,
`dist/index.js` and `package.json`. Then `rm -rf /tmp/create-repo-publish`.

- [ ] **Step 8: Whole check, then commit**

Run: `npm run check`

Expected: every step passes, `# fail 0`; `lint:templates` lints
`.templates/typescript+publish`.

```sh
git add templates/typescript-publish lib/templates.js test/templates.test.js test/bin.test.js
git commit -m "feat(template): Add typescript's publish feature" \
  -m "With --with publish the package is @owner/name, compiled to dist/
and staged by a tag-triggered workflow. TypeScript 7 needs an explicit
rootDir to emit, and check runs the build so a broken
tsconfig.build.json fails in CI, not at the first release."
```

---

### Task 4: Publish is the prompt's default

**Files:**

- Modify: `lib/templates.js` (the `Template` typedef and the `typescript`
  entry), `lib/prompt.js` (`featureQuestion`, a new `pickFeatures`),
  `docs/specs/2026-09-30-multiple-templates-design.md`
- Test: `test/prompt.test.js`, `test/templates.test.js`

**Interfaces:**

- Consumes: `checkFeatures`, `parseFeatures`, `completeAnswers`, the
  `typescript` entry (Task 3).
- Produces: `Template.defaultFeatures?: string[]`, the features an empty
  reply to the features prompt takes; `TEMPLATES.typescript.defaultFeatures`
  is `["publish"]`. The prompt's question ends `[publish]: ` (`[none]: `
  when a template has no defaults) and `none` takes no feature.

- [ ] **Step 1: Write the failing tests**

In `test/prompt.test.js`, add after "an empty reply takes standard, which asks
for no features":

```js
/** The crate template, taking `lib` when its features are not chosen. */
const DEFAULTING = {
    ...CATALOGUE,
    crate: { ...CATALOGUE.crate, defaultFeatures: ["lib"] },
};

test("an empty reply to the features prompt takes the defaults", async () => {
    const { ask, asked } = asker(["crate", "", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: DEFAULTING,
    });
    assert.deepEqual(answers.features, ["lib"]);
    assert.match(asked[1], /\[lib\]: $/);
});

test("none takes no feature, and other replies replace the defaults", async () => {
    for (const [reply, expected] of [
        ["none", []],
        ["bin", ["bin"]],
        ["lib, bin", ["lib", "bin"]],
    ]) {
        const { ask } = asker(["crate", reply, "x", "D", "", ""]);
        const answers = await completeAnswers(parseOptions([]), {
            owner: "o",
            ask,
            templates: DEFAULTING,
        });
        assert.deepEqual(answers.features, expected, reply);
    }
});

test("a template without defaults shows none, and an empty reply takes it", async () => {
    const { ask, asked } = asker(["crate", "", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: CATALOGUE,
    });
    assert.deepEqual(answers.features, []);
    assert.match(asked[1], /\[none\]: $/);
});

test("flags and a missing terminal never take the defaults", async () => {
    const run = (/** @type {string[]} */ extra) =>
        completeAnswers(
            parseOptions([
                "x",
                "--description",
                "D",
                "--template",
                "crate",
                ...extra,
            ]),
            { owner: "o", templates: DEFAULTING },
        );
    assert.deepEqual((await run([])).features, []);
    assert.deepEqual((await run(["--with", ""])).features, []);
    assert.deepEqual((await run(["--with", "bin"])).features, ["bin"]);
});
```

In `test/templates.test.js`, add after "every layer belongs to a template":

```js
test("typescript takes publish by default at the prompt", () => {
    assert.deepEqual(TEMPLATES.typescript.defaultFeatures, ["publish"]);
});

test("every default feature is one the template has", () => {
    for (const [name, template] of Object.entries(TEMPLATES)) {
        for (const feature of template.defaultFeatures ?? []) {
            assert.ok(Object.hasOwn(template.features, feature), name);
        }
    }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/prompt.test.js test/templates.test.js`

Expected: FAIL, "an empty reply to the features prompt takes the defaults"
(`[]` is not `["lib"]`), "none takes no feature..." (the reply `none` is
refused as an unknown feature, and the asker runs out of replies), "a template
without defaults shows none..." (the question ends `may be empty): `) and
"typescript takes publish by default at the prompt" (`undefined`). "flags and a
missing terminal never take the defaults" and "every default feature is one the
template has" pass already: they pin what must stay true.

- [ ] **Step 3: Implement the prompt**

In `lib/prompt.js`, replace `featureQuestion` with:

```js
/**
 * The template's features, then the question, which shows what an empty
 * reply takes.
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
    const taken = template.defaultFeatures?.join(",") || "none";
    return `Features of ${name}:\n${rows.join("\n")}\nFeatures (comma separated, or none) [${taken}]: `;
}

/**
 * The features a reply chooses: an empty reply takes the template's
 * defaults, and `none` takes no feature.
 * @param {string} reply
 * @param {string} name
 * @param {Template} template
 */
function pickFeatures(reply, name, template) {
    if (reply === "none") return [];
    const chosen = reply ? parseFeatures(reply) : (template.defaultFeatures ?? []);
    return checkFeatures(name, template, chosen);
}
```

and in `completeAnswers` replace the prompt's parser

```js
                    (reply) =>
                        checkFeatures(
                            templateName,
                            template,
                            parseFeatures(reply),
                        ),
```

with

```js
                    (reply) => pickFeatures(reply, templateName, template),
```

- [ ] **Step 4: Add the catalogue field**

In `lib/templates.js`, add to the `Template` typedef, after `features`:

```js
 * @property {string[]} [defaultFeatures] the features an empty reply to the
 *     features prompt takes; the flags and a missing terminal choose none
```

and to the `typescript` entry, after `features`:

```js
        defaultFeatures: ["publish"],
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib test && npm test`

Expected: `# fail 0`.

- [ ] **Step 6: Amend the spec, then commit**

In `docs/specs/2026-09-30-multiple-templates-design.md`, in "The command
line", after the bullet beginning "In a terminal, whichever of the template",
add:

```markdown
- A template may name `defaultFeatures`, which an empty reply to the features
  prompt takes; `none` takes no feature. The flags, `--with ""` included, and
  a missing terminal never take them. `typescript` names `publish`, so its
  prompt offers the publishable package unless told otherwise.
```

Run: `npm run typecheck && npm run lint:md && npm run lint:emdash`

Expected: all exit 0.

```sh
git add lib test docs/specs
git commit -m "feat: Take publish by default at the prompt" \
  -m "A template may name defaultFeatures, which an empty reply to the
features prompt takes. Flags and a missing terminal never do, so
scripts get the private package as before."
```

---

### Task 5: Dependabot and the docs

**Files:**

- Modify: `.github/dependabot.yml`, `README.md`, `bin/create-repo.js`
  (the header comment)

**Interfaces:**

- Consumes: the two layers of Tasks 2 and 3.
- Produces: nothing later tasks use.

- [ ] **Step 1: Watch the new layers' dependencies**

In `.github/dependabot.yml`, after the `github-actions` entry for
`/templates/npm`, add:

```yaml
    - package-ecosystem: npm
      directory: /templates/typescript
      schedule:
          interval: weekly
      commit-message:
          prefix: build(template)
      ignore:
          # Its majors follow Node's; bumped by hand with the Node floor.
          - dependency-name: "@types/node"
            update-types: ["version-update:semver-major"]

    - package-ecosystem: npm
      directory: /templates/typescript-publish
      schedule:
          interval: weekly
      commit-message:
          prefix: build(template)
      ignore:
          # Its majors follow Node's; bumped by hand with the Node floor.
          - dependency-name: "@types/node"
            update-types: ["version-update:semver-major"]

    - package-ecosystem: github-actions
      directory: /templates/typescript-publish
      schedule:
          interval: weekly
      commit-message:
          prefix: ci(template)
```

Run: `npm run lint:yaml`

Expected: passes.

- [ ] **Step 2: Commit**

```sh
git add .github/dependabot.yml
git commit -m "ci: Watch the typescript layers"
```

- [ ] **Step 3: Describe the template**

In `README.md`, replace the table under "## The templates" with:

```markdown
| Template     | For                                                       |
| ------------ | --------------------------------------------------------- |
| `standard`   | Any repository: commit rules, lint and format checks, CI  |
|              | and Claude Code settings                                  |
| `typescript` | A Node library or CLI in TypeScript, run without a build; |
|              | `--with publish` compiles it and publishes it to npm as   |
|              | `@owner/name` by trusted publishing                       |
```

and replace the last sentence of the paragraph after it, "`common` holds what
every repository carries, and `npm` the npm-based checks.", with:

```markdown
`common` holds what every repository carries, `npm` the npm-based checks,
`typescript` its sources, and `typescript-publish` what `--with publish`
replaces and adds. A layer that holds a `package.json` holds its lock;
regenerate it with `npm install --package-lock-only` in the layer's
directory.
```

After the paragraph that says `--template` chooses one, add:

```markdown
At the prompt, `typescript` takes `publish` unless the reply chooses other
features or `none`. `--with`, and a run without a terminal, choose only what
they name.
```

Remove the sentence "To update an npm layer's lock after changing its
`package.json`, run `npm install --package-lock-only` in the layer's
directory." from the Development section, which the new sentence now covers.

In `bin/create-repo.js`, change the header comment's "copies the bundled
template" to "copies the chosen template".

Run: `npm run lint:md && npm run lint:emdash`

Expected: both exit 0. If the table's columns are reported misaligned, pad
them to the widest cell.

- [ ] **Step 4: Verify the whole run for real**

Run the tool itself, once per combination, in a scratch directory:

```sh
for with in "" "publish"; do
  rm -rf /tmp/create-repo-e2e
  node bin/create-repo.js x --template typescript ${with:+--with "$with"} \
    --description "End to end" --owner example --dir /tmp/create-repo-e2e \
    --no-metadata --dry-run --yes
  git -C /tmp/create-repo-e2e log --format=%B -1
  git -C /tmp/create-repo-e2e grep -nE 'repo-tmpl|repo_tmpl|is_template|Using this template' \
    || echo "no sentinel"
done
rm -rf /tmp/create-repo-e2e
```

Expected: each run installs, formats and checks the copy, commits once, and
prints the commit body ending `(typescript).` and `(typescript, with
publish).`, then `no sentinel`; no GitHub command runs.

- [ ] **Step 5: Whole check, then commit**

Run: `npm run check`

Expected: every step passes, `# fail 0`.

```sh
git add README.md bin/create-repo.js
git commit -m "docs: Describe the typescript template" \
  -m "The table gains its row and a comma it lacked, the prompt's
default is described, the layers sentence names the new layers and the lock note, and the entry point's
header no longer says the template is singular."
```

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
