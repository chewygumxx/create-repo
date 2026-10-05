---
ctime: 2026-10-01
mtime: 2026-10-05
spdx: GPL-3.0-only
title: >-
  Implementation Plan: multiple templates, phase 3
description: >-
  Plan for the cloudflare template: a Worker in TypeScript, tested in the
  Workers runtime, with a deploy workflow.
tags:
  - create-repo
  - plan
  - templates
  - cloudflare
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/docs/plans/2026-10-01-multiple-templates-phase-3.md
   -
   -->

# Implementation Plan: multiple templates, phase 3

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `cloudflare` template: a Cloudflare Worker in TypeScript, tested
in the Workers runtime, with a deploy workflow, on the phase 1 and 2 engine.

**Architecture:** One new layer, `cloudflare`, over `common` and `npm`. It
replaces the npm layer's `package.json`, lock, `tsconfig.json`, `.biome.json`,
`_gitignore` and `README.md`, and adds `wrangler.jsonc`, the generated
`worker-configuration.d.ts`, `vitest.config.ts`, `src/`, `test/` and the
deploy workflow. The catalogue gains one entry; init gains a `wranglerName`
edit, and a `checkName` rule refuses a repository name a Worker cannot use.

**Tech Stack:** As phases 1 and 2, plus Wrangler 4, Vitest 4 with
`@cloudflare/vitest-pool-workers`, and `@cloudflare/workers-types`.

**Spec:**
[`docs/specs/2026-09-30-multiple-templates-design.md`](../specs/2026-09-30-multiple-templates-design.md),
its "Phases" item 3, the "cloudflare" section and the "Name rules" table.
Phases 1 and 2 have landed on `main`; this plan builds on
[`2026-10-01-multiple-templates-phase-2.md`](2026-10-01-multiple-templates-phase-2.md).

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
- `standard` and `typescript` output does not change.
- `UsageError` exits 2; `TemplateError` and `CommandError` exit 1.
- Without a terminal no feature is chosen, whatever a template's defaults.
  `cloudflare` has no features.
- A layer holding a `package.json` holds its `package-lock.json`, and
  regenerating it is `npm install --package-lock-only --no-fund --no-audit`
  in the layer's directory.

## Deviations from the Spec

Each was found by building the layer in a scratch copy and running it.

- **`cloudflare`'s layers are `common`, `npm`, `cloudflare`, without
  `typescript`.** The spec lists `typescript` too, but the `cloudflare` layer
  replaces every file of it except `src/index.test.ts`, and no layer can
  delete: that test imports `greet` from the `src/index.ts` the Worker
  replaces, so it would fail the typecheck of every new Worker.
- **The generated types omit the runtime:** `npm run types` is
  `wrangler types --include-runtime=false`, and `@cloudflare/workers-types` is
  a dev dependency. The full file is 600 KB and holds em dashes from
  Cloudflare's doc comments, which `lint:emdash`, the pre-commit hook and the
  Claude hook all reject; the trimmed file is 351 bytes.
- **`.biome.json` is replaced** to ignore `worker-configuration.d.ts`, whose
  generated formatting Biome rejects. The spec does not list it.
- **`wrangler types --check` exists in Wrangler 4**, so the spec's fallback
  (generate to a temporary path and compare) is not built. The script is
  `types:check`.
- **`compatibility_date` is `2026-08-15`, not the day the template is
  written.** The workerd inside `@cloudflare/vitest-pool-workers` refuses to
  start for a date after the newest it supports (`2026-08-22` today), so the
  tests would not run. `wrangler.jsonc` says why and to bump it with that
  package.
- **`vitest` is pinned to `^4.1.0`**, the range
  `@cloudflare/vitest-pool-workers` peers on; Dependabot ignores its majors.
- **The deploy workflow also requires the CI run to be a `push`.** A
  `workflow_run` of a pull request's CI would otherwise deploy an unmerged
  branch that happens to be named `main` on a fork.

## Review Focus

1. A repository name GitHub allows and a Worker cannot use (`My-Worker`,
   `my_worker`, `my.worker`, a leading or trailing `-`, 64 characters):
   refused with the rule before anything is copied (Task 2).
2. Renaming the Worker at init must not make `wrangler types --check` fail:
   a new repository's first `npm run check` passes with the name it was
   given (Task 2, verified by running the tool).
3. The deploy job runs only for `workflow_dispatch`, or for a successful
   `push` CI run, and only when `vars.CLOUDFLARE_ACCOUNT_ID` is set (Task 2).
4. No file of any template holds an em dash: a developer who regenerates
   `worker-configuration.d.ts` with the runtime included would break every
   new repository's `lint:emdash` (Task 2).
5. `npm run check` fails when `worker-configuration.d.ts` is stale, as when a
   var is added to `wrangler.jsonc` without `npm run types` (Task 2).

---

### Task 1: The `wranglerName` edit

**Files:**

- Modify: `lib/init.js`
- Test: `test/init.test.js`

**Interfaces:**

- Consumes: `EditContext`, the private `editJsonc` (phase 1).
- Produces: `export function wranglerName(context: EditContext): void`, which
  sets `name` in `wrangler.jsonc` to the repository's name, keeping its
  comments, and fails as any edit does when the file or the key is missing.
  Task 2 lists it in the catalogue.

- [ ] **Step 1: Write the failing tests**

In `test/init.test.js`, add `wranglerName` to the import from `../lib/init.js`,
and add after "a published package is @owner/name, in package and lockfile":

```js
/**
 * Initialises a copy holding a wrangler.jsonc with `text`.
 * @param {string} text
 */
function withWrangler(text) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
    try {
        const dir = join(root, "derived");
        const files = copyTemplate(dir, ["common", "npm"]);
        writeFileSync(join(dir, "wrangler.jsonc"), text);
        init(dir, IDENTITY, [...files, "wrangler.jsonc"], {
            edits: [...EDITS, wranglerName],
            today: "2026-10-01",
        });
        return read(dir, "wrangler.jsonc");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("wranglerName names the Worker and keeps the comments", () => {
    const text = withWrangler(`// ~chewygumxx/repo-tmpl.git
{
    // The Worker's name.
    "name": "repo-tmpl",
    "main": "src/index.ts"
}
`);
    assert.match(text, /"name": "derived-repo"/);
    assert.match(text, /\/\/ The Worker's name\./);
    assert.match(text, /~example\/derived-repo\.git/);
});

test("wranglerName fails when wrangler.jsonc has no name", () => {
    assert.throws(
        () => withWrangler(`{ "main": "src/index.ts" }\n`),
        (error) =>
            error instanceof TemplateError &&
            /"name" in wrangler\.jsonc not found/.test(error.message),
    );
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/init.test.js`

Expected: FAIL, the whole file, which no longer loads: `SyntaxError: The
requested module '../lib/init.js' does not provide an export named
'wranglerName'`.

- [ ] **Step 3: Implement**

In `lib/init.js`, after `packageLock`, add:

```js
/**
 * The Worker's name, which is the repository's.
 * @param {EditContext} context
 */
export function wranglerName({ dir, identity: { name } }) {
    editJsonc(join(dir, "wrangler.jsonc"), "wrangler.jsonc", [["name", name]]);
}
```

- [ ] **Step 4: Run it to see it pass, then commit**

Run: `npx --no -- biome check --write lib/init.js test/init.test.js && npm test && npm run typecheck`

Expected: `# fail 0`, no typecheck errors.

```sh
git add lib/init.js test/init.test.js
git commit -m "feat: Add the wranglerName edit"
```

---

### Task 2: The `cloudflare` template

**Files:**

- Create: `templates/cloudflare/package.json`,
  `templates/cloudflare/package-lock.json`,
  `templates/cloudflare/tsconfig.json`, `templates/cloudflare/.biome.json`,
  `templates/cloudflare/_gitignore`, `templates/cloudflare/README.md`,
  `templates/cloudflare/wrangler.jsonc`,
  `templates/cloudflare/worker-configuration.d.ts`,
  `templates/cloudflare/vitest.config.ts`,
  `templates/cloudflare/src/index.ts`, `templates/cloudflare/test/index.test.ts`,
  `templates/cloudflare/.github/workflows/deploy.yaml`
- Modify: `lib/templates.js`
- Test: `test/templates.test.js`, `test/bin.test.js`

**Interfaces:**

- Consumes: `NPM_EDITS`, `Template`, `UsageError`, `compose` (phases 1 and 2);
  `wranglerName` (Task 1).
- Produces: `TEMPLATES.cloudflare` (layers `["common", "npm", "cloudflare"]`,
  no features, edits `[...NPM_EDITS, wranglerName]`, a `checkName` rule).

- [ ] **Step 1: Write the failing tests**

In `test/templates.test.js`, add after "every layer belongs to a template":

```js
test("cloudflare replaces the npm package and adds the Worker", () => {
    const sources = compose(TEMPLATES.cloudflare.layers(new Set()));
    for (const file of [
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        ".biome.json",
        "_gitignore",
        "README.md",
        "wrangler.jsonc",
        "worker-configuration.d.ts",
        "vitest.config.ts",
        "src/index.ts",
        "test/index.test.ts",
        ".github/workflows/deploy.yaml",
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(sources.get(file) ?? "", /templates\/cloudflare\//, file);
    }
    // The typescript layer's test imports a function the Worker replaces.
    assert.ok(!sources.has("src/index.test.ts"));
    const pkg = JSON.parse(readFileSync(sources.get("package.json") ?? "", "utf8"));
    assert.equal(pkg.private, true);
    assert.equal(pkg.scripts.test, "vitest run");
    assert.equal(pkg.scripts.types, "wrangler types --include-runtime=false");
    assert.match(pkg.scripts.check, /npm run types:check/);
});

// The full runtime types are 600 KB of Cloudflare's doc comments, em dashes
// included, which lint:emdash and the hooks refuse.
test("no template file holds an em dash", () => {
    for (const combination of combinations()) {
        const bad = [...compose(layersOf(combination)).entries()]
            .filter(([, source]) =>
                readFileSync(source, "utf8").includes("\u2014"),
            )
            .map(([file]) => file);
        assert.deepEqual(
            bad,
            [],
            label(combination.template, combination.features),
        );
    }
});

// The job must stay skipped until the account is configured, and must not
// deploy a pull request's run.
test("the deploy job needs the account, and a push or a manual run", () => {
    const text = readFileSync(
        compose(TEMPLATES.cloudflare.layers(new Set())).get(
            ".github/workflows/deploy.yaml",
        ) ?? "",
        "utf8",
    );
    assert.match(text, /vars\.CLOUDFLARE_ACCOUNT_ID != ''/);
    assert.match(text, /github\.event_name == 'workflow_dispatch'/);
    assert.match(text, /github\.event\.workflow_run\.event == 'push'/);
    assert.match(text, /github\.event\.workflow_run\.conclusion == 'success'/);
});

test("a Worker's name must be a lowercase label of 1 to 63 characters", () => {
    const { checkName } = TEMPLATES.cloudflare;
    assert.ok(checkName);
    for (const name of ["a", "my-worker", "w2", "a".repeat(63)]) {
        checkName({ owner: "example", name }, new Set());
    }
    for (const name of [
        "My-Worker",
        "my_worker",
        "my.worker",
        "-worker",
        "worker-",
        "a".repeat(64),
    ]) {
        assert.throws(
            () => checkName({ owner: "example", name }, new Set()),
            (error) =>
                error instanceof UsageError &&
                /Worker name/.test(error.message),
            name,
        );
    }
});
```

In `test/bin.test.js`, let `runBin` also return the copy's `wrangler.jsonc`
text: in the returned object, after `gitignore`, add

```js
            wrangler: existsSync(join(dir, "wrangler.jsonc"))
                ? readFileSync(join(dir, "wrangler.jsonc"), "utf8")
                : undefined,
```

add to "--help lists the templates":

```js
    assert.match(result.stdout, /\n {2}cloudflare {2}A Cloudflare Worker/);
```

and add after the typescript tests:

```js
test("cloudflare is copied, initialised and named in the commit", () => {
    const { commit, pkg, wrangler } = dryRun(["--template", "cloudflare"]);
    assert.match(commit, /\(cloudflare\)\./);
    assert.equal(pkg.name, "x");
    assert.equal(pkg.private, true);
    assert.match(wrangler ?? "", /"name": "x"/);
});

test("a name a Worker cannot use stops before anything is copied", () => {
    const { result, copied } = runBin((root) => [
        "My_Worker",
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
        "cloudflare",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Worker name/);
    assert.ok(!copied);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/templates.test.js test/bin.test.js`

Expected: FAIL. The four `cloudflare` tests in `templates.test.js` with
`TypeError: Cannot read properties of undefined`; in `bin.test.js`,
"cloudflare is copied..." with `Unknown template "cloudflare"`, "a name a Worker
cannot use..." with the same, and "--help lists the templates". "no template
file holds an em dash" passes: it pins what must stay true.

- [ ] **Step 3: Add the layer's files**

`templates/cloudflare/package.json`:

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
        "@cloudflare/vitest-pool-workers": "^0.22.0",
        "@cloudflare/workers-types": "^5.20260930.2",
        "@commitlint/cli": "^21.2.2",
        "@types/node": "^24.19.0",
        "commitizen": "^4.3.2",
        "husky": "^9.1.7",
        "prettier": "^3.9.9",
        "remark-cli": "^12.0.1",
        "typescript": "^7.0.2",
        "vitest": "^4.1.0",
        "wrangler": "^4.145.0"
    },
    "scripts": {
        "check": "npm run typecheck && npm run types:check && npm run test && npm run lint:biome && npm run lint:md && npm run lint:yaml && npm run lint:emdash",
        "commit": "cz",
        "deploy": "wrangler deploy",
        "dev": "wrangler dev",
        "format": "biome format --write . && npm run format:yaml",
        "format:check": "biome format .",
        "format:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --write --log-level warn",
        "lint": "biome lint .",
        "lint:biome": "biome ci .",
        "lint:emdash": "git grep -nIP --untracked '\\x{2014}'; test $? -eq 1",
        "lint:md": "git ls-files -z '*.md' | xargs -0 remark --frail --quiet --no-stdout",
        "lint:yaml": "git ls-files -z '*.yaml' '*.yml' | xargs -0 -r prettier --check && git ls-files -z '*.yaml' '*.yml' | xargs -0 -r yamllint --strict",
        "prepare": "test -d node_modules/husky && husky || true",
        "test": "vitest run",
        "typecheck": "tsc",
        "types": "wrangler types --include-runtime=false",
        "types:check": "wrangler types --check --include-runtime=false"
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

`templates/cloudflare/tsconfig.json`:

```json
{
    "$schema": "https://json.schemastore.org/tsconfig.json",
    "compilerOptions": {
        "target": "esnext",
        "module": "nodenext",
        "moduleResolution": "nodenext",
        "strict": true,
        "noEmit": true,
        "erasableSyntaxOnly": true,
        "verbatimModuleSyntax": true,
        "allowImportingTsExtensions": true,
        "types": [
            "node",
            "@cloudflare/workers-types",
            "./worker-configuration.d.ts",
            "@cloudflare/vitest-pool-workers/types"
        ],
        "skipLibCheck": true
    },
    "include": [
        "src",
        "test",
        "vitest.config.ts",
        "worker-configuration.d.ts",
        ".commitlintrc.mts"
    ]
}
```

`templates/cloudflare/.biome.json`:

```json
{
    "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
    "extends": ["@chewygumxx/biome-config"],
    "files": {
        "includes": ["**", "!worker-configuration.d.ts"]
    }
}
```

`templates/cloudflare/_gitignore`:

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

.wrangler/
.dev.vars*
```

`templates/cloudflare/wrangler.jsonc`:

```jsonc
// vim:set expandtab shiftwidth=4 filetype=jsonc:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/wrangler.jsonc
//
//

// https://developers.cloudflare.com/workers/wrangler/configuration/
//
// After changing this file's bindings or vars, run `npm run types`.
{
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "repo-tmpl",
    "main": "src/index.ts",
    // Pinned, and bumped by hand. It cannot be later than the newest date the
    // workerd inside @cloudflare/vitest-pool-workers supports, or the tests
    // will not start: bump it with that package.
    "compatibility_date": "2026-08-15",
    "observability": {
        "enabled": true
    }
}
```

`templates/cloudflare/vitest.config.ts`:

```ts
// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/vitest.config.ts
//
//

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
});
```

`templates/cloudflare/src/index.ts`:

```ts
// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/index.ts
//
//

export default {
    async fetch(request): Promise<Response> {
        const { pathname } = new URL(request.url);
        if (pathname === "/") return new Response("Hello, world!");
        return new Response("Not found", { status: 404 });
    },
} satisfies ExportedHandler<Env>;
```

`templates/cloudflare/test/index.test.ts`:

```ts
// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/test/index.test.ts
//
//

import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("greets the world", async () => {
    const response = await SELF.fetch("https://example.com/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello, world!");
});

it("answers 404 elsewhere", async () => {
    const response = await SELF.fetch("https://example.com/missing");
    expect(response.status).toBe(404);
});
```

`templates/cloudflare/.github/workflows/deploy.yaml`:

```yaml
# vim:set expandtab shiftwidth=4 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.github/workflows/deploy.yaml
#
#

# Deploys the Worker once CI has passed on main, or when run by hand.
#
# Until the repository variable CLOUDFLARE_ACCOUNT_ID and the secret
# CLOUDFLARE_API_TOKEN are set, the job is skipped, which GitHub counts as
# passing. create-repo sets neither: see the README.

name: Deploy

on:
    workflow_run:
        workflows: [CI]
        types: [completed]
        branches: [main]
    workflow_dispatch: {}

permissions:
    contents: read

concurrency:
    group: ${{ github.workflow }}
    cancel-in-progress: false

jobs:
    deploy:
        if: >-
            ${{ vars.CLOUDFLARE_ACCOUNT_ID != '' && (
            github.event_name == 'workflow_dispatch' || (
            github.event.workflow_run.event == 'push' &&
            github.event.workflow_run.conclusion == 'success')) }}
        runs-on: ubuntu-latest

        steps:
            - name: Checkout
              uses: actions/checkout@v7
              with:
                  ref: ${{ github.event.workflow_run.head_sha || github.sha }}
                  persist-credentials: false

            - name: Setup Node and NPM
              uses: jdx/mise-action@v4

            - name: NPM Clean Install
              run: npm ci

            - name: Deploy
              env:
                  CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
              run: npx wrangler deploy
```

`templates/cloudflare/README.md`:

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
description: "Cloudflare Worker Template"
tags:
  - repo
  - template
  - repository
  - cloudflare
  - workers
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.
It adds a Cloudflare Worker in TypeScript, tested in the Workers runtime and
deployed by a workflow once CI passes.

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
- `npm run dev` serves the Worker locally, and `npm run deploy` deploys it.
- `npm test` runs `test/` in the Workers runtime with Vitest and
  `@cloudflare/vitest-pool-workers`.
- `npm run types` regenerates `worker-configuration.d.ts` after a change to the
  bindings or vars in `wrangler.jsonc`; `npm run check` fails when it is stale.
- `npm run check` runs the checks CI runs: the typecheck, the types check, the
  tests, Biome's format and lint checks, Markdown lint, the YAML checks
  (prettier, then yamllint with `@chewygumxx/yamllint-config`) and a check
  that rejects em dashes.
- `npm run format` applies Biome formatting, and prettier's to YAML, which Biome
  does not read.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs commitlint.

## Deploying

`.github/workflows/deploy.yaml` deploys the Worker with `wrangler deploy` after
CI passes on `main`, and when run by hand. It stays skipped, which GitHub counts
as passing, until you set these in the repository's settings:

- the variable `CLOUDFLARE_ACCOUNT_ID`, your Cloudflare account ID
- the secret `CLOUDFLARE_API_TOKEN`, an API token that can edit Workers

`create-repo` sets neither.
````

`templates/cloudflare/worker-configuration.d.ts` is Wrangler's output. Write it
exactly as generated (Wrangler indents with tabs, shown here as spaces; Biome
ignores the file, and the layer's `.editorconfig` allows the tabs):

```ts
/* eslint-disable */
// Generated by Wrangler by running `wrangler types --include-runtime=false` (hash: 3d3fdd145760295159fc1eac24135779)
interface __BaseEnv_Env {
}
declare namespace Cloudflare {
    interface GlobalProps {
        mainModule: typeof import("./src/index");
    }
    interface Env extends __BaseEnv_Env {}
}
interface Env extends __BaseEnv_Env {}
```

- [ ] **Step 4: Add the catalogue entry**

In `lib/templates.js`, add `wranglerName` to the import from `./init.js`, and
above `TEMPLATES` add:

```js
/**
 * A Worker's name is the repository's, and a Worker's name is a lowercase DNS
 * label: 1 to 63 characters of letters, digits and hyphens, not starting or
 * ending with a hyphen. GitHub allows more, so the name is refused, not
 * changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function workerName({ name }) {
    if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) return;
    throw new UsageError(
        `The Worker name "${name}" is not valid: use 1 to 63 lowercase letters, digits and hyphens, not starting or ending with a hyphen.`,
    );
}
```

and after the `typescript` entry add:

```js
    cloudflare: {
        description:
            "A Cloudflare Worker in TypeScript, tested in the Workers runtime, with a deploy workflow",
        family: "npm",
        features: {},
        layers: () => ["common", "npm", "cloudflare"],
        edits: [...NPM_EDITS, wranglerName],
        checkName: workerName,
    },
```

- [ ] **Step 5: Generate the lock; the tests must fail on it first**

Run: `node --test test/templates.test.js`

Expected: FAIL, "cloudflare replaces the npm package..." (no
`package-lock.json` in the layer) and "each layer's lockfile matches its
package.json" with `ENOENT`.

Then run:

```sh
(cd templates/cloudflare && npm install --package-lock-only --no-fund --no-audit)
```

Expected: `templates/cloudflare/package-lock.json` exists; its `name` is
`repo-tmpl`; no `node_modules/` was created. npm may print an
`install-scripts` notice about `esbuild` and `workerd`: ignore it, both run
from their platform packages without a postinstall.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx --no -- biome check --write lib/templates.js test/templates.test.js test/bin.test.js && npm test`

Expected: `# fail 0`. If Biome reports anything in `templates/`, it is
mistaken: the root `.biome.json` excludes `templates/`.

- [ ] **Step 7: Run the template's own check, and probe its guards**

Run:

```sh
rm -rf /tmp/create-repo-cloudflare
node scripts/materialize.js cloudflare /tmp/create-repo-cloudflare
(cd /tmp/create-repo-cloudflare && git init -q . && git add -A \
  && npm ci --no-fund --no-audit && npm run check)
```

Expected: every step passes: `tsc`, `wrangler types --check` ("up to date"),
Vitest ("2 passed", in the Workers runtime), Biome, remark, yamllint, and the
em dash check.

Then, still in `/tmp/create-repo-cloudflare`, prove the stale-types guard:

```sh
sed -i 's/"observability"/"vars": { "A": "b" },\n    "observability"/' wrangler.jsonc
npm run types:check; echo "rc=$?"
git checkout wrangler.jsonc 2>/dev/null || git restore --source=HEAD wrangler.jsonc
npx wrangler deploy --dry-run --outdir /tmp/create-repo-cloudflare-dry
```

Expected: `types:check` reports "out of date" and `rc=1`; after the restore the
dry run prints `Total Upload` and `--dry-run: exiting now.`. Then
`rm -rf /tmp/create-repo-cloudflare /tmp/create-repo-cloudflare-dry`.

- [ ] **Step 8: Whole check, then commit**

Run: `npm run check`

Expected: every step passes, `# fail 0`; `lint:templates` also lints
`.templates/cloudflare`.

```sh
git add templates/cloudflare lib/templates.js test/templates.test.js test/bin.test.js
git commit -m "feat(template): Add the cloudflare template" \
  -m "A Worker in TypeScript, tested in the Workers runtime with Vitest,
deployed by a workflow that stays skipped until CLOUDFLARE_ACCOUNT_ID is
set. The generated types leave out the runtime, whose doc comments hold
em dashes, and the layer replaces .biome.json to ignore them. The
compatibility date is the newest the test runtime supports, not today's."
```

---

### Task 3: Dependabot, the spec and the docs

**Files:**

- Modify: `.github/dependabot.yml`, `README.md`,
  `docs/specs/2026-09-30-multiple-templates-design.md`

**Interfaces:**

- Consumes: the layer of Task 2.
- Produces: nothing later tasks use.

- [ ] **Step 1: Watch the layer's dependencies**

Append to `.github/dependabot.yml`:

```yaml

    - package-ecosystem: npm
      directory: /templates/cloudflare
      schedule:
          interval: weekly
      commit-message:
          prefix: build(template)
      ignore:
          # Its majors follow Node's; bumped by hand with the Node floor.
          - dependency-name: "@types/node"
            update-types: ["version-update:semver-major"]
          # @cloudflare/vitest-pool-workers peers on Vitest 4.
          - dependency-name: "vitest"
            update-types: ["version-update:semver-major"]

    - package-ecosystem: github-actions
      directory: /templates/cloudflare
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
git commit -m "ci: Watch the cloudflare layer"
```

- [ ] **Step 3: Amend the spec**

In `docs/specs/2026-09-30-multiple-templates-design.md`:

Replace the `cloudflare` row of the layers table

```text
| `cloudflare`         | Replaces `package.json`, its lock, `tsconfig.json`,      |
|                      | `_gitignore` and `README.md`; adds `wrangler.jsonc`,     |
|                      | `worker-configuration.d.ts`, `vitest.config.ts`,         |
|                      | `src/`, `test/` and the deploy workflow                  |
```

with

```text
| `cloudflare`         | Replaces `package.json`, its lock, `tsconfig.json`,      |
|                      | `.biome.json`, `_gitignore` and `README.md`; adds        |
|                      | `wrangler.jsonc`, `worker-configuration.d.ts`,           |
|                      | `vitest.config.ts`, `src/`, `test/` and the deploy       |
|                      | workflow                                                 |
```

and replace the whole "### cloudflare" section (from its heading to the line
before "## Native family") with:

```markdown
### cloudflare

`common`, `npm`, `cloudflare`. The `typescript` layer is left out: the
`cloudflare` layer replaces all of it, and its `src/index.test.ts` would fail
against the Worker's `src/index.ts`, since no layer deletes.

- `wrangler.jsonc`: `name` is the Worker name, `main` is `src/index.ts`,
  `compatibility_date` is pinned by hand to no later than the newest date the
  workerd of `@cloudflare/vitest-pool-workers` supports, and
  `observability.enabled` is `true`.
- `src/index.ts` is a typed `fetch` handler. `worker-configuration.d.ts` is
  generated by `wrangler types --include-runtime=false` and committed; the
  runtime types come from `@cloudflare/workers-types`, since the full file is
  600 KB with em dashes in its comments.
- `test/index.test.ts` runs in the Workers runtime through `vitest` (4, the
  range the pool peers on) and `@cloudflare/vitest-pool-workers`.
- `package.json` adds `dev`, `deploy`, `types` and `types:check`; `check` runs
  `wrangler types --check` (`types:check`) so it fails when
  `worker-configuration.d.ts` is stale, then `vitest run`.
- `.biome.json` ignores `worker-configuration.d.ts`; `_gitignore` adds
  `.wrangler/` and `.dev.vars*`.
- `.github/workflows/deploy.yaml` runs on `workflow_run` of CI completing on
  `main`, and on `workflow_dispatch`. Its job requires a `push` CI run that
  succeeded (or a manual run) and `vars.CLOUDFLARE_ACCOUNT_ID != ''`, so until
  that variable and the `CLOUDFLARE_API_TOKEN` secret are set by hand it is
  skipped, which GitHub counts as passing. It runs mise, `npm ci`, then
  `npx wrangler deploy`, so the lock pins Wrangler. The README explains the
  variable and secret; `create-repo` sets neither.

```

Run: `npm run lint:md && npm run lint:emdash`

Expected: both exit 0.

- [ ] **Step 4: Describe the template in the README**

In `README.md`, replace the table under "## The templates" with:

```markdown
| Template     | For                                                       |
| ------------ | --------------------------------------------------------- |
| `standard`   | Any repository: commit rules, lint and format checks, CI  |
|              | and Claude Code settings                                  |
| `typescript` | A Node library or CLI in TypeScript, run without a build; |
|              | `--with publish` compiles it and publishes it to npm as   |
|              | `@owner/name` by trusted publishing                       |
| `cloudflare` | A Cloudflare Worker in TypeScript, tested in the Workers  |
|              | runtime, with a workflow that deploys it                  |
```

and change the sentence "`common` holds what every repository carries, `npm` the
npm-based checks, `typescript` its sources, and `typescript-publish` what
`--with publish` replaces and adds." so that it ends "... and `typescript-publish`
what `--with publish` replaces and adds, and `cloudflare` the Worker."

Run: `npm run lint:md && npm run lint:emdash`

Expected: both exit 0. If the table's columns are reported misaligned, pad them
to the widest cell.

- [ ] **Step 5: Verify the whole run for real**

Run the tool itself, then the created repository's own check, which proves the
Worker's renamed `wrangler.jsonc` still passes `wrangler types --check`:

```sh
rm -rf /tmp/create-repo-e2e
node bin/create-repo.js my-worker --template cloudflare \
  --description "End to end" --owner example --dir /tmp/create-repo-e2e \
  --no-metadata --dry-run --yes
git -C /tmp/create-repo-e2e log --format=%B -1
git -C /tmp/create-repo-e2e grep -nE 'repo-tmpl|repo_tmpl|is_template|Using this template' \
  || echo "no sentinel"
grep -n '"name"' /tmp/create-repo-e2e/wrangler.jsonc
(cd /tmp/create-repo-e2e && npm run check)
rm -rf /tmp/create-repo-e2e
```

Expected: the run installs, formats and checks the copy and commits once; the
commit body ends `(cloudflare).`; `no sentinel`; `"name": "my-worker"`; and the
created repository's own `npm run check` passes.

- [ ] **Step 6: Whole check, then commit**

Run: `npm run check`

Expected: every step passes, `# fail 0`.

```sh
git add README.md docs/specs/2026-09-30-multiple-templates-design.md
git commit -m "docs: Describe the cloudflare template" \
  -m "The README table gains its row. The spec's cloudflare section now
matches what building it showed: no typescript layer, trimmed generated
types, its own .biome.json, and a compatibility date the test runtime
supports."
```

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
