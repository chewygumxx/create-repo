---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/shared-config.git
  # ::: :/docs/plans/2026-09-29-create-repo.md
  #
  #

ctime: 2026-09-29
title: >-
  Implementation Plan: create-repo
description: ""
tags: []
---

# Implementation Plan: create-repo

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

### Objective

`npm create @chewygumxx/repo` creates a GitHub repository from
`chewygumxx/repo-tmpl` whose first CI run passes, metadata sync included.

### Architecture

A dependency-free Node CLI in shared-config
(`packages/create-repo`) owns preflight, prompts, the private key, the GitHub
calls and their order. The template owns the edits to its own files in
`scripts/init.mjs`, tested by a template-only script and workflow. The
`sync-repo-metadata` action refuses a metadata file whose slug names another
repository.

### Tech Stack

- Node ≥ 22 standard library (`node:util` `parseArgs` and `parseEnv`,
  `node:readline/promises`, `node:child_process`, `node:test`)
- JSDoc checked by `tsc`
- `@biomejs/biome`
- `remark`
- `prettier`
- `yamllint`
- GitHub Actions
- `gh`
- `git`
- `mise`
- `npm`

**Spec:** [`docs/specs/2026-09-29-create-repo-design.md`](../specs/2026-09-29-create-repo-design.md)

## Global Constraints

- Node `>=22` (`engines`). The creator has no npm runtime dependencies;
  `init.mjs` uses repo-tmpl's `jsonc-parser` devDependency and uninstalls it.
- JSONC is only ever read or edited with `jsonc-parser`, never with regexes
  or by stripping comments.
- Every JavaScript file starts with the house header and `// @ts-check`, and
  passes `tsc` with `checkJs`, Biome format and Biome lint.
- Markdown passes remark with the house preset; prose lines stay within 80
  columns.
- YAML passes prettier and yamllint with the house config.
- Commit headers follow commitlint: `type(scope): Sentence case subject`, at
  most 50 characters, one granular commit per step that says "Commit".
- The only scope of `repo-tmpl` is `claude`, so its commits here have no scope.
  Commits to `shared-config` use the `create-repo` scope once Task 3 adds it.
- The private key is never printed, logged, written to disk, or passed to a
  child other than the key command and `gh secret set` (standard input).
- The creator never deletes anything on GitHub.
- Repository names match:
  `/^(?!\.{1,2}$)(?!.*\.(?:git|wiki)$)[A-Za-z0-9._-]{1,100}$/i`
- Owners match: `/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/`
- Topics match: `/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,49}$/`
- Scope names match: `/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,14}$/`
- First commit:
  - Header: `chore: Initialise from template`
  - Body: `Generated from https://github.com/<template>.`
- Push, tag and publish only where a step says so; the user publishes 1.0.0.


## Review Focus

1. **Invalid names or topics after the repository exists.** GitHub rejects a
   bad topic only when the metadata sync runs, after creation. Validate every
   name, topic and scope before anything is created (Task 3 tests).
2. **The key leaking into children or messages.** `npm ci` runs third-party
   install scripts; an error message could echo a bad key. Strip the key
   variables from every child environment and never quote key material in
   errors (Task 4 and Task 5 tests).
3. **Checks run before staging.** `lint:md` and `lint:yaml` read
   `git ls-files`; before `git add` they check nothing, and `xargs` without
   `-r` runs remark on standard input and hangs. Stage before `npm run check`
   (Task 2 workflow, Task 7 dry run).
4. **Descriptions with quotes, colons or more than 80 characters.** They
   must stay valid YAML in the README frontmatter and pass remark in the body.
   A frontmatter value that does not fit on one line within 80 columns is
   written as a `>-` folded scalar. The template test uses such a description
   (Task 2).
5. **No terminal.** In CI or with the key on standard input, the creator must
   fail at once rather than wait on a prompt (Task 3 and Task 5 tests).


---

## File Structure

| Repository    | File                                                              | Responsibility                                      |
| ------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| sync-repo-metadata | `run.js`                                                     | Refuses a metadata file whose slug names another repository |
| `.github`     | `README.md`                                                       | Mentions the slug check                             |
| repo-tmpl     | `scripts/init.mjs`                                                | Rewrites the identity, formats, self-destructs      |
| repo-tmpl     | `scripts/test-init.sh`                                            | Runs init on a copy and asserts the result          |
| repo-tmpl     | `.github/workflows/template.yaml`                                 | Runs `scripts/test-init.sh` in CI                   |
| repo-tmpl     | `tsconfig.json`, `package.json`                                   | Typecheck `scripts/**/*.mjs`; `@types/node`, `jsonc-parser` |
| repo-tmpl     | `README.md`                                                       | "Using this template" leads with `npm create`       |
| shared-config | `packages/create-repo/lib/args.js`                                | Flags into `Options`; validation                    |
| shared-config | `packages/create-repo/lib/key.js`                                 | Env-file, key sources, PEM check, child environment |
| shared-config | `packages/create-repo/lib/run.js`                                 | Child processes                                     |
| shared-config | `packages/create-repo/lib/prompt.js`                              | Prompts into `Answers`, summary, confirmation       |
| shared-config | `packages/create-repo/lib/preflight.js`                           | Tool, login, client ID and target checks            |
| shared-config | `packages/create-repo/bin/create-repo.js`                         | Order of steps and failure reports                  |
| shared-config | `packages/create-repo/test/*.test.js`                             | Unit tests                                          |
| shared-config | `.github/workflows/create-repo.yaml`                              | Dry run against the published template              |
| shared-config | `package.json`, `tsconfig.json`, `.commitlintrc.mts`, `README.md` | `test` script, typecheck paths, scope, table row    |

---

### Task 1: Slug check in sync-repo-metadata

The check lives in the action rather than in `.github`'s workflow, because
the action already parses the file with `jsonc-parser` (`run.js:62`) and
already knows `GITHUB_REPOSITORY`. Every caller of `@v2` gains it, and
`.github` needs only a README sentence.

**Files:**

- Modify: `~/dev/sync-repo-metadata/run.js` (`envParse`, after the parse)
- Modify: `~/dev/sync-repo-metadata/README.md`
- Modify: `~/dev/.github/README.md:7-11`

**Interfaces:**

- Consumes: nothing.
- Produces: `chewygumxx/sync-repo-metadata@v2` exits 1 with
  `[FATAL] <path> describes <slug>, but this is <repository>` before any API
  call when the metadata's `slug` differs from `GITHUB_REPOSITORY`, ignoring
  case. A file without `slug` (it is optional in the schema) is not checked.

- [ ] **Step 1: See a mismatched file get past the parse**

`GITHUB_API_URL` points at a closed port, so nothing reaches GitHub.

```bash
cd ~/dev/sync-repo-metadata
export GITHUB_API_URL=http://127.0.0.1:9 GITHUB_TOKEN=x
export METADATA_PATH=../repo-tmpl/.repo-metadata.jsonc
GITHUB_REPOSITORY=chewygumxx/other node run.js; echo "rc=$?"
```

Expected: no `describes` message; the run gets past `envParse` and fails
later, on the schema fetch or the API call.

- [ ] **Step 2: Add the check**

In `run.js`, after the `parseErrors` block in `envParse` and before its
`return`:

```javascript
// A metadata file copied from another repository, or left over from a
// rename, would otherwise apply that repository's settings here.
if (
    metadata.slug !== undefined &&
    String(metadata.slug).toLowerCase() !== slug.toLowerCase()
) {
    console.error(
        `[FATAL] ${metadataPath} describes ${metadata.slug}, but this is ${slug}`,
    );
    process.exit(1);
}
```

- [ ] **Step 3: See it refuse the mismatch and accept the match**

```bash
GITHUB_REPOSITORY=chewygumxx/other node run.js; echo "rc=$?"
GITHUB_REPOSITORY=ChewyGumXX/Repo-Tmpl node run.js 2>&1 | grep -c describes
```

Expected: the first prints
`[FATAL] ../repo-tmpl/.repo-metadata.jsonc describes chewygumxx/repo-tmpl, but this is chewygumxx/other`
and `rc=1`; the second prints `0`.

- [ ] **Step 4: Lint and commit**

```bash
npx --no -- eslint run.js
git add run.js
git commit -m "feat: Refuse metadata for another repository"
```

- [ ] **Step 5: Document it**

In `README.md`, after the paragraph describing what the action applies, add:

```markdown
The action refuses a metadata file whose `slug` names another repository,
ignoring case, so a file copied from another repository or left over from a
rename cannot apply that repository's settings. A file without `slug` is not
checked.
```

```bash
git add README.md
git commit -m "docs: Note slug check"
```

- [ ] **Step 6: Release 2.1.0 (with approval)**

Ask before pushing. Then:

```bash
npm version minor --no-git-tag-version
git add package.json package-lock.json
git commit -m "build: Release 2.1.0"
git push origin main
git tag v2.1.0 && git push origin v2.1.0
git tag -f v2 && git push -f origin v2
```

- [ ] **Step 7: Mention it in `.github`**

In `~/dev/.github/README.md`, replace the sentence ending
"`workflow_dispatch`." in the Standard workflow paragraph so the paragraph
reads:

```markdown
Most repositories need only `standard.yaml`. It lints commit messages, syncs
file headers, then runs the generic lint and format checks against the synced
commit, and applies `.repo-metadata.jsonc` on every push to the default branch
or `workflow_dispatch`, refusing a file whose `slug` names another
repository. Each part has a boolean input to switch it off, such as
`metadata-sync: false` for a repository without the metadata App.
```

`.github` has no npm tooling yet, so check it with shared-config's remark,
piping the file in so shared-config's own settings apply:

```bash
cd ~/dev/.github
(cd ~/dev/shared-config && npx --no -- remark --frail --quiet --no-stdout) < README.md
git add README.md
git commit -m "docs: Note metadata slug check"
git push origin main
```

`v1` does not move: no workflow changed.

- [ ] **Step 8: Confirm a caller still passes**

```bash
gh workflow run ci.yaml -R chewygumxx/repo-tmpl
sleep 10
run_id="$(gh run list \
    -R chewygumxx/repo-tmpl \
    -w CI \
    -L 1 \
    --json databaseId \
    -q '.[0].databaseId')"
gh run watch -R chewygumxx/repo-tmpl "$run_id" --exit-status
```

Expected: the run succeeds, `Apply Metadata` included.

---

### Task 2: repo-tmpl `scripts/init.mjs` and its test

**Files:**

| Operation | Paths                                                                |
| --------- | -------------------------------------------------------------------- |
| Create    | `~/dev/repo-tmpl/scripts/init.mjs`                                   |
| Create    | `~/dev/repo-tmpl/scripts/test-init.sh`                               |
| Create    | `~/dev/repo-tmpl/.github/workflows/template.yaml`                    |
| Modify    | `~/dev/repo-tmpl/tsconfig.json`                                      |
| Modify    | `~/dev/repo-tmpl/package.json` (`@types/node`, `jsonc-parser`)       |
| Modify    | `~/dev/repo-tmpl/README.md:29-55` ("Using this template")            |

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `node scripts/init.mjs --owner <owner> --name <name> --description <text>
    [--topics a,b] [--scopes name[:Full Name],...]`, run from anywhere inside
    a fresh copy after `npm ci`. Exit 0 on success; on failure prints
    `init: <what> not found` or `init: invalid ...` and exits 1. Task 7 calls
    it with exactly these flags.
  - `scripts/test-init.sh`: copies the repository it lives in, runs init with
    sample values, stages, checks, commits and asserts the result. Exit 0 and
    the copy removed on success; otherwise exit 1 and the copy's path printed.

- [ ] **Step 1: Write the test script and its workflow first**

`scripts/test-init.sh`:

```bash
#!/usr/bin/env bash
# vim:set expandtab shiftwidth=4 filetype=bash:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/scripts/test-init.sh
#
#

# Runs scripts/init.mjs on a copy of this repository, as
# `npm create @chewygumxx/repo` does, then stages, checks, commits and
# asserts the result. The copy is removed when everything passes, unless
# KEEP is set, and kept for inspection otherwise. Template-only: init deletes
# this script.
#
# The description has quotes, a colon and more than 80 characters, so the
# README frontmatter's folded scalar and the body wrapping are exercised.

set -euo pipefail

src=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
tmp=$(mktemp -d)
derived=$tmp/derived

# shellcheck disable=SC2329 # Invoked by the trap below.
cleanup() {
    local rc=$?
    if ((rc == 0)) && [[ -z ${KEEP:-} ]]; then
        rm -rf -- "$tmp"
    else
        printf 'kept: %s\n' "$derived" >&2
    fi
}
trap cleanup EXIT

mkdir -- "$derived"

# Tracked and untracked files, not ignored ones, so a script not yet
# committed is tested too. node_modules and .husky/_ are ignored.
(
    cd -- "$src"
    git ls-files -z --cached --others --exclude-standard |
        xargs -0r cp -P --parents -t "$derived"
)

cd -- "$derived"
git init -q -b main

# Trust only this throwaway path, without touching mise's state directory,
# and put its pinned tools on PATH for everything below, git hooks included.
export MISE_TRUSTED_CONFIG_PATHS=$derived
eval "$(mise env --shell bash)"

npm ci --silent

node scripts/init.mjs \
    --owner example \
    --name derived-repo \
    --description 'Tests "init": a description with quotes, a colon and enough words to wrap past eighty columns.' \
    --topics alpha,beta \
    --scopes 'api,cli:Command Line'

# Staged first: lint:md and lint:yaml read `git ls-files`.
git add --all
npm run check
git -c user.name="Template Test" \
    -c user.email=template-test@users.noreply.github.com \
    commit -q \
    -m "chore: Initialise from template" \
    -m "Generated from https://github.com/chewygumxx/repo-tmpl."

status=0
fail() {
    printf 'test-init: %s\n' "$1" >&2
    status=1
}

if git grep -n -e repo-tmpl -e is_template -e 'Using this template' |
    grep -v '~chewygumxx/repo-tmpl.git'; then
    fail "template identity remains"
fi
for path in scripts .github/workflows/template.yaml; do
    [[ ! -e $path ]] || fail "$path was not deleted"
done
[[ ! -e node_modules/jsonc-parser ]] || fail "jsonc-parser is still installed"
grep -q '"slug": "example/derived-repo"' .repo-metadata.jsonc ||
    fail ".repo-metadata.jsonc slug"
node -e '
    const p = require("./package.json");
    const ok = p.name === "derived-repo" &&
        p.repository === "github:example/derived-repo" &&
        p.keywords.join() === "alpha,beta" &&
        !("jsonc-parser" in (p.devDependencies ?? {}));
    process.exit(ok ? 0 : 1);
' || fail "package.json identity"
grep -qx 'description: >-' README.md || fail "README description scalar"
grep -qx '# derived-repo' README.md || fail "README heading"
grep -q 'fullName: "Command Line"' .commitlintrc.mts ||
    fail ".commitlintrc.mts scopes"

printf 'test-init: %s\n' "$( ((status == 0)) && echo passed || echo failed)"
exit "$status"
```

The slug is checked with `grep` on the formatted text; nothing here parses
the JSONC.

`.github/workflows/template.yaml`:

```yaml
# vim:set expandtab shiftwidth=4 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.github/workflows/template.yaml
#
#

# Runs scripts/test-init.sh. Template-only: init deletes this workflow along
# with itself, so repositories created from the template never run it.

name: Template

on:
    push:
        branches:
            - main
    pull_request:
    workflow_dispatch: {}

permissions:
    contents: read

jobs:
    init:
        runs-on: ubuntu-latest

        steps:
            - name: Checkout
              uses: actions/checkout@v7
              with:
                  persist-credentials: false

            - name: Setup mise
              uses: jdx/mise-action@v4

            - name: Initialise a Copy
              run: scripts/test-init.sh
```

```bash
cd ~/dev/repo-tmpl
chmod +x scripts/test-init.sh
```

- [ ] **Step 2: Run it and see it fail**

```bash
scripts/test-init.sh; echo "rc=$?"
```

Expected: `Cannot find module '.../scripts/init.mjs'`, `kept: ...` and
`rc=1`.

- [ ] **Step 3: Declare the dependencies and typecheck scripts**

```bash
npm install --save-dev @types/node@^24 jsonc-parser@^3
```

`jsonc-parser` is used only by init, which uninstalls it, so repositories
created from the template do not carry it.

`tsconfig.json` becomes:

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
        "skipLibCheck": true
    },
    "include": [".commitlintrc.mts", "scripts/**/*.mjs"]
}
```

Run: `npx --no -- tsc`. Expected: exit 0 (the pattern matches nothing yet).

- [ ] **Step 4: Write `scripts/init.mjs`**

```javascript
#!/usr/bin/env node
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/scripts/init.mjs
//
//

// @ts-check

// Turns a fresh copy of this template into a new repository: rewrites the
// identity in the files that carry it, uninstalls jsonc-parser, formats, then
// deletes itself, scripts/test-init.sh and the template-only workflow that
// runs it. `npm create @chewygumxx/repo` runs it after `npm ci`; the README
// shows how to run it by hand.
//
// Every edit fails when its target is missing, so a template change this
// script does not know about fails the Template workflow rather than being
// skipped.

import { execFileSync } from "node:child_process";
import {
    readdirSync,
    readFileSync,
    rmdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";

/** @typedef {{ name: string, fullName: string }} Scope */

const NAME = /^(?!\.{1,2}$)(?!.*\.(?:git|wiki)$)[A-Za-z0-9._-]{1,100}$/i;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const TOPIC = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,49}$/;
const SCOPE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,14}$/;

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
    console.error(`init: ${message}`);
    process.exit(1);
}

/** @param {string} text */
function list(text) {
    return text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * @param {string} text `name` or `name:Full Name`, comma separated
 * @returns {Scope[]}
 */
function parseScopes(text) {
    return list(text).map((item) => {
        const [name, ...rest] = item.split(":");
        if (!SCOPE.test(name)) fail(`invalid scope "${name}"`);
        const fullName =
            rest.join(":").trim() ||
            name.charAt(0).toUpperCase() + name.slice(1);
        return { name, fullName };
    });
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
 * @param {[string, unknown][]} changes
 */
function editJsonc(path, changes) {
    let text = readFileSync(path, "utf8");
    /** @type {import("jsonc-parser").ParseError[]} */
    const errors = [];
    const data = parse(text, errors);
    if (errors.length) {
        fail(
            `${path}: ${errors.map((e) => printParseErrorCode(e.error)).join(", ")}`,
        );
    }
    for (const [key, value] of changes) {
        if (!(key in data)) fail(`"${key}" in ${path} not found`);
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
 * @param {string} path
 */
function requireKeys(data, keys, path) {
    for (const key of keys) {
        if (!(key in data)) fail(`"${key}" in ${path} not found`);
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

const { values } = parseArgs({
    options: {
        owner: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        topics: { type: "string", default: "" },
        scopes: { type: "string", default: "" },
    },
});

const { owner, name, description } = values;
if (!owner || !name || !description?.trim()) {
    fail("--owner, --name and --description are required");
}
if (!NAME.test(name)) fail(`invalid repository name "${name}"`);
if (!OWNER.test(owner)) fail(`invalid owner "${owner}"`);
const topics = list(values.topics);
for (const topic of topics) {
    if (!TOPIC.test(topic)) fail(`invalid topic "${topic}"`);
}
const scopes = parseScopes(values.scopes);
const slug = `${owner}/${name}`;

process.chdir(fileURLToPath(new URL("..", import.meta.url)));

editJsonc(".repo-metadata.jsonc", [
    ["name", name],
    ["owner", owner],
    ["slug", slug],
    ["description", description],
    ["topics", topics],
    ["is_template", undefined],
]);

editJson("package.json", (data) => {
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

editJson("package-lock.json", (data) => {
    requireKeys(data, ["name", "packages"], "package-lock.json");
    requireKeys(data.packages, [""], "package-lock.json packages");
    data.name = name;
    data.packages[""].name = name;
});

editText("README.md", (text) => {
    const today = new Date().toISOString().slice(0, 10);
    const tags = topics.length
        ? `tags:\n${topics.map((topic) => `  - ${topic}\n`).join("")}`
        : "tags: []\n";
    // An entry is its key line plus any more-indented continuation lines,
    // so a folded scalar is replaced whole.
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
        () => `# ${name}\n\n${wrap(description)}\n\n`,
        'the heading, intro and "Using this template" in README.md',
    );
});

if (scopes.length) {
    editText(".commitlintrc.mts", (text) =>
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

// jsonc-parser is already loaded, so it can go before the script ends.
execFileSync("npm", ["uninstall", "--silent", "jsonc-parser"], {
    stdio: "inherit",
});
execFileSync("npm", ["run", "--silent", "format"], { stdio: "inherit" });

rmSync("scripts/init.mjs");
rmSync("scripts/test-init.sh");
rmSync(".github/workflows/template.yaml");
if (readdirSync("scripts").length === 0) rmdirSync("scripts");
```

The `tags` pattern and the `.commitlintrc.mts` pattern match YAML and
TypeScript, not JSONC, so they stay as text edits.

- [ ] **Step 5: Run the test again and see it pass**

```bash
scripts/test-init.sh; echo "rc=$?"
```

Expected: `test-init: passed` and `rc=0`. Then
`KEEP=1 scripts/test-init.sh` prints the copy's path; its README frontmatter
has a quoted `title`, `description: >-` with the text wrapped under two
spaces, and `tags:` with `alpha` and `beta`.

- [ ] **Step 6: Check init fails loudly on template drift and bad input**

```bash
drift=$(mktemp -d)
git ls-files -z --cached --others --exclude-standard |
    xargs -0r cp -P --parents -t "$drift"
cp -r node_modules "$drift"/
cd "$drift"
sed -i 's/"slug"/"repo_slug"/' .repo-metadata.jsonc
node scripts/init.mjs --owner example --name d --description x; echo "rc=$?"
node scripts/init.mjs --owner example --name "bad name" --description x; echo "rc=$?"
node scripts/init.mjs --owner example --name d.git --description x; echo "rc=$?"
node scripts/init.mjs --owner some_user --name d --description x; echo "rc=$?"
node scripts/init.mjs --owner example --name d --description x --topics Bad_Topic; echo "rc=$?"
cd ~/dev/repo-tmpl && rm -rf -- "$drift"
```

Expected, each with `rc=1`: `init: "slug" in .repo-metadata.jsonc not found`,
`init: invalid repository name "bad name"`,
`init: invalid repository name "d.git"`, `init: invalid owner "some_user"`,
`init: invalid topic "Bad_Topic"`.

- [ ] **Step 7: Lint and commit**

```bash
cd ~/dev/repo-tmpl
npm run check
git add package.json package-lock.json tsconfig.json
git commit -m "build: Add Node types and jsonc-parser"
git add scripts/init.mjs
git commit -m "feat: Add init script for new repositories"
git add scripts/test-init.sh .github/workflows/template.yaml
git commit -m "ci: Test init script on a template copy"
```

- [ ] **Step 8: Rewrite "Using this template"**

Replace the section in `README.md` (from `## Using this template` up to
`## CI`) with:

````markdown
## Using this template

Create a repository from this template with
[`npm create @chewygumxx/repo`](https://github.com/chewygumxx/shared-config/tree/main/packages/create-repo):

```sh
npm create @chewygumxx/repo my-thing
```

It asks for the description, topics and commit scopes, then creates the
GitHub repository, sets its metadata App variable and secret, and pushes a
first commit whose CI passes. Its README lists the flags and where it reads
the App's private key.

To do the same by hand:

1. Copy the template without its history, and install the toolchain and
   dependencies. This also wires the husky git hooks.

   ```sh
   git clone --depth 1 https://github.com/chewygumxx/repo-tmpl.git my-thing
   cd my-thing && rm -rf .git && git init -b main
   mise install
   npm ci
   ```

2. Rewrite the identity in `.repo-metadata.jsonc`, `package.json`, the
   lockfile, this README and `.commitlintrc.mts`. The script deletes itself
   and the template's own test workflow.

   ```sh
   node scripts/init.mjs --owner <owner> --name my-thing \
       --description "…" --topics a,b --scopes api,"cli:Command Line"
   ```

3. Commit, then create the repository without pushing.

   ```sh
   git add --all && npm run check
   git commit -m "chore: Initialise from template"
   gh repo create <owner>/my-thing --public --description "…" \
       --source . --remote origin
   ```

4. Store the metadata GitHub App's client ID as the `METADATA_APP_CLIENT_ID`
   variable and its private key as the `METADATA_APP_PRIVATE_KEY` secret. The
   App needs repository permission "Administration: Read and write" and must
   be installed on the repository; see the comment in
   [`sync-repo-metadata.yaml`](https://github.com/chewygumxx/.github/blob/main/.github/workflows/sync-repo-metadata.yaml).
   A repository without the App passes `metadata-sync: false` to the standard
   workflow instead.

5. Push: `git push -u origin main`. The first CI run applies
   `.repo-metadata.jsonc` to the repository settings.

File headers (`~owner/repo.git` and the `::: :/path` line) are kept current by
the header sync in CI and do not need editing by hand.
````

Run: `npx --no -- remark README.md --frail --quiet --no-stdout`.
Expected: exit 0.
Then rerun `scripts/test-init.sh` to confirm init still removes the
rewritten section.

- [ ] **Step 9: Commit and push**


```bash
git add README.md
git commit -m "docs: Lead with npm create in README"
git push origin main
sleep 10
run_id="$(gh run list \
    -R chewygumxx/repo-tmpl \
    -w Template \
    -c "$(git rev-parse HEAD)" \
    -L 1 \
    --json databaseId \
    -q '.[0].databaseId')"
gh run watch -R chewygumxx/repo-tmpl "$run_id" --exit-status
```

Expected: the Template run succeeds; CI also succeeds on the same commit.

---

### Task 3: create-repo package and `lib/args.js`

**Files:**


| Operation | Paths                                                               |
| --------- | ------------------------------------------------------------------- |
| Create    | `packages/create-repo/package.json`, `packages/create-repo/LICENSE` |
| Create    | `packages/create-repo/lib/args.js`                                  |
| Test      | `packages/create-repo/test/args.test.js`                            |
| Modify    | `package.json` (`test` script, `check`, `@types/node`)              |
| Modify    | `tsconfig.json` (`include`)                                         |
| Modify    | `.commitlintrc.mts` (scope `create-repo`)                           |

**Interfaces:**


- Consumes: nothing.
- Produces (`lib/args.js`):
  - `class UsageError extends Error`: a mistake by the caller; the CLI prints
    its message and exits 2.
  - `const DEFAULT_TEMPLATE = "chewygumxx/repo-tmpl"`
  - `typedef Scope = { name: string, fullName: string }`
  - `typedef Options`:

    ```ts
    type Options = {
        name?: string;
        description?: string;
        topics?: string[];
        scopes?: Scope[];
        owner?: string;
        visibility: "public" | "private";
        dir?: string;
        template: string;
        envFile?: string;
        metadataKeyFile?: string;
        metadataKeyCommand?: string;
        metadata: boolean;
        dryRun: boolean;
        yes: boolean;
        help: boolean;
    };
    ```

  - `parseOptions(argv: string[]): Options`: throws `UsageError`
  - `checkName(name: string): string`: throws `UsageError`
  - `parseTopics(text: string): string[]`: throws `UsageError`
  - `parseScopes(text: string): Scope[]`: throws `UsageError`
  - `formatScopes(scopes: Scope[]): string`: `name:Full Name,...`, the form
    init's `--scopes` reads

- [ ] **Step 1: Scaffold the package and wire tests**

`packages/create-repo/package.json`:

```json
{
    "name": "@chewygumxx/create-repo",
    "version": "1.0.0",
    "description": "Creates a repository from chewygumxx/repo-tmpl: npm create @chewygumxx/repo",
    "keywords": ["create", "template", "repository"],
    "license": "GPL-3.0-only",
    "homepage": "https://github.com/chewygumxx/shared-config/tree/main/packages/create-repo#readme",
    "repository": {
        "type": "git",
        "url": "git+https://github.com/chewygumxx/shared-config.git",
        "directory": "packages/create-repo"
    },
    "type": "module",
    "bin": {
        "create-repo": "bin/create-repo.js"
    },
    "files": ["bin", "lib"],
    "engines": {
        "node": ">=22"
    },
    "publishConfig": {
        "access": "public",
        "provenance": true
    }
}
```

```bash
cd ~/dev/shared-config
cp packages/yamllint-config/LICENSE packages/create-repo/LICENSE
npm install --save-dev @types/node@^24
npm pkg set scripts.test="node --test 'packages/*/test/*.test.js'"
npm pkg set scripts.check="$(npm pkg get scripts.check | tr -d '"') && npm run test"
```

`tsconfig.json` `include` becomes:

```json
    "include": [
        ".commitlintrc.mts",
        "packages/*/*.js",
        "packages/*/*.d.ts",
        "packages/*/bin/*.js",
        "packages/*/lib/*.js",
        "packages/*/test/*.js"
    ]
```

Append to the `scopes` in `.commitlintrc.mts`:

```typescript
        {
            name: "create-repo",
            fullName: "create-repo",
            description: "@chewygumxx/create-repo",
        },
```

Run `npm install` so the workspace links, then commit:


```bash
npm run format
git add \
    package.json \
    package-lock.json \
    tsconfig.json \
    .commitlintrc.mts \
    packages/create-repo/package.json \
    packages/create-repo/LICENSE
git commit -m "build(create-repo): Scaffold create-repo package"
```

- [ ] **Step 2: Write the failing tests**

`packages/create-repo/test/args.test.js`:

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/args.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import {
    DEFAULT_TEMPLATE,
    checkName,
    formatScopes,
    parseOptions,
    parseScopes,
    parseTopics,
    UsageError,
} from "../lib/args.js";

test("reads the name and every flag", () => {
    const options = parseOptions([
        "my-thing",
        "--description",
        "D",
        "--topics",
        "a, b",
        "--scopes",
        "api,cli:Command Line",
        "--owner",
        "someone",
        "--private",
        "--dir",
        "here",
        "--template",
        "someone/tmpl",
        "--env-file",
        "e.env",
        "--metadata-key-command",
        "pass show k",
        "--dry-run",
        "--yes",
    ]);
    assert.deepEqual(options, {
        name: "my-thing",
        description: "D",
        topics: ["a", "b"],
        scopes: [
            { name: "api", fullName: "Api" },
            { name: "cli", fullName: "Command Line" },
        ],
        owner: "someone",
        visibility: "private",
        dir: "here",
        template: "someone/tmpl",
        envFile: "e.env",
        metadataKeyFile: undefined,
        metadataKeyCommand: "pass show k",
        metadata: true,
        dryRun: true,
        yes: true,
        help: false,
    });
});

test("defaults leave prompted values undefined", () => {
    const options = parseOptions([]);
    assert.equal(options.name, undefined);
    assert.equal(options.topics, undefined);
    assert.equal(options.visibility, "public");
    assert.equal(options.template, DEFAULT_TEMPLATE);
    assert.equal(options.metadata, true);
    assert.equal(options.yes, false);
});

test("--no-metadata switches the metadata off", () => {
    assert.equal(parseOptions(["--no-metadata"]).metadata, false);
});

test("an empty --topics is an empty list, not a prompt", () => {
    assert.deepEqual(parseOptions(["--topics", ""]).topics, []);
});

test("accepts the names GitHub accepts", () => {
    for (const name of [".github", "a_b.c", "my--repo", "x".repeat(100)]) {
        assert.equal(checkName(name), name);
    }
});

test("rejects mistakes before anything is created", () => {
    for (const argv of [
        ["a", "b"],
        ["--unknown"],
        ["my thing"],
        ["a/b"],
        [".."],
        ["x.git"],
        ["x".repeat(101)],
        ["--topics", "Bad_Topic"],
        ["--topics", "x".repeat(51)],
        ["--scopes", "Api"],
        ["--owner", "-bad"],
        ["--owner", "some_user"],
        ["--topics", "a--b"],
        ["--scopes", "x".repeat(16)],
        ["--template", "no-slash"],
    ]) {
        assert.throws(() => parseOptions(argv), UsageError, argv.join(" "));
    }
});

test("the key on standard input needs the name, description and --yes", () => {
    assert.throws(
        () => parseOptions(["x", "--metadata-key-file", "-", "--yes"]),
        /--description/,
    );
    assert.throws(
        () =>
            parseOptions([
                "x",
                "--description",
                "D",
                "--metadata-key-file",
                "-",
            ]),
        /--yes/,
    );
    const options = parseOptions([
        "x",
        "--description",
        "D",
        "--metadata-key-file",
        "-",
        "--yes",
    ]);
    assert.equal(options.metadataKeyFile, "-");
});

test("scopes round-trip through the form init reads", () => {
    const scopes = parseScopes("api, cli:Command Line");
    assert.deepEqual(parseScopes(formatScopes(scopes)), scopes);
    assert.equal(formatScopes(scopes), "api:Api,cli:Command Line");
});

test("topics trim and drop empty items", () => {
    assert.deepEqual(parseTopics(" a ,, b "), ["a", "b"]);
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `npm run test`
Expected: FAIL, `Cannot find module '.../lib/args.js'`.

- [ ] **Step 4: Write `lib/args.js`**

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/args.js
//
//

// @ts-check

import { parseArgs } from "node:util";

/** @typedef {{ name: string, fullName: string }} Scope */

/**
 * The command line, with prompted values left undefined when not given.
 * @typedef {object} Options
 * @property {string} [name]
 * @property {string} [description]
 * @property {string[]} [topics]
 * @property {Scope[]} [scopes]
 * @property {string} [owner]
 * @property {"public" | "private"} visibility
 * @property {string} [dir]
 * @property {string} template
 * @property {string} [envFile]
 * @property {string} [metadataKeyFile]
 * @property {string} [metadataKeyCommand]
 * @property {boolean} metadata
 * @property {boolean} dryRun
 * @property {boolean} yes
 * @property {boolean} help
 */

/** A mistake by the caller, reported without a stack trace. */
export class UsageError extends Error {}

export const DEFAULT_TEMPLATE = "chewygumxx/repo-tmpl";

// Keep in step with repo-tmpl's scripts/init.mjs.
const NAME = /^(?!\.{1,2}$)(?!.*\.(?:git|wiki)$)[A-Za-z0-9._-]{1,100}$/i;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const TOPIC = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,49}$/;
const SCOPE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,14}$/;

/** @param {string} text */
function list(text) {
    return text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

/** @param {string} name */
export function checkName(name) {
    if (!NAME.test(name)) {
        throw new UsageError(
            `Invalid repository name "${name}": use letters, digits, ".", "-" and "_", not ending in ".git" or ".wiki".`,
        );
    }
    return name;
}

/** @param {string} owner */
function checkOwner(owner) {
    if (!OWNER.test(owner)) {
        throw new UsageError(`Invalid owner "${owner}".`);
    }
    return owner;
}

/** @param {string} template */
function checkTemplate(template) {
    const [owner, name, ...rest] = template.split("/");
    if (rest.length || !owner || !name) {
        throw new UsageError(`Invalid template "${template}": use owner/name.`);
    }
    checkOwner(owner);
    checkName(name);
    return template;
}

/** @param {string} text */
export function parseTopics(text) {
    const topics = list(text);
    for (const topic of topics) {
        if (!TOPIC.test(topic)) {
            throw new UsageError(
                `Invalid topic "${topic}": lowercase letters, digits and "-", starting with a letter or digit, at most 50 characters.`,
            );
        }
    }
    return topics;
}

/**
 * @param {string} text `name` or `name:Full Name`, comma separated
 * @returns {Scope[]}
 */
export function parseScopes(text) {
    return list(text).map((item) => {
        const [name, ...rest] = item.split(":");
        if (!SCOPE.test(name)) {
            throw new UsageError(
                `Invalid scope "${name}": lowercase letters, digits and "-".`,
            );
        }
        const fullName =
            rest.join(":").trim() ||
            name.charAt(0).toUpperCase() + name.slice(1);
        return { name, fullName };
    });
}

/** @param {Scope[]} scopes */
export function formatScopes(scopes) {
    return scopes.map((scope) => `${scope.name}:${scope.fullName}`).join(",");
}

/**
 * @param {string[]} argv the arguments after the program name
 * @returns {Options}
 */
export function parseOptions(argv) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                description: { type: "string" },
                topics: { type: "string" },
                scopes: { type: "string" },
                owner: { type: "string" },
                private: { type: "boolean", default: false },
                dir: { type: "string" },
                template: { type: "string", default: DEFAULT_TEMPLATE },
                "env-file": { type: "string" },
                "metadata-key-file": { type: "string" },
                "metadata-key-command": { type: "string" },
                "no-metadata": { type: "boolean", default: false },
                "dry-run": { type: "boolean", default: false },
                yes: { type: "boolean", short: "y", default: false },
                help: { type: "boolean", short: "h", default: false },
            },
        });
    } catch (error) {
        throw new UsageError(
            error instanceof Error ? error.message : String(error),
        );
    }
    const { values, positionals } = parsed;
    if (positionals.length > 1) {
        throw new UsageError(
            `Expected one repository name, got: ${positionals.join(" ")}.`,
        );
    }
    const name = positionals[0];
    /** @type {Options} */
    const options = {
        name: name === undefined ? undefined : checkName(name),
        description: values.description,
        topics:
            values.topics === undefined
                ? undefined
                : parseTopics(values.topics),
        scopes:
            values.scopes === undefined
                ? undefined
                : parseScopes(values.scopes),
        owner:
            values.owner === undefined ? undefined : checkOwner(values.owner),
        visibility: values.private ? "private" : "public",
        dir: values.dir,
        template: checkTemplate(values.template),
        envFile: values["env-file"],
        metadataKeyFile: values["metadata-key-file"],
        metadataKeyCommand: values["metadata-key-command"],
        metadata: !values["no-metadata"],
        dryRun: values["dry-run"],
        yes: values.yes,
        help: values.help,
    };
    if (options.metadataKeyFile === "-") {
        if (!options.name || !options.description) {
            throw new UsageError(
                "With --metadata-key-file -, pass the name and --description too: standard input carries the key, so nothing can be prompted.",
            );
        }
        if (!options.yes) {
            throw new UsageError(
                "With --metadata-key-file -, pass --yes: standard input carries the key, so nothing can be confirmed.",
            );
        }
    }
    return options;
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm run test && npx --no -- tsc && npx --no -- biome check packages/create-repo`
Expected: all tests pass; tsc and Biome exit 0.

- [ ] **Step 6: Commit**


```bash
git add \
    packages/create-repo/lib/args.js \
    packages/create-repo/test/args.test.js
git commit -m "feat(create-repo): Parse and validate flags"
```

---

### Task 4: `lib/key.js`

**Files:**

- Create: `packages/create-repo/lib/key.js`
- Test: `packages/create-repo/test/key.test.js`

**Interfaces:**

- Consumes: `UsageError`, `Options` from `lib/args.js`.
- Produces:
  - `DEFAULT_ENV_FILE: string`: `~/.config/chewygumxx/create-repo.env`
  - `KEY_VARIABLES: string[]`: the three variables never passed to children
  - `loadEnvFile(env: NodeJS.ProcessEnv, path: string | undefined, read?:
(path: string) => string): void`
  - `typedef KeySources = { readStdin: () => Promise<string>, readFile:
(path: string) => string, runCommand: (command: string) =>
Promise<string> }`
  - `resolveKey(options: Options, env: NodeJS.ProcessEnv, sources:
KeySources): Promise<{ key: string, source: string }>`
  - `checkPem(key: string, source: string): void`
  - `childEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv`

- [ ] **Step 1: Write the failing tests**

`packages/create-repo/test/key.test.js`:

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/key.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions, UsageError } from "../lib/args.js";
import {
    childEnv,
    DEFAULT_ENV_FILE,
    loadEnvFile,
    resolveKey,
} from "../lib/key.js";

const PEM =
    "-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----\n";
const OTHER = PEM.replace("MIIB", "MIIC");

/** @param {Record<string, string>} files */
function sources(files = {}) {
    /** @type {string[]} */
    const commands = [];
    return {
        commands,
        readStdin: async () => files["-"] ?? "",
        /** @param {string} path */
        readFile: (path) => {
            if (!(path in files)) {
                throw Object.assign(new Error(`ENOENT: ${path}`), {
                    code: "ENOENT",
                });
            }
            return files[path];
        },
        /** @param {string} command */
        runCommand: async (command) => {
            commands.push(command);
            return files[`$ ${command}`] ?? "";
        },
    };
}

test("--metadata-key-file beats every variable", async () => {
    const found = await resolveKey(
        parseOptions(["--metadata-key-file", "/k.pem"]),
        { METADATA_APP_PRIVATE_KEY: OTHER },
        sources({ "/k.pem": PEM }),
    );
    assert.deepEqual(found, { key: PEM, source: "/k.pem" });
});

test("--metadata-key-file - reads standard input", async () => {
    const options = parseOptions([
        "x",
        "--description",
        "D",
        "--yes",
        "--metadata-key-file",
        "-",
    ]);
    const found = await resolveKey(options, {}, sources({ "-": PEM }));
    assert.equal(found.source, "standard input");
});

test("METADATA_APP_PRIVATE_KEY beats the file variable and command", async () => {
    const found = await resolveKey(
        parseOptions([]),
        {
            METADATA_APP_PRIVATE_KEY: PEM,
            METADATA_APP_PRIVATE_KEY_FILE: "/k.pem",
            CREATE_REPO_METADATA_KEY_COMMAND: "pass show k",
        },
        sources({ "/k.pem": OTHER }),
    );
    assert.equal(found.key, PEM);
});

test("METADATA_APP_PRIVATE_KEY_FILE beats the command", async () => {
    const found = await resolveKey(
        parseOptions([]),
        {
            METADATA_APP_PRIVATE_KEY_FILE: "/k.pem",
            CREATE_REPO_METADATA_KEY_COMMAND: "pass show k",
        },
        sources({ "/k.pem": PEM }),
    );
    assert.equal(found.source, "/k.pem");
});

test("the command flag beats the command variable", async () => {
    const fake = sources({ "$ op read k": PEM });
    const found = await resolveKey(
        parseOptions(["--metadata-key-command", "op read k"]),
        { CREATE_REPO_METADATA_KEY_COMMAND: "pass show k" },
        fake,
    );
    assert.equal(found.key, PEM);
    assert.deepEqual(fake.commands, ["op read k"]);
});

test("no source names every way to give one", async () => {
    await assert.rejects(
        resolveKey(parseOptions([]), {}, sources()),
        (error) =>
            error instanceof UsageError && /--no-metadata/.test(error.message),
    );
});

test("a non-PEM key is refused without quoting it", async () => {
    await assert.rejects(
        resolveKey(
            parseOptions([]),
            { METADATA_APP_PRIVATE_KEY: "hunter2" },
            sources(),
        ),
        (error) =>
            error instanceof UsageError &&
            /METADATA_APP_PRIVATE_KEY/.test(error.message) &&
            !error.message.includes("hunter2"),
    );
});

test("an unreadable key file names the path", async () => {
    await assert.rejects(
        resolveKey(
            parseOptions(["--metadata-key-file", "/missing.pem"]),
            {},
            sources(),
        ),
        (error) =>
            error instanceof UsageError && /\/missing\.pem/.test(error.message),
    );
});

test("the env-file fills gaps without overriding", () => {
    /** @type {NodeJS.ProcessEnv} */
    const env = { KEEP: "mine" };
    loadEnvFile(
        env,
        "e.env",
        () => `KEEP=theirs\nMETADATA_APP_PRIVATE_KEY="${PEM.trim()}"\n`,
    );
    assert.equal(env.KEEP, "mine");
    assert.equal(env.METADATA_APP_PRIVATE_KEY, PEM.trim());
});

test("a missing default env-file is ignored, a missing named one is not", () => {
    const missing = () => {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    };
    /** @type {string[]} */
    const read = [];
    loadEnvFile({}, undefined, (path) => {
        read.push(path);
        return missing();
    });
    assert.deepEqual(read, [DEFAULT_ENV_FILE]);
    assert.throws(() => loadEnvFile({}, "e.env", missing), UsageError);
});

test("children never see the key variables", () => {
    const env = childEnv({
        PATH: "/bin",
        METADATA_APP_PRIVATE_KEY: PEM,
        METADATA_APP_PRIVATE_KEY_FILE: "/k.pem",
        CREATE_REPO_METADATA_KEY_COMMAND: "pass show k",
    });
    assert.deepEqual(env, { PATH: "/bin" });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test`
Expected: FAIL, `Cannot find module '.../lib/key.js'`.

- [ ] **Step 3: Write `lib/key.js`**

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/key.js
//
//

// @ts-check

// The metadata App's private key: where it comes from, what it must look
// like, and keeping it out of every child process that does not need it.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { UsageError } from "./args.js";

/** @typedef {import("./args.js").Options} Options */

/**
 * @typedef {object} KeySources
 * @property {() => Promise<string>} readStdin
 * @property {(path: string) => string} readFile
 * @property {(command: string) => Promise<string>} runCommand
 */

export const DEFAULT_ENV_FILE = join(
    homedir(),
    ".config",
    "chewygumxx",
    "create-repo.env",
);

/** Variables that carry the key or lead to it; never passed to children. */
export const KEY_VARIABLES = [
    "METADATA_APP_PRIVATE_KEY",
    "METADATA_APP_PRIVATE_KEY_FILE",
    "CREATE_REPO_METADATA_KEY_COMMAND",
];

const PEM =
    /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/;

/**
 * Loads `KEY=value` lines into `env`, leaving variables already set alone.
 * The default file is optional; a named one must exist.
 * @param {NodeJS.ProcessEnv} env
 * @param {string | undefined} path `--env-file`, or undefined for the default
 * @param {(path: string) => string} [read]
 */
export function loadEnvFile(env, path, read = (p) => readFileSync(p, "utf8")) {
    const file = path ?? DEFAULT_ENV_FILE;
    let text;
    try {
        text = read(file);
    } catch (error) {
        if (
            path === undefined &&
            /** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT"
        ) {
            return;
        }
        throw new UsageError(
            `Cannot read env-file ${file}: ${/** @type {Error} */ (error).message}`,
        );
    }
    for (const [name, value] of Object.entries(parseEnv(text))) {
        if (env[name] === undefined) env[name] = value;
    }
}

/**
 * @param {string} key
 * @param {string} source where the key came from, for the error only
 */
export function checkPem(key, source) {
    if (!PEM.test(key)) {
        throw new UsageError(
            `The metadata App private key from ${source} is not a PEM private key.`,
        );
    }
}

/**
 * @param {KeySources} sources
 * @param {string} path
 */
function readKeyFile(sources, path) {
    try {
        return sources.readFile(path);
    } catch (error) {
        throw new UsageError(
            `Cannot read the metadata App private key from ${path}: ${/** @type {Error} */ (error).message}`,
        );
    }
}

/**
 * Finds the key: `--metadata-key-file`, then `METADATA_APP_PRIVATE_KEY`, then
 * `METADATA_APP_PRIVATE_KEY_FILE`, then the key command.
 * @param {Options} options
 * @param {NodeJS.ProcessEnv} env
 * @param {KeySources} sources
 * @returns {Promise<{ key: string, source: string }>}
 */
export async function resolveKey(options, env, sources) {
    /** @type {{ key: string, source: string } | undefined} */
    let found;
    const command =
        options.metadataKeyCommand ?? env.CREATE_REPO_METADATA_KEY_COMMAND;
    if (options.metadataKeyFile === "-") {
        found = { key: await sources.readStdin(), source: "standard input" };
    } else if (options.metadataKeyFile !== undefined) {
        found = {
            key: readKeyFile(sources, options.metadataKeyFile),
            source: options.metadataKeyFile,
        };
    } else if (env.METADATA_APP_PRIVATE_KEY) {
        found = {
            key: env.METADATA_APP_PRIVATE_KEY,
            source: "METADATA_APP_PRIVATE_KEY",
        };
    } else if (env.METADATA_APP_PRIVATE_KEY_FILE) {
        found = {
            key: readKeyFile(sources, env.METADATA_APP_PRIVATE_KEY_FILE),
            source: env.METADATA_APP_PRIVATE_KEY_FILE,
        };
    } else if (command) {
        found = {
            key: await sources.runCommand(command),
            source: `the command "${command}"`,
        };
    }
    if (!found) {
        throw new UsageError(
            "No metadata App private key. Pass --metadata-key-file, or set METADATA_APP_PRIVATE_KEY, METADATA_APP_PRIVATE_KEY_FILE or CREATE_REPO_METADATA_KEY_COMMAND (an env-file may set them), or pass --no-metadata.",
        );
    }
    checkPem(found.key, found.source);
    return found;
}

/**
 * A copy of `env` without the key variables, for child processes.
 * @param {NodeJS.ProcessEnv} env
 */
export function childEnv(env) {
    const copy = { ...env };
    for (const name of KEY_VARIABLES) delete copy[name];
    return copy;
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm run test && npx --no -- tsc && npx --no -- biome check packages/create-repo`
Expected: all pass.

- [ ] **Step 5: Commit**


```bash
git add \
    packages/create-repo/lib/key.js \
    packages/create-repo/test/key.test.js
git commit -m "feat(create-repo): Resolve metadata App key"
```

---

### Task 5: `lib/run.js` and `lib/prompt.js`

**Files:**

- Create: `packages/create-repo/lib/run.js`, `packages/create-repo/lib/prompt.js`
- Test: `packages/create-repo/test/run.test.js`,
  `packages/create-repo/test/prompt.test.js`

**Interfaces:**

- Consumes: `Options`, `Scope`, `UsageError`, `checkName`, `parseTopics`,
  `parseScopes` from `lib/args.js`; `childEnv` from `lib/key.js` (tests).
- Produces (`lib/run.js`):
  - `class CommandError extends Error` with `command: string`, `code: number
| null`, `stderr: string`
  - `typedef RunOptions = { cwd?: string, env?: NodeJS.ProcessEnv, input?:
string, capture?: boolean, shell?: boolean }`
  - `run(file: string, args: string[], options?: RunOptions): Promise<{
stdout: string, stderr: string }>`: rejects `CommandError`
- Produces (`lib/prompt.js`):
  - `typedef Ask = (question: string) => Promise<string>`
  - `typedef Answers = { name: string, description: string, topics:
string[], scopes: Scope[], owner: string, visibility: "public" |
"private", dir: string, template: string }`
  - `terminalAsk(input?: NodeJS.ReadStream, output?: NodeJS.WriteStream): Ask
| undefined`: undefined when input is not a terminal
  - `completeAnswers(options: Options, context: { owner: string, ask?: Ask,
warn?: (message: string) => void }): Promise<Answers>`
  - `summary(answers: Answers, flags: { dryRun: boolean, keySource?: string
}): string`
  - `confirm(ask: Ask): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

`packages/create-repo/test/run.test.js`:

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/run.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { childEnv } from "../lib/key.js";
import { CommandError, run } from "../lib/run.js";

const node = process.execPath;

test("captures standard output", async () => {
    const { stdout } = await run(node, ["-e", "process.stdout.write('hi')"], {
        capture: true,
    });
    assert.equal(stdout, "hi");
});

test("writes input to standard input", async () => {
    const { stdout } = await run(
        node,
        ["-e", "process.stdin.pipe(process.stdout)"],
        { input: "secret", capture: true },
    );
    assert.equal(stdout, "secret");
});

test("a failure carries the code and standard error", async () => {
    await assert.rejects(
        run(node, ["-e", "console.error('bad'); process.exit(3)"], {
            capture: true,
        }),
        (error) =>
            error instanceof CommandError &&
            error.code === 3 &&
            /bad/.test(error.stderr),
    );
});

test("a missing program is a CommandError", async () => {
    await assert.rejects(
        run("definitely-not-a-program", [], { capture: true }),
        CommandError,
    );
});

test("a child given childEnv cannot read the key", async () => {
    const { stdout } = await run(
        node,
        [
            "-e",
            "process.stdout.write(String(process.env.METADATA_APP_PRIVATE_KEY))",
        ],
        {
            env: childEnv({ ...process.env, METADATA_APP_PRIVATE_KEY: "k" }),
            capture: true,
        },
    );
    assert.equal(stdout, "undefined");
});
```

`packages/create-repo/test/prompt.test.js`:

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/prompt.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { parseOptions, UsageError } from "../lib/args.js";
import { completeAnswers, confirm, summary } from "../lib/prompt.js";

/** @param {string[]} replies */
function asker(replies) {
    /** @type {string[]} */
    const asked = [];
    return {
        asked,
        /** @param {string} question */
        ask: async (question) => {
            asked.push(question);
            const reply = replies.shift();
            if (reply === undefined) throw new Error(`unexpected: ${question}`);
            return reply;
        },
    };
}

test("prompts for every missing value", async () => {
    const { ask } = asker([
        "my-thing",
        "A thing",
        "a, b",
        "api,cli:Command Line",
    ]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "someone",
        ask,
    });
    assert.deepEqual(answers, {
        name: "my-thing",
        description: "A thing",
        topics: ["a", "b"],
        scopes: [
            { name: "api", fullName: "Api" },
            { name: "cli", fullName: "Command Line" },
        ],
        owner: "someone",
        visibility: "public",
        dir: resolve("my-thing"),
        template: "chewygumxx/repo-tmpl",
    });
});

test("asks again after an invalid reply", async () => {
    /** @type {string[]} */
    const warnings = [];
    const { ask } = asker(["bad name", "good", "", "D", "Bad", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        warn: (message) => warnings.push(message),
    });
    assert.equal(answers.name, "good");
    assert.equal(answers.description, "D");
    assert.deepEqual(answers.topics, []);
    assert.equal(warnings.length, 3);
});

test("flags are never prompted for", async () => {
    const options = parseOptions([
        "x",
        "--description",
        "D",
        "--topics",
        "",
        "--scopes",
        "",
        "--owner",
        "mine",
        "--dir",
        "/tmp/x",
    ]);
    const answers = await completeAnswers(options, {
        owner: "gh-login",
        ask: asker([]).ask,
    });
    assert.equal(answers.owner, "mine");
    assert.equal(answers.dir, "/tmp/x");
});

test("without a terminal, a missing name fails and topics are empty", async () => {
    await assert.rejects(
        completeAnswers(parseOptions([]), { owner: "o" }),
        UsageError,
    );
    const answers = await completeAnswers(
        parseOptions(["x", "--description", "D"]),
        { owner: "o" },
    );
    assert.deepEqual(answers.topics, []);
    assert.deepEqual(answers.scopes, []);
});

test("the summary says what will happen", async () => {
    const answers = await completeAnswers(
        parseOptions([
            "x",
            "--description",
            "D",
            "--private",
            "--scopes",
            "api",
        ]),
        { owner: "o" },
    );
    const text = summary(answers, { dryRun: true });
    assert.match(text, /o\/x \(private\)/);
    assert.match(text, /api \(Api\)/);
    assert.match(text, /Metadata +skipped/);
    assert.match(text, /Dry run/);
    assert.match(
        summary(answers, { dryRun: false, keySource: "/k.pem" }),
        /key from \/k\.pem/,
    );
});

test("confirm accepts only yes", async () => {
    for (const [reply, expected] of [
        ["y", true],
        ["YES", true],
        ["", false],
        ["n", false],
        ["yep", false],
    ]) {
        assert.equal(
            await confirm(asker([/** @type {string} */ (reply)]).ask),
            expected,
        );
    }
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test`
Expected: FAIL, `Cannot find module '.../lib/run.js'` and `.../lib/prompt.js`.

- [ ] **Step 3: Write `lib/run.js`**

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/run.js
//
//

// @ts-check

import { spawn } from "node:child_process";

/**
 * @typedef {object} RunOptions
 * @property {string} [cwd]
 * @property {NodeJS.ProcessEnv} [env]
 * @property {string} [input] written to standard input, otherwise inherited
 * @property {boolean} [capture] collect output instead of showing it
 * @property {boolean} [shell] run `file` through the shell
 */

/** A command that could not start or exited non-zero. */
export class CommandError extends Error {
    /**
     * @param {string} command
     * @param {number | null} code
     * @param {string} stderr
     */
    constructor(command, code, stderr) {
        super(
            `${command} ${code === null ? "could not start" : `exited with ${code}`}${stderr.trim() ? `:\n${stderr.trim()}` : ""}`,
        );
        this.command = command;
        this.code = code;
        this.stderr = stderr;
    }
}

/**
 * @param {string} file
 * @param {string[]} args
 * @param {RunOptions} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function run(file, args, options = {}) {
    const { cwd, env, input, capture = false, shell = false } = options;
    const command = [file, ...args].join(" ");
    return new Promise((resolve, reject) => {
        const child = spawn(file, args, {
            cwd,
            env,
            shell,
            stdio: [
                input === undefined ? "inherit" : "pipe",
                capture ? "pipe" : "inherit",
                capture ? "pipe" : "inherit",
            ],
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.setEncoding("utf8").on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr?.setEncoding("utf8").on("data", (chunk) => {
            stderr += chunk;
        });
        child.on("error", (error) => {
            reject(new CommandError(command, null, error.message));
        });
        child.on("close", (code) => {
            if (code === 0) resolve({ stdout, stderr });
            else reject(new CommandError(command, code, stderr));
        });
        if (input !== undefined) child.stdin?.end(input);
    });
}
```

- [ ] **Step 4: Write `lib/prompt.js`**

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/prompt.js
//
//

// @ts-check

import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { checkName, parseScopes, parseTopics, UsageError } from "./args.js";

/** @typedef {import("./args.js").Options} Options */
/** @typedef {import("./args.js").Scope} Scope */
/** @typedef {(question: string) => Promise<string>} Ask */

/**
 * Everything needed before anything is created.
 * @typedef {object} Answers
 * @property {string} name
 * @property {string} description
 * @property {string[]} topics
 * @property {Scope[]} scopes
 * @property {string} owner
 * @property {"public" | "private"} visibility
 * @property {string} dir absolute
 * @property {string} template
 */

/**
 * Prompts on the terminal, writing questions to standard error so standard
 * output stays clean. Undefined when standard input is not a terminal.
 * @param {NodeJS.ReadStream} [input]
 * @param {NodeJS.WriteStream} [output]
 * @returns {Ask | undefined}
 */
export function terminalAsk(input = process.stdin, output = process.stderr) {
    if (!input.isTTY) return undefined;
    return async (question) => {
        const lines = createInterface({ input, output });
        try {
            return (await lines.question(question)).trim();
        } finally {
            lines.close();
        }
    };
}

/**
 * Asks until `parse` accepts the reply.
 * @template T
 * @param {Ask} ask
 * @param {string} question
 * @param {(reply: string) => T} parse throws UsageError to ask again
 * @param {(message: string) => void} warn
 * @returns {Promise<T>}
 */
async function askUntil(ask, question, parse, warn) {
    for (;;) {
        try {
            return parse(await ask(question));
        } catch (error) {
            if (!(error instanceof UsageError)) throw error;
            warn(error.message);
        }
    }
}

/** @param {string} reply */
function required(reply) {
    if (!reply) throw new UsageError("A description is required.");
    return reply;
}

/**
 * Fills in what the flags left out, prompting when `ask` is given.
 * @param {Options} options
 * @param {{ owner: string, ask?: Ask, warn?: (message: string) => void }} context
 * @returns {Promise<Answers>}
 */
export async function completeAnswers(options, context) {
    const { ask, warn = (message) => console.error(message) } = context;
    /**
     * @template T
     * @param {T | undefined} given
     * @param {string} flag
     * @param {string} question
     * @param {(reply: string) => T} parse
     * @param {T} [fallback] used instead of failing when there is no terminal
     * @returns {Promise<T>}
     */
    const value = async (given, flag, question, parse, fallback) => {
        if (given !== undefined) return given;
        if (ask) return askUntil(ask, question, parse, warn);
        if (fallback !== undefined) return fallback;
        throw new UsageError(
            `Missing ${flag}: pass it as a flag when not running in a terminal.`,
        );
    };
    const name = await value(
        options.name,
        "the repository name",
        "Repository name: ",
        checkName,
    );
    const description = await value(
        options.description,
        "--description",
        "Description: ",
        required,
    );
    const topics = await value(
        options.topics,
        "--topics",
        "Topics (comma separated, may be empty): ",
        parseTopics,
        /** @type {string[]} */ ([]),
    );
    const scopes = await value(
        options.scopes,
        "--scopes",
        "Commit scopes (name or name:Full Name, comma separated, may be empty): ",
        parseScopes,
        /** @type {Scope[]} */ ([]),
    );
    return {
        name,
        description,
        topics,
        scopes,
        owner: options.owner ?? context.owner,
        visibility: options.visibility,
        dir: resolve(options.dir ?? name),
        template: options.template,
    };
}

/**
 * @param {Answers} answers
 * @param {{ dryRun: boolean, keySource?: string }} flags `keySource` is
 *     undefined with --no-metadata
 */
export function summary(answers, { dryRun, keySource }) {
    const rows = [
        [
            "Repository",
            `${answers.owner}/${answers.name} (${answers.visibility})`,
        ],
        ["Description", answers.description],
        ["Topics", answers.topics.join(", ") || "none"],
        [
            "Scopes",
            answers.scopes
                .map((scope) => `${scope.name} (${scope.fullName})`)
                .join(", ") || "none",
        ],
        ["Directory", answers.dir],
        ["Template", answers.template],
        [
            "Metadata",
            keySource
                ? `App key from ${keySource}`
                : "skipped; the metadata sync fails until METADATA_APP_CLIENT_ID and METADATA_APP_PRIVATE_KEY are set",
        ],
    ];
    if (dryRun) rows.push(["Dry run", "nothing is created on GitHub"]);
    return rows
        .map(([label, text]) => `${label.padEnd(12)} ${text}`)
        .join("\n");
}

/** @param {Ask} ask */
export async function confirm(ask) {
    return /^y(?:es)?$/i.test(await ask("Create it? [y/N] "));
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm run test && npx --no -- tsc && npx --no -- biome check packages/create-repo`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/create-repo/lib/run.js packages/create-repo/test/run.test.js
git commit -m "feat(create-repo): Run child processes"
git add packages/create-repo/lib/prompt.js packages/create-repo/test/prompt.test.js
git commit -m "feat(create-repo): Prompt for missing answers"
```

---

### Task 6: `lib/preflight.js`

**Files:**

- Create: `packages/create-repo/lib/preflight.js`
- Test: `packages/create-repo/test/preflight.test.js`

**Interfaces:**

- Consumes: `Options`, `UsageError` (`lib/args.js`); `Answers`
  (`lib/prompt.js`); `CommandError`, `RunOptions` (`lib/run.js`).
- Produces:
  - `typedef Tools = { run: (file: string, args: string[], options?:
RunOptions) => Promise<{ stdout: string, stderr: string }>, exists:
(path: string) => boolean }`
  - `checkTools(options: Options, tools: Tools): Promise<{ login?: string,
clientId?: string }>`
  - `checkTarget(answers: Answers, tools: Tools, flags: { remote: boolean }):
Promise<void>`

- [ ] **Step 1: Write the failing tests**

`packages/create-repo/test/preflight.test.js`:

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/preflight.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions, UsageError } from "../lib/args.js";
import { checkTarget, checkTools } from "../lib/preflight.js";
import { completeAnswers } from "../lib/prompt.js";
import { CommandError } from "../lib/run.js";

/**
 * A fake `run`: each key is "file arg arg"; a string value is its standard
 * output, a CommandError is thrown. Anything else is a missing program.
 * @param {Record<string, string | CommandError>} results
 */
function tools(results, existing = new Set()) {
    /** @type {string[]} */
    const calls = [];
    return {
        calls,
        /**
         * @param {string} file
         * @param {string[]} args
         */
        run: async (file, args) => {
            const key = [file, ...args].join(" ");
            calls.push(key);
            const result = results[key];
            if (result instanceof CommandError) throw result;
            if (result === undefined)
                throw new CommandError(key, null, "ENOENT");
            return { stdout: result, stderr: "" };
        },
        /** @param {string} path */
        exists: (path) => existing.has(path),
    };
}

const present = {
    "git --version": "git version 2",
    "mise --version": "2026.9.0",
    "npm --version": "11",
};
const loggedIn = { ...present, "gh api user --jq .login": "someone\n" };
const clientId = {
    "gh variable get METADATA_APP_CLIENT_ID --repo chewygumxx/repo-tmpl":
        "Iv1.abc\n",
};

test("a missing tool is named", async () => {
    const { "mise --version": _, ...rest } = loggedIn;
    await assert.rejects(
        checkTools(parseOptions([]), tools(rest)),
        (error) => error instanceof UsageError && /mise/.test(error.message),
    );
});

test("gh must be logged in unless dry running", async () => {
    await assert.rejects(
        checkTools(parseOptions([]), tools(present)),
        /gh auth login/,
    );
    assert.deepEqual(
        await checkTools(parseOptions(["--dry-run"]), tools(present)),
        { login: undefined, clientId: undefined },
    );
});

test("the client ID comes from the template's variable", async () => {
    assert.deepEqual(
        await checkTools(parseOptions([]), tools({ ...loggedIn, ...clientId })),
        { login: "someone", clientId: "Iv1.abc" },
    );
});

test("--no-metadata does not read the client ID", async () => {
    const fake = tools(loggedIn);
    assert.deepEqual(await checkTools(parseOptions(["--no-metadata"]), fake), {
        login: "someone",
        clientId: undefined,
    });
    assert.ok(!fake.calls.some((call) => call.includes("variable")));
});

/** @param {string[]} argv */
async function answers(argv) {
    return completeAnswers(parseOptions(argv), { owner: "o" });
}

test("an existing directory or repository stops it", async () => {
    const target = await answers(["x", "--description", "D", "--dir", "/d"]);
    await assert.rejects(
        checkTarget(target, tools({}, new Set(["/d"])), { remote: false }),
        /\/d already exists/,
    );
    await assert.rejects(
        checkTarget(target, tools({ "gh api repos/o/x": "{}" }), {
            remote: true,
        }),
        /o\/x already exists/,
    );
});

test("a 404 means the repository is free; other errors stop it", async () => {
    const target = await answers(["x", "--description", "D", "--dir", "/d"]);
    await checkTarget(
        target,
        tools({
            "gh api repos/o/x": new CommandError(
                "gh api repos/o/x",
                1,
                "gh: Not Found (HTTP 404)",
            ),
        }),
        { remote: true },
    );
    await assert.rejects(
        checkTarget(
            target,
            tools({
                "gh api repos/o/x": new CommandError(
                    "gh api repos/o/x",
                    1,
                    "connection refused",
                ),
            }),
            { remote: true },
        ),
        /Cannot check whether o\/x exists/,
    );
});

test("without remote access the repository is not checked", async () => {
    const target = await answers(["x", "--description", "D", "--dir", "/d"]);
    const fake = tools({});
    await checkTarget(target, fake, { remote: false });
    assert.deepEqual(fake.calls, []);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test`
Expected: FAIL, `Cannot find module '.../lib/preflight.js'`.

- [ ] **Step 3: Write `lib/preflight.js`**

```javascript
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/preflight.js
//
//

// @ts-check

// Checks made before anything is created, so a mistake costs nothing.

import { UsageError } from "./args.js";
import { CommandError } from "./run.js";

/** @typedef {import("./args.js").Options} Options */
/** @typedef {import("./prompt.js").Answers} Answers */
/** @typedef {import("./run.js").RunOptions} RunOptions */

/**
 * @typedef {object} Tools
 * @property {(file: string, args: string[], options?: RunOptions) => Promise<{ stdout: string, stderr: string }>} run
 * @property {(path: string) => boolean} exists
 */

/**
 * Checks the tools and the gh login, and reads the client ID. A dry run
 * needs no login; without one it reads nothing from GitHub.
 * @param {Options} options
 * @param {Tools} tools
 * @returns {Promise<{ login?: string, clientId?: string }>}
 */
export async function checkTools(options, { run }) {
    for (const tool of ["git", "mise", "npm"]) {
        try {
            await run(tool, ["--version"], { capture: true });
        } catch {
            throw new UsageError(`${tool} is required but is not on PATH.`);
        }
    }
    /** @type {string | undefined} */
    let login;
    try {
        login = (
            await run("gh", ["api", "user", "--jq", ".login"], {
                capture: true,
            })
        ).stdout.trim();
    } catch {
        if (!options.dryRun) {
            throw new UsageError(
                "gh is not installed or not logged in: run gh auth login.",
            );
        }
    }
    /** @type {string | undefined} */
    let clientId;
    if (options.metadata && login) {
        try {
            clientId = (
                await run(
                    "gh",
                    [
                        "variable",
                        "get",
                        "METADATA_APP_CLIENT_ID",
                        "--repo",
                        options.template,
                    ],
                    { capture: true },
                )
            ).stdout.trim();
        } catch (error) {
            throw new UsageError(
                `Cannot read METADATA_APP_CLIENT_ID from ${options.template}: ${error instanceof CommandError ? error.stderr.trim() : String(error)}`,
            );
        }
    }
    return { login, clientId };
}

/**
 * Checks that neither the directory nor, with remote access, the repository
 * exists yet.
 * @param {Answers} answers
 * @param {Tools} tools
 * @param {{ remote: boolean }} flags
 */
export async function checkTarget(answers, { run, exists }, { remote }) {
    if (exists(answers.dir)) {
        throw new UsageError(`${answers.dir} already exists.`);
    }
    if (!remote) return;
    const slug = `${answers.owner}/${answers.name}`;
    try {
        await run("gh", ["api", `repos/${slug}`], { capture: true });
    } catch (error) {
        if (
            error instanceof CommandError &&
            /HTTP 404|Not Found/.test(error.stderr)
        ) {
            return;
        }
        throw new UsageError(
            `Cannot check whether ${slug} exists: ${error instanceof CommandError ? error.stderr.trim() : String(error)}`,
        );
    }
    throw new UsageError(`${slug} already exists on GitHub.`);
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm run test && npx --no -- tsc && npx --no -- biome check packages/create-repo`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/create-repo/lib/preflight.js packages/create-repo/test/preflight.test.js
git commit -m "feat(create-repo): Check tools and target first"
```

---

### Task 7: `bin/create-repo.js`, README and the dry-run workflow

**Files:**

- Create: `packages/create-repo/bin/create-repo.js`
- Create: `packages/create-repo/README.md`
- Create: `.github/workflows/create-repo.yaml`
- Modify: `README.md` (table row)

**Interfaces:**

- Consumes: everything above; `scripts/init.mjs` flags from Task 2.
- Produces: the `create-repo` command. Exit 0 on success or cancel, 2 on a
  `UsageError`, 1 on a failed command.

- [ ] **Step 1: Write the dry-run workflow first**

`.github/workflows/create-repo.yaml`:

```yaml
# vim:set expandtab shiftwidth=4 filetype=yaml foldlevel=3:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/shared-config.git
# ::: :/.github/workflows/create-repo.yaml
#
#

# Runs `create-repo --dry-run` against the published template: copy, install,
# init, check and commit for real, with nothing created on GitHub. Catches
# the creator drifting from repo-tmpl, as repo-tmpl's template.yaml catches
# the template drifting from init. gh is not logged in here, so the dry run
# reads nothing from GitHub.

name: Create Repo

on:
    push:
        branches:
            - main
    pull_request:
    workflow_dispatch: {}

permissions:
    contents: read

jobs:
    dry-run:
        runs-on: ubuntu-latest

        steps:
            - name: Checkout
              uses: actions/checkout@v7
              with:
                  persist-credentials: false

            - name: Setup mise
              uses: jdx/mise-action@v4

            - name: Dry Run
              env:
                  GH_TOKEN: ""
              run: |
                  git config --global user.name "create-repo dry run"
                  git config --global user.email "create-repo@users.noreply.github.com"
                  node packages/create-repo/bin/create-repo.js dry-run \
                      --description 'Dry run of "create-repo": the published template, initialised and committed.' \
                      --topics ci \
                      --scopes api \
                      --owner example \
                      --dir "$RUNNER_TEMP/dry-run" \
                      --no-metadata \
                      --dry-run \
                      --yes
                  git -C "$RUNNER_TEMP/dry-run" log --format=%B -1
```

- [ ] **Step 2: Run the dry run locally and see it fail**

```bash
cd ~/dev/shared-config
node packages/create-repo/bin/create-repo.js dry-run --description x --owner example --dir /tmp/cr-dry --no-metadata --dry-run --yes; echo "rc=$?"
```

Expected: `Cannot find module '.../bin/create-repo.js'`, `rc=1`.

- [ ] **Step 3: Write `bin/create-repo.js`**

```javascript
#!/usr/bin/env node
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/bin/create-repo.js
//
//

// @ts-check

// `npm create @chewygumxx/repo`: copies the template, runs its init script,
// checks and commits locally, and only then creates the GitHub repository,
// sets the metadata App variable and secret, and pushes. See the README.

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { formatScopes, parseOptions, UsageError } from "../lib/args.js";
import { childEnv, loadEnvFile, resolveKey } from "../lib/key.js";
import { checkTarget, checkTools } from "../lib/preflight.js";
import {
    completeAnswers,
    confirm,
    summary,
    terminalAsk,
} from "../lib/prompt.js";
import { CommandError, run } from "../lib/run.js";

const USAGE = `Usage: npm create @chewygumxx/repo -- [name] [flags]

  --description <text>           Repository description
  --topics <a,b>                 GitHub topics
  --scopes <name[:Full Name],…>  Commit scopes
  --owner <owner>                Default: the account gh is logged in as
  --private                      Default: public
  --dir <path>                   Default: ./<name>
  --template <owner/name>        Default: chewygumxx/repo-tmpl
  --env-file <path>              Default: ~/.config/chewygumxx/create-repo.env
  --metadata-key-file <path|->   The metadata App private key; - reads stdin
  --metadata-key-command <cmd>   Prints the key; or CREATE_REPO_METADATA_KEY_COMMAND
  --no-metadata                  Set neither the App variable nor its secret
  --dry-run                      Everything local; print the GitHub commands
  -y, --yes                      Do not ask for confirmation
  -h, --help                     Show this help

The key may also come from METADATA_APP_PRIVATE_KEY or
METADATA_APP_PRIVATE_KEY_FILE.`;

/** @param {string} message */
function step(message) {
    console.error(`\n==> ${message}`);
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
async function main(argv) {
    const options = parseOptions(argv);
    if (options.help) {
        console.log(USAGE);
        return 0;
    }

    const env = { ...process.env };
    loadEnvFile(env, options.envFile);
    const children = childEnv(env);
    const tools = { run, exists: existsSync };

    const { login, clientId } = await checkTools(options, tools);
    const key = options.metadata
        ? await resolveKey(options, env, {
              readStdin: () => text(process.stdin),
              readFile: (path) => readFileSync(path, "utf8"),
              runCommand: async (command) =>
                  (await run(command, [], { shell: true, capture: true, env }))
                      .stdout,
          })
        : undefined;

    const ask = options.metadataKeyFile === "-" ? undefined : terminalAsk();
    const owner = options.owner ?? login;
    if (!owner) {
        throw new UsageError(
            "Cannot tell the owner: pass --owner or log in with gh auth login.",
        );
    }
    const answers = await completeAnswers(options, { owner, ask });
    await checkTarget(answers, tools, { remote: login !== undefined });

    console.error(
        `\n${summary(answers, { dryRun: options.dryRun, keySource: key?.source })}\n`,
    );
    if (!options.yes) {
        if (!ask) {
            throw new UsageError(
                "Pass --yes to go ahead without confirmation when not running in a terminal.",
            );
        }
        if (!(await confirm(ask))) {
            console.error("Cancelled; nothing was created.");
            return 0;
        }
    }

    const { dir, template } = answers;
    const slug = `${answers.owner}/${answers.name}`;
    const local = { cwd: dir, env: children };

    try {
        step(`Copying ${template}`);
        await run(
            "git",
            [
                "clone",
                "--quiet",
                "--depth",
                "1",
                `https://github.com/${template}.git`,
                dir,
            ],
            { env: children },
        );
        rmSync(join(dir, ".git"), { recursive: true, force: true });
        await run(
            "git",
            ["init", "--quiet", "--initial-branch", "main"],
            local,
        );

        step("Installing the toolchain and dependencies");
        await run("mise", ["trust", "--quiet"], local);
        await run("mise", ["install"], local);
        await run("npm", ["ci", "--no-fund", "--no-audit"], local);

        step("Initialising");
        await run(
            "node",
            [
                "scripts/init.mjs",
                "--owner",
                answers.owner,
                "--name",
                answers.name,
                "--description",
                answers.description,
                "--topics",
                answers.topics.join(","),
                "--scopes",
                formatScopes(answers.scopes),
            ],
            local,
        );

        step("Checking and committing");
        await run("git", ["add", "--all"], local);
        await run("npm", ["run", "check"], local);
        await run(
            "git",
            [
                "commit",
                "--quiet",
                "--message",
                "chore: Initialise from template",
                "--message",
                `Generated from https://github.com/${template}.`,
            ],
            local,
        );
    } catch (error) {
        console.error(
            `\nStopped; nothing was created on GitHub. ${dir} is left for inspection.`,
        );
        throw error;
    }

    /** @type {{ show: string, file: string, args: string[], input?: string }[]} */
    const remote = [
        {
            show: `gh repo create ${slug} --${answers.visibility} --description ${JSON.stringify(answers.description)} --source ${dir} --remote origin`,
            file: "gh",
            args: [
                "repo",
                "create",
                slug,
                `--${answers.visibility}`,
                "--description",
                answers.description,
                "--source",
                dir,
                "--remote",
                "origin",
            ],
        },
    ];
    if (key) {
        const id = clientId ?? `<METADATA_APP_CLIENT_ID of ${template}>`;
        remote.push(
            {
                show: `gh variable set METADATA_APP_CLIENT_ID --repo ${slug} --body ${id}`,
                file: "gh",
                args: [
                    "variable",
                    "set",
                    "METADATA_APP_CLIENT_ID",
                    "--repo",
                    slug,
                    "--body",
                    id,
                ],
            },
            {
                show: `gh secret set METADATA_APP_PRIVATE_KEY --repo ${slug} < (the key from ${key.source})`,
                file: "gh",
                args: [
                    "secret",
                    "set",
                    "METADATA_APP_PRIVATE_KEY",
                    "--repo",
                    slug,
                ],
                input: key.key,
            },
        );
    }
    remote.push({
        show: `git -C ${dir} push --set-upstream origin main`,
        file: "git",
        args: [
            "-C",
            dir,
            "push",
            "--quiet",
            "--set-upstream",
            "origin",
            "main",
        ],
    });

    if (options.dryRun) {
        step("Dry run; these would create the repository:");
        for (const command of remote) console.log(command.show);
        return 0;
    }

    step(`Creating ${slug}`);
    for (const [index, command] of remote.entries()) {
        try {
            await run(command.file, command.args, {
                env: children,
                input: command.input,
                capture: command.input !== undefined,
            });
        } catch (error) {
            console.error(
                index === 0
                    ? `\nCould not create ${slug}; ${dir} holds the committed repository. Retry with:\n  ${command.show}`
                    : `\n${slug} exists on GitHub, but setup stopped. Finish with:\n${remote
                          .slice(index)
                          .map((rest) => `  ${rest.show}`)
                          .join(
                              "\n",
                          )}\nor remove it with:\n  gh repo delete ${slug} --yes`,
            );
            throw error;
        }
    }

    console.error(
        `\nCreated https://github.com/${slug}\nIts first CI run: https://github.com/${slug}/actions`,
    );
    return 0;
}

main(process.argv.slice(2)).then(
    (code) => {
        process.exitCode = code;
    },
    (error) => {
        if (error instanceof UsageError) {
            console.error(error.message);
            process.exitCode = 2;
        } else if (error instanceof CommandError) {
            console.error(error.message);
            process.exitCode = 1;
        } else {
            throw error;
        }
    },
);
```

Then `chmod +x packages/create-repo/bin/create-repo.js`.

- [ ] **Step 4: Run the dry run locally and see it pass**

```bash
cd ~/dev/shared-config
rm -rf /tmp/cr-dry
node packages/create-repo/bin/create-repo.js dry-run \
    --description 'Dry run of "create-repo": the published template, initialised and committed.' \
    --topics ci --scopes api --owner example --dir /tmp/cr-dry \
    --no-metadata --dry-run --yes; echo "rc=$?"
git -C /tmp/cr-dry log --format='%s%n%b' -1
```

Expected: `rc=0`; the last lines print `gh repo create example/dry-run
--public …` and `git -C /tmp/cr-dry push …`; the commit is
`chore: Initialise from template` with
`Generated from https://github.com/chewygumxx/repo-tmpl.`

Then check the failure paths:

```bash
node packages/create-repo/bin/create-repo.js dry-run --owner example --dir /tmp/cr-dry --no-metadata --dry-run --yes </dev/null; echo "rc=$?"
node packages/create-repo/bin/create-repo.js --description x --owner example --no-metadata --dry-run --yes </dev/null; echo "rc=$?"
node packages/create-repo/bin/create-repo.js x --description x --owner example --dir /tmp/cr-x --dry-run --yes </dev/null; echo "rc=$?"
METADATA_APP_PRIVATE_KEY=hunter2 node packages/create-repo/bin/create-repo.js x --description x --owner example --dry-run --yes </dev/null 2>&1 | grep -c hunter2
```

Expected, in order: `/tmp/cr-dry already exists.` rc=2; `Missing the
repository name…` rc=2; `No metadata App private key…` rc=2 (unless your
env-file sets one); `0` (the key never appears in output).

- [ ] **Step 5: Commit**

```bash
git add packages/create-repo/bin/create-repo.js
git commit -m "feat(create-repo): Create repository end to end"
git add .github/workflows/create-repo.yaml
git commit -m "ci(create-repo): Dry run against the template"
```

- [ ] **Step 6: Write the package README**

`packages/create-repo/README.md`:

````markdown
# @chewygumxx/create-repo

Creates a GitHub repository from
[`chewygumxx/repo-tmpl`](https://github.com/chewygumxx/repo-tmpl) whose first
CI run passes, including the repository metadata sync.

```sh
npm create @chewygumxx/repo my-thing
```

It asks for anything not given as a flag, shows a summary, and on
confirmation copies the template, installs its toolchain with mise and its
dependencies with npm, runs the template's `scripts/init.mjs`, and commits
once `npm run check` passes. Only then does it create the repository, set the
metadata App's `METADATA_APP_CLIENT_ID` variable and
`METADATA_APP_PRIVATE_KEY` secret, and push. A failure before that leaves
nothing on GitHub.

It needs Node 22 or later, `git`, `mise`, and `gh` logged in with
`gh auth login`.

## Flags


```sh
npm create @chewygumxx/repo -- \
    my-thing \
    --description "…" \
    --topics a,b \
    --scopes api,"cli:Command Line" \
    --yes
```

Run with `--help` for every flag. Without a terminal, the name and
`--description` are required, topics and scopes default to none, and `--yes`
is required. `--dry-run` does everything locally and prints the GitHub
commands instead of running them. `--no-metadata` skips the App variable and
secret.

## The metadata App private key

The client ID is read from the template repository's variable. The private
key comes from the first of:

1. `--metadata-key-file <path>`, or `-` for standard input
2. `METADATA_APP_PRIVATE_KEY`, the key itself
3. `METADATA_APP_PRIVATE_KEY_FILE`, a path
4. The output of `--metadata-key-command` or
   `CREATE_REPO_METADATA_KEY_COMMAND`, such as `pass show github/metadata-app`

Variables may be set in an env-file, `~/.config/chewygumxx/create-repo.env` by
default or `--env-file`. Setting the command there once is enough:

```sh
CREATE_REPO_METADATA_KEY_COMMAND="pass show github/metadata-app"
```

The key is only ever written to the standard input of `gh secret set`. It is
not printed or stored, and the variables above are removed from the
environment of every other command it runs, including `npm ci`.
````

- [ ] **Step 7: Add the table row and commit**

In the root `README.md` table, add after the yamllint row:

```markdown
| [`@chewygumxx/create-repo`](packages/create-repo) | `npm create @chewygumxx/repo`: new repositories from repo-tmpl |
```

Run `npx --no -- prettier --write README.md packages/create-repo/README.md`
to realign the table, then `npm run check`. Expected: exit 0.

```bash
git add packages/create-repo/README.md
git commit -m "docs(create-repo): Describe usage and key sources"
git add README.md
git commit -m "docs: List create-repo"
```

- [ ] **Step 8: Push and watch CI**


```bash
git push origin main
sleep 10
run_id="$(gh run list \
    -w 'Create Repo' \
    -c "$(git rev-parse HEAD)" \
    -L 1 \
    --json databaseId \
    -q '.[0].databaseId')"
gh run watch "$run_id" --exit-status
```

Expected: `Create Repo` and `CI` succeed.

---

### Task 8: First publish (the user)

- [ ] **Step 1: Dry-run the tarball**


```bash
cd ~/dev/shared-config
npm publish \
    --workspace packages/create-repo \
    --provenance=false \
    --dry-run
```

Expected contents: `LICENSE`, `README.md`, `bin/create-repo.js`,
`lib/args.js`, `lib/key.js`, `lib/preflight.js`, `lib/prompt.js`,
`lib/run.js`, `package.json`; no tests.

- [ ] **Step 2: The user publishes 1.0.0**

The user runs, typing `!` first:
`npm publish --workspace packages/create-repo --provenance=false --otp=<code>`

- [ ] **Step 3: The user adds the trusted publisher**


```bash
npm trust github @chewygumxx/create-repo \
    --file publish.yaml \
    --repo chewygumxx/shared-config \
    --allow-stage-publish \
    --otp=<code>
```

- [ ] **Step 4: Confirm it is installable**

```bash
npm view @chewygumxx/create-repo version
```

Expected: `1.0.0` (allow a few minutes for the registry).

---

### Task 9: Smoke test (with approval)

- [ ] **Step 1: Ask the user before creating a real repository**

- [ ] **Step 2: Create the scratch repository**

```bash
cd /tmp
npm create @chewygumxx/repo@latest -- create-repo-smoke \
    --description "Smoke test of create-repo; to be deleted." \
    --topics smoke \
    --yes
```

Expected: ends with `Created https://github.com/chewygumxx/create-repo-smoke`.

- [ ] **Step 3: Watch its first CI run**


```bash
run_id="$(gh run list \
    -R chewygumxx/create-repo-smoke \
    -w CI \
    -L 1 \
    --json databaseId \
    -q '.[0].databaseId')"
gh run watch -R chewygumxx/create-repo-smoke "$run_id" --exit-status
gh repo view chewygumxx/create-repo-smoke --json description,repositoryTopics
```

Expected: the run succeeds, `Apply Metadata` included (so the slug check
passed); the description and the `smoke` topic are set.

- [ ] **Step 4: Delete it (the user's `gh` needs `delete_repo`)**

```bash
gh auth refresh -s delete_repo
gh repo delete chewygumxx/create-repo-smoke --yes
rm -rf /tmp/create-repo-smoke
```
