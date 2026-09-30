---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/create-repo.git
  # ::: :/docs/plans/2026-10-01-address-deferred-minors.md
  #
  #

ctime: 2026-10-01
title: >-
  Implementation Plan: address the deferred minors
description: ""
tags: []
---

# Implementation Plan: address the deferred minors

> [!IMPORTANT]
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every minor finding that phases 1 to 6 deferred, and the two
Dependabot faults found after the 2.1.0 push, except those that cannot be
fixed here, each of which gets a ruling below.

**Architecture:** Eight tasks, grouped by the code they touch, each test
first. No new dependency and no change to a template's shape. The one
ordering change that matters is that `moduleName` becomes the first edit of
every native template, so no later edit writes text it could rewrite.

**Tech Stack:** Node 24 (`node --test`), the layers under `templates/`, mise
task scripts, GitHub Actions, Dependabot.

**Spec:** `docs/specs/2026-09-30-multiple-templates-design.md`, whose
"Deferred" section Task 8 updates.

## Global Constraints

- Commit headers are at most 50 characters and body lines at most 72. The
  only scopes are `claude` and `template`, or none. A commit that needs
  context puts it in the body.
- Commit granularly: one commit per numbered item, the test and its fix
  together, except a pure docs change, which is its own commit.
- The pre-commit hook runs tsc, Biome, remark (80 columns), Prettier,
  yamllint and the em dash check. No em dash anywhere. Run `npm run format`
  before each commit: Biome refuses unformatted code, and the code blocks
  below are not laid out as it lays them out.
- A commit that the hook refuses leaves its files staged, so the next
  `git add` and commit would swallow them: check `git status` and the log
  after every commit.
- The templates keep their `chewygumxx/repo-tmpl` identity and the token
  `repo_tmpl`: `lib/init.js` rewrites them.
- `npm run check` must exit 0 after every task. The baseline is 197 tests.
- Do not bump the version, tag or push. After the last task, ask.

## Review Focus

- **A name that holds `repo_tmpl` (Task 3):** it must survive every edit.
  Covered by the `x-repo_tmpl` and description tests.
- **Vimdoc tags (Task 3):** a module shorter and one longer than `repo_tmpl`
  must keep every right-aligned line at its original width.
- **Native CI (Task 7):** the commitlint job installs only `committed`. This
  plan cannot run that workflow; Task 7 proves the mechanism with a scratch
  `MISE_DATA_DIR`.
- **Early refusals (Task 2):** nothing the refusals stop may have run a
  command first. The `--with` test uses a key command with a side effect.
- **Dependabot (Task 1):** a config that "succeeds" without reading a
  workflow is the failure this task exists for. The test checks the
  directories, not only the ecosystems.

## What I checked before planning

Two minors were already fixed and are dropped: the README table's missing
comma, and the `bin/create-repo.js` header comment, which reads "the chosen
template". A third, "a library named `my-repo-tmpl` fails init's guard",
passes today (a real dry run exits 0), but its neighbour does not: a crate
named `x-repo_tmpl` becomes `x-x_repo_tmpl` in `Cargo.toml`, because
`moduleName` rewrites text that `cargoToml` already wrote, and `cargo test`
fails. Task 3 fixes the cause, not the one name.

## Rulings

1. **Dependabot prefixes lose `(template)`.** The shared commitlint
   config ignores a Dependabot commit only when the header matches
   `^(build|ci): bump `, and `(template)` breaks the match, so those
   commits fail the 50-character header limit. The real fix is one regex in
   `@chewygumxx/commitlint-config`, which lives in `chewygumxx/shared-config`
   with its own release. I do not touch another repository or publish a
   package unasked. Cost if wrong: the commit scope no longer marks
   template updates.
2. **No Dependabot cargo entry for `templates/rust`:** the template has no
   dependencies, so there is nothing to update. Revisit when it gains one.
3. **Dependabot has no mise ecosystem** (the supported-ecosystems table
   does not list it), so the mise pins stay hand-bumped. Spec item 4 stands.
4. **The triplicated `package.json`s and the duplicated README text stay.**
   They follow from the approved whole-file layer design: a layer replaces
   a file, it does not patch it.
5. **The deprecation notices stay.** `commitizen` and `remark-cli` are at
   their latest versions and still depend on `glob@7` and `glob@10`. Task 7
   has nothing for them; they are already hidden from `create-repo`'s
   install.
6. **A header held to 50 characters stays impossible.** `committed` 1.1.11
   is the latest release and its `subject_length` has no effect. Spec item 1
   stands.
7. **A2 is fixed by refusing, not by reworking the guard.** An identity word
   that is exactly `repo-tmpl`, `repo_tmpl`, `is_template` or
   `Using this template` is refused: such a word is the template's own
   name. Cost if wrong: nobody can name a repository `repo-tmpl`.
8. **D1 is fixed at the input.** A description or scope full name with a
   control character is refused, rather than adding a TOML serializer.
   `JSON.stringify` is correct for everything else. Cost if wrong: a
   description can no longer hold a tab.
9. **A1 checks what it can before the preflight.** With no terminal the
   template is the default, so its features are checked; with a terminal a
   feature that no template offers is refused. A feature one template offers
   and the chosen one does not still fails after the prompt, which is the
   first moment the template is known.
## File Structure

- `.github/dependabot.yml`: directories and prefixes. Modify.
- `test/dependabot.test.js`: new.
- `lib/args.js`, `lib/prompt.js`, `lib/templates.js`, `lib/preflight.js`,
  `bin/create-repo.js`: input checks. Modify.
- `test/input.test.js`: new. `test/preflight.test.js`: extend.
- `lib/init.js`: edit order, vimdoc gaps, same-file rename, repository.
  Modify. `test/identity.test.js`: new.
- `templates/*/package.json` (four): the `repository` object. Modify.
- `test/mise-task.js`: new helper, not a test file. `test/nvim.test.js`:
  new. `test/zsh.test.js`: extend.
- `templates/nvim/.config/mise/conf.d/nvim.toml`,
  `templates/zsh/.config/mise/conf.d/zsh.toml`, `templates/zsh/README.md`.
- `templates/cloudflare/.github/dependabot.yml`: new.
  `templates/native/.github/workflows/ci.yaml`, `templates/*/_gitignore`,
  the typescript-publish, cloudflare and rust READMEs. Modify.
- `mise.toml`, `package.json`: editorconfig-checker. Modify.

---

### Task 1: Dependabot reads the workflows and passes commitlint

**Files:**

- Modify: `.github/dependabot.yml`
- Create: `test/dependabot.test.js`

**Why:** for a directory other than `/`, Dependabot's github-actions fetcher
scans that directory itself for `*.yml` and `*.yaml`, not its
`.github/workflows`. The four layer entries therefore either failed
(`cloudflare`, `typescript-publish`: no YAML at the layer root) or passed by
reading `.yamllint.yaml` and never a workflow (`npm`, `native`).

**Interfaces:**

- Produces: each template layer's workflows are watched through
  `directory: /templates/<layer>/.github/workflows`.

- [ ] **Step 1: Write the failing tests**

Create `test/dependabot.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/dependabot.test.js
//
//

// @ts-check

// Dependabot reads what its config names: a directory that holds no workflow
// is read without error and watches nothing, and a commit title its prefix
// makes must pass commitlint, which only ignores an unscoped bump.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The entries of `updates`, read by line: the file is small and flat, and
 * this repository has no YAML parser to read it with.
 * @returns {{ ecosystem: string, directory: string, prefix: string }[]}
 */
function entries() {
    const text = readFileSync(join(ROOT, ".github/dependabot.yml"), "utf8");
    return text
        .split(/^ {4}- package-ecosystem: /m)
        .slice(1)
        .map((block) => ({
            ecosystem: block.split("\n")[0].trim(),
            directory: /^ {6}directory: (\S+)$/m.exec(block)?.[1] ?? "",
            prefix: /^ {10}prefix: (\S+)$/m.exec(block)?.[1] ?? "",
        }));
}

/** @param {string} ecosystem */
const directories = (ecosystem) =>
    entries()
        .filter((entry) => entry.ecosystem === ecosystem)
        .map((entry) => entry.directory);

const LAYERS = readdirSync(join(ROOT, "templates"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

test("every layer with a lockfile has an npm entry", () => {
    for (const layer of LAYERS) {
        if (!existsSync(join(ROOT, "templates", layer, "package-lock.json"))) {
            continue;
        }
        assert.ok(
            directories("npm").includes(`/templates/${layer}`),
            layer,
        );
    }
});

test("every layer with workflows is watched where they are", () => {
    for (const layer of LAYERS) {
        const workflows = `templates/${layer}/.github/workflows`;
        if (!existsSync(join(ROOT, workflows))) continue;
        assert.ok(
            directories("github-actions").includes(`/${workflows}`),
            layer,
        );
    }
});

test("every directory Dependabot is given exists", () => {
    for (const { directory } of entries()) {
        assert.ok(existsSync(join(ROOT, directory)), directory);
    }
});

// A scoped header is not ignored, so a long bump title fails the 50
// character limit. Dependabot's own sign-off trailer is what the ignore
// requires as well.
test("Dependabot's commit titles pass commitlint", () => {
    const lint = (/** @type {string} */ message) =>
        spawnSync(join(ROOT, "node_modules/.bin/commitlint"), {
            cwd: ROOT,
            encoding: "utf8",
            input: `${message}\n\nSigned-off-by: dependabot[bot] <support@github.com>\n`,
        });
    for (const prefix of new Set(entries().map((entry) => entry.prefix))) {
        const result = lint(
            `${prefix}: bump actions/checkout from 6 to 7 in /templates/cloudflare/.github/workflows`,
        );
        assert.equal(result.status, 0, prefix + result.stdout);
    }
    assert.notEqual(lint("ci(template): bump actions/checkout from 6 to 7 in /x").status, 0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/dependabot.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: 4 tests, 2 failed: `every layer with workflows is watched where
they are` and `Dependabot's commit titles pass commitlint`. The lockfile and
directory tests pass already: they guard what must stay true.

- [ ] **Step 3: Change the config**

In `.github/dependabot.yml`:

- Change the four github-actions directories `/templates/npm`,
  `/templates/typescript-publish`, `/templates/cloudflare` and
  `/templates/native` to the same path plus `/.github/workflows`.
- Change every `prefix: build(template)` to `prefix: build` and every
  `prefix: ci(template)` to `prefix: ci`.
- Add this comment above the first `/templates/npm` entry:

```yaml
    # A template's workflows are read from their own directory: Dependabot
    # scans a directory other than `/` itself, not its `.github/workflows`.
    # The prefixes carry no scope because commitlint ignores a Dependabot
    # commit only when its header is an unscoped `build: bump` or `ci: bump`.
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/dependabot.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: 4 tests, 0 failed. Then `npm run check`, expected exit 0.

- [ ] **Step 5: Commit**

```bash
git add .github/dependabot.yml test/dependabot.test.js
git commit -m "ci: Watch each layer's workflows, unscoped" \
  -m "Dependabot scans a directory other than / itself, not its
.github/workflows, so four entries read no workflow. The scoped prefixes
also fell outside commitlint's Dependabot ignore."
```

---

### Task 2: Input checks before anything runs

**Files:**

- Modify: `lib/args.js`, `lib/prompt.js`, `lib/templates.js`,
  `lib/preflight.js`, `bin/create-repo.js`
- Create: `test/input.test.js`
- Modify: `test/preflight.test.js`

**Interfaces:**

- Produces: `checkKnownFeatures(features, templates?)` in
  `lib/templates.js`; `checkTemplateTools(answers, tools)` in
  `lib/preflight.js`; `Template.tools?: string[]`.

- [ ] **Step 1: Write the failing tests** (items 2.1 to 2.5)

Create `test/input.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/input.test.js
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
import {
    checkDescription,
    checkName,
    parseOptions,
    parseScopes,
    parseTopics,
    UsageError,
} from "../lib/args.js";
import { completeAnswers } from "../lib/prompt.js";
import { checkKnownFeatures } from "../lib/templates.js";

const BIN = fileURLToPath(new URL("../bin/create-repo.js", import.meta.url));

// The key command runs in the preflight, so a file it leaves behind shows
// that the preflight ran before the mistake was found.
/** @param {string[]} args */
function runWithKeyCommand(args) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-input-"));
    const marker = join(root, "ran");
    try {
        const result = spawnSync(
            process.execPath,
            [
                BIN,
                "x",
                ...args,
                "--description",
                "D",
                "--owner",
                "e",
                "--dry-run",
                "--yes",
                "--metadata-key-command",
                `touch ${marker}; echo k`,
            ],
            { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        );
        return { result, ran: existsSync(marker) };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("a feature the default template lacks stops before the key command", () => {
    const { result, ran } = runWithKeyCommand(["--with", "nonsense"]);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /no features/);
    assert.equal(ran, false);
});

test("a feature no template offers is refused when a terminal may choose", () => {
    assert.doesNotThrow(() => checkKnownFeatures(["lib"]));
    assert.doesNotThrow(() => checkKnownFeatures(["lib", "publish"]));
    assert.throws(
        () => checkKnownFeatures(["lib", "nonsense"]),
        (error) =>
            error instanceof UsageError &&
            /"nonsense"/.test(error.message) &&
            /lib/.test(error.message),
    );
});

test("None at the features prompt means no feature, in any case", async () => {
    let asked = 0;
    const answers = await completeAnswers(
        parseOptions([
            "x",
            "--template",
            "rust",
            "--description",
            "D",
            "--owner",
            "o",
        ]),
        {
            owner: "o",
            ask: async (question) => {
                if (!/Features/.test(question)) return "";
                if (++asked > 1) throw new Error("asked the features again");
                return " None ";
            },
        },
    );
    assert.deepEqual(answers.features, []);
});

test("a word that is the template's own is refused, a longer one is not", () => {
    for (const word of [
        "repo-tmpl",
        "repo_tmpl",
        "is_template",
        "Using this template",
    ]) {
        assert.throws(() => checkName(word), UsageError, word);
        assert.throws(() => checkDescription(word), UsageError, word);
        assert.throws(() => parseTopics(word), UsageError, word);
        assert.throws(() => parseScopes(word), UsageError, word);
        assert.throws(() => parseScopes(`x:${word}`), UsageError, word);
    }
    assert.equal(checkName("my-repo-tmpl"), "my-repo-tmpl");
    assert.equal(checkDescription("A repo_tmpl fork"), "A repo_tmpl fork");
});

test("a control character in a description or scope name is refused", () => {
    for (const control of ["\u0000", "\u0007", "\t", "\u007f"]) {
        assert.throws(
            () => checkDescription(`a${control}b`),
            (error) => error instanceof UsageError && /control/.test(error.message),
            JSON.stringify(control),
        );
        assert.throws(() => parseScopes(`a:b${control}c`), UsageError);
    }
    assert.equal(checkDescription("plain, with punctuation: ok"), "plain, with punctuation: ok");
});
```

Extend `test/preflight.test.js`: add `checkTemplateTools` to its import from
`../lib/preflight.js`, and append:

```js
test("a template's system tools must be on PATH", async () => {
    const target = await answers([
        "x",
        "--template",
        "zsh",
        "--description",
        "D",
        "--dir",
        "/d",
    ]);
    await assert.rejects(
        checkTemplateTools(target, tools({})),
        (error) =>
            error instanceof UsageError &&
            /zsh/.test(error.message) &&
            /zsh template/.test(error.message),
    );
    await checkTemplateTools(target, tools({ "zsh --version": "zsh 5.9" }));
    const other = await answers([
        "x",
        "--template",
        "rust",
        "--description",
        "D",
        "--dir",
        "/d",
    ]);
    const fake = tools({});
    await checkTemplateTools(other, fake);
    assert.deepEqual(fake.calls, []);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run:
`node --test test/input.test.js test/preflight.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: the `test/input.test.js` file fails to load on the missing
`checkKnownFeatures` export, so it reports one failure; preflight reports
`a template's system tools must be on PATH` failing on the missing export.
Both are the import, which is the red state for new exports.

- [ ] **Step 3: Implement**

`lib/templates.js`: add to the `Template` typedef

```js
 * @property {string[]} [tools] system tools the template's checks need that
 *     mise does not install, each run as `<tool> --version` by the preflight
```

set `tools: ["zsh"]` on the `zsh` entry, and add after `checkFeatures`:

```js
/**
 * Refuses a feature that no template offers. The template may still be
 * chosen at a prompt, so this is all that can be known before it is.
 * @param {string[]} features
 * @param {Record<string, Template>} [templates]
 */
export function checkKnownFeatures(features, templates = TEMPLATES) {
    const offered = [
        ...new Set(
            Object.values(templates).flatMap((t) => Object.keys(t.features)),
        ),
    ];
    for (const feature of features) {
        if (offered.includes(feature)) continue;
        throw new UsageError(
            `No template has the feature "${feature}": choose from ${offered.join(", ")}.`,
        );
    }
}
```

`lib/args.js`: add near the top (after `TEMPLATE`):

```js
/** A word that is the template's own, which init's guard cannot tell from a leftover. */
const TEMPLATE_WORD = /^(?:repo-tmpl|repo_tmpl|is_template|Using this template)$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * @param {string} value
 * @param {string} what
 */
function notTemplate(value, what) {
    if (TEMPLATE_WORD.test(value)) {
        throw new UsageError(
            `The ${what} "${value}" is the template's own, which init could not tell from a leftover: choose another.`,
        );
    }
    return value;
}

/**
 * @param {string} value
 * @param {string} what
 */
function noControl(value, what) {
    if (CONTROL.test(value)) {
        throw new UsageError(
            `The ${what} contains a control character, which TOML cannot hold in a string.`,
        );
    }
    return value;
}
```

Then: `checkName` returns `notTemplate(name, "repository name")` after its
pattern test; `checkDescription` runs `noControl(description, "description")`
after the line-break test (tabs included: `\t` is in the class) and
`notTemplate(description, "description")`; `checkOwner` returns
`notTemplate(owner, "owner")`; `parseTopics` calls
`notTemplate(topic, "topic")` inside its loop; `parseScopes` calls
`notTemplate(name, "scope")` and, on the full name,
`noControl(fullName, "scope's full name")` and
`notTemplate(fullName, "scope's full name")`.

`lib/prompt.js`: in `pickFeatures` replace `if (reply === "none") return [];`
with `if (reply.trim().toLowerCase() === "none") return [];`.

`lib/preflight.js`: import `TEMPLATES` already present; append

```js
/**
 * Checks the system tools the chosen template's checks need and mise does
 * not install. They are known only once the template is, after the prompt.
 * @param {Answers} answers
 * @param {Tools} tools
 */
export async function checkTemplateTools(answers, { run }) {
    for (const tool of TEMPLATES[answers.template].tools ?? []) {
        try {
            await run(tool, ["--version"], { capture: true });
        } catch {
            throw new UsageError(
                `${tool} is required to check the ${answers.template} template but is not on PATH: install it with your system's package manager.`,
            );
        }
    }
}
```

`bin/create-repo.js`: import `checkTemplateTools`, `checkKnownFeatures`,
`DEFAULT_TEMPLATE`, `checkFeatures`, `getTemplate` as needed; move
`const ask = options.metadataKeyFile === "-" ? undefined : terminalAsk();`
from before `completeAnswers` to just after `loadEnvFile`, and replace the
early template block with:

```js
    // Needs neither gh nor the network, so it comes before the preflight.
    if (options.template !== undefined) {
        const template = getTemplate(options.template);
        if (options.features !== undefined) {
            checkFeatures(options.template, template, options.features);
        }
    } else if (options.features !== undefined) {
        // Without a terminal the template is the default; with one it is
        // chosen later, so only a feature no template has can be refused now.
        if (ask) checkKnownFeatures(options.features);
        else {
            checkFeatures(
                DEFAULT_TEMPLATE,
                getTemplate(DEFAULT_TEMPLATE),
                options.features,
            );
        }
    }
```

and call `await checkTemplateTools(answers, tools);` straight after
`checkTarget`. Delete the old `const ask` line.

- [ ] **Step 4: Run the tests**

Run: `node --test test/input.test.js test/preflight.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: 0 failed. Then `npm run check`, exit 0.

- [ ] **Step 5: Commit**

One commit per behaviour, each staging only its own hunks
(`git add -p`): `fix: Check --with before the key command runs`,
`fix: Accept None in any case at the features prompt`,
`fix: Refuse the template's own words as identity`,
`fix: Refuse control characters in TOML text`, and
`feat: Check zsh before creating a zsh template`.

---

### Task 3: Identity edits never rewrite each other

**Files:**

- Modify: `lib/init.js`, `lib/templates.js`, four `templates/*/package.json`
- Create: `test/identity.test.js`
- Modify: `test/bin.test.js`, `test/init.test.js`

**Why:** `moduleName` replaces every `repo_tmpl`, but it ran after
`headers`, `readme` and `cargoToml` had written the user's text, so a name
or description holding `repo_tmpl` was rewritten. Making it the first edit
removes the class of bug. The vimdoc's right-aligned tags were laid out for
the nine characters of `repo_tmpl`.

**Interfaces:**

- Produces: `vimdocTags(rename: (name: string) => string): Edit`,
  `collides(source: string, target: string): boolean`, both exported from
  `lib/init.js`; the `nvim` and `rust` and `zsh` edit lists start with
  `moduleName`.

- [ ] **Step 1: Write the failing tests**

Create `test/identity.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/identity.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { collides, init } from "../lib/init.js";
import { copyTemplate } from "../lib/template.js";
import { TEMPLATES } from "../lib/templates.js";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates", import.meta.url));

/**
 * Copies and initialises a template, and hands `body` its directory.
 * @param {string} template
 * @param {string[]} features
 * @param {Partial<import("../lib/init.js").Identity>} identity
 * @param {(at: (file: string) => string) => void} body
 */
function initialised(template, features, identity, body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-identity-"));
    try {
        const dir = join(root, "x");
        const files = copyTemplate(dir, TEMPLATES[template].layers(new Set(features)));
        init(
            dir,
            { owner: "o", name: "x", description: "D", topics: [], scopes: [], ...identity },
            files,
            { edits: TEMPLATES[template].edits, features, today: "2026-10-01" },
        );
        body((file) => readFileSync(join(dir, file), "utf8"));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("a crate named with repo_tmpl keeps its name in every file", () => {
    initialised("rust", ["lib"], { name: "x-repo_tmpl" }, (at) => {
        assert.match(at("Cargo.toml"), /^name\s*=\s*"x-repo_tmpl"$/m);
        assert.match(at("src/lib.rs"), /x_repo_tmpl::greeting/);
        for (const file of ["Cargo.toml", "src/lib.rs", "README.md"]) {
            assert.doesNotMatch(at(file), /x-x_repo_tmpl|x_x_repo_tmpl/, file);
        }
        assert.match(at("Cargo.toml"), /~o\/x-repo_tmpl\.git/);
    });
});

test("a description that mentions repo_tmpl is not rewritten", () => {
    initialised("rust", [], { description: "Wraps repo_tmpl" }, (at) => {
        assert.match(at("Cargo.toml"), /^description\s*=\s*"Wraps repo_tmpl"$/m);
        assert.match(at("README.md"), /Wraps repo_tmpl/);
    });
});

test("the vimdoc's right-aligned lines keep their width for any module", () => {
    const original = readFileSync(
        join(TEMPLATES_DIR, "nvim/doc/repo_tmpl.txt"),
        "utf8",
    ).split("\n");
    for (const name of ["nvim-a", "nvim-plugin_name_x"]) {
        const module = name.replace(/^nvim-/, "");
        initialised("nvim", [], { name }, (at) => {
            const lines = at(`doc/${module}.txt`).split("\n");
            assert.equal(lines.length, original.length, name);
            original.forEach((line, index) => {
                if (!/[*|]$/.test(line) || /^\*/.test(line)) return;
                assert.equal(lines[index].length, line.length, `${name}: ${line}`);
                assert.match(lines[index], new RegExp(`[*|]${module}[-.:\\w]*[*|]$|[*|]:Hello[*|]$`), name);
            });
        });
    }
});

// On a case-insensitive filesystem a case-only rename names the file being
// moved, which is not a collision. A hard link is the same file under a
// second name, as that path is.
test("a path naming the moved file is not a collision", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-identity-"));
    try {
        const file = join(root, "a");
        writeFileSync(file, "a");
        linkSync(file, join(root, "same"));
        writeFileSync(join(root, "other"), "b");
        assert.equal(collides(file, join(root, "same")), false);
        assert.equal(collides(file, join(root, "other")), true);
        assert.equal(collides(file, join(root, "missing")), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
```

Update the two `repository` assertions (`test/init.test.js:131`,
`test/bin.test.js:162`) to expect the object:

```js
    assert.deepEqual(pkg.repository, {
        type: "git",
        url: "git+https://github.com/example/derived-repo.git",
    });
```

(`example/x` and `x` in `bin.test.js`).

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/identity.test.js test/init.test.js test/bin.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: `identity.test.js` fails to load (`collides` is not exported);
once the export exists, the crate and description tests fail on
`x-x_repo_tmpl` and the vimdoc test fails on widths; the two repository
assertions fail.

- [ ] **Step 3: Implement**

`lib/init.js`:

- Import `statSync` from `node:fs` if it is not imported.
- Add, above `moduleName`:

```js
/**
 * Whether `target` exists and is not the file at `source`. A case-only
 * rename names the same file on a case-insensitive filesystem, where it
 * would otherwise look like a file the rename overwrites.
 * @param {string} source
 * @param {string} target
 */
export function collides(source, target) {
    if (!existsSync(target)) return false;
    const a = statSync(source);
    const b = statSync(target);
    return a.dev !== b.dev || a.ino !== b.ino;
}

/**
 * Keeps a vimdoc's right-aligned tags at the width the template lays them
 * out in, which `repo_tmpl` being nine characters sets: the gap before each
 * tag that holds the token takes up the module's extra or missing length.
 * The token itself is left for `moduleName`. A gap of dots (a contents
 * line) keeps a space before them, and no gap shrinks below one space, or
 * three characters of dots.
 * @param {(name: string) => string} rename the module's name for the
 *     repository's
 * @returns {Edit}
 */
export function vimdocTags(rename) {
    return ({ dir, files, identity: { name } }) => {
        const delta = rename(name).length - "repo_tmpl".length;
        for (const file of files.filter((f) => /^doc\/[^/]+\.txt$/.test(f))) {
            editText(join(dir, file), (text) =>
                text
                    .split("\n")
                    .map((line) => {
                        const match =
                            /^(.*?)([ .]{2,})([*|][^\s*|]*repo_tmpl[^\s*|]*[*|])$/.exec(
                                line,
                            );
                        if (!match) return line;
                        const [, head, gap, tag] = match;
                        const count = tag.split("repo_tmpl").length - 1;
                        const dots = gap.includes(".");
                        const length = Math.max(
                            dots ? 3 : 1,
                            gap.length - delta * count,
                        );
                        const lead = dots ? " " : "";
                        return `${head}${lead}${(dots ? "." : " ").repeat(length - lead.length)}${tag}`;
                    })
                    .join("\n"),
            );
        }
    };
}
```

- In `moduleName`, replace `if (existsSync(target)) {` with
  `if (collides(join(dir, file), target)) {`.
- In `packageJson`, replace `data.repository = \`github:${slug}\`;` with

```js
        data.repository = {
            type: "git",
            url: `git+https://github.com/${slug}.git`,
        };
```

`lib/templates.js`: put `moduleName(...)` first in the `rust`, `nvim` and
`zsh` edit lists (for `nvim`, `vimdocTags(nvimModule), moduleName(nvimModule)`,
then the rest), importing `vimdocTags`. Add above each a one-line comment:
`// First, so no later edit writes text it would then rewrite.`

In each of the four `templates/*/package.json`, change
`"repository": "github:chewygumxx/repo-tmpl"` to

```json
    "repository": {
        "type": "git",
        "url": "git+https://github.com/chewygumxx/repo-tmpl.git"
    },
```

then run `npx biome format --write templates/*/package.json`.

- [ ] **Step 4: Run the tests**

Run: `node --test test/*.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: 0 failed. Then `npm run check`, exit 0, and a real
`create-repo x-repo_tmpl --template rust --with lib ... --dry-run --yes`
(see Task 8) exits 0.

- [ ] **Step 5: Commit**

`fix: Run moduleName before the identity edits`,
`fix(template): Keep the vimdoc tags aligned`,
`fix: Let a case-only rename name its own file`,
`fix(template): Write repository as an object`.

---

### Task 4: Names that break the generated repository

**Files:**

- Modify: `lib/templates.js`, `test/templates.test.js`

- [ ] **Step 1: Write the failing tests**

In the zsh name test (the list of refused names ending at `"unset"`), add
before the closing `]`:

```js
        // The runner's own names: `test_*` functions are its tests, and the
        // others are functions its helpers define.
        "test_x",
        "test_greets",
        "assert_equal",
        "on_fpath",
```

In the crate-name test add, after the `my.tool` group, a group that must be
refused for every crate, and one for libraries only:

```js
    for (const name of ["fn", "match", "self", "async", "try", "test"]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError && /crate name/.test(error.message),
            name,
        );
    }
    for (const name of ["core", "std", "alloc", "proc_macro", "proc-macro"]) {
        assert.doesNotThrow(() => check(name), name);
        assert.throws(() => check(name, "lib"), UsageError, name);
    }
    for (const name of ["build", "deps", "examples", "incremental"]) {
        assert.doesNotThrow(() => check(name, "lib"), name);
        assert.throws(() => check(name), UsageError, name);
    }
```

- [ ] **Step 2: Confirm the list against `cargo`**

Run, for each name above: `cargo new --bin /tmp/n/<name>` and `cargo new
--lib /tmp/n/<name>` with the mise-installed cargo
(`mise exec rust -- cargo new ...`). Expected: every name the test refuses
errors in cargo for the same kind; fix the lists to match cargo, not this
plan, where they differ.

- [ ] **Step 3: Run the tests and watch them fail**

Run: `node --test test/templates.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: both name tests fail.

- [ ] **Step 4: Implement**

In `lib/templates.js`, above `crateName`:

```js
/** Cargo refuses a package named for a keyword, or for `test`. */
const RUST_KEYWORDS = new Set([
    "abstract", "as", "async", "await", "become", "box", "break", "const",
    "continue", "crate", "do", "dyn", "else", "enum", "extern", "false",
    "final", "fn", "for", "gen", "if", "impl", "in", "let", "loop", "macro",
    "match", "mod", "move", "mut", "override", "priv", "pub", "ref",
    "return", "self", "Self", "static", "struct", "super", "test", "trait",
    "true", "try", "type", "typeof", "unsafe", "unsized", "use", "virtual",
    "where", "while", "yield",
]);
/** The standard crates, which a library of the same name would shadow. */
const RUST_STD = new Set(["alloc", "core", "proc_macro", "proc-macro", "std"]);
/** Names Cargo keeps for its build directory, which a binary would collide with. */
const CARGO_DIRS = new Set(["build", "deps", "examples", "incremental"]);
```

and in `crateName` change the acceptance to
`if (rule.test(name) && !RUST_KEYWORDS.has(name) && !(lib ? RUST_STD : CARGO_DIRS).has(name)) return;`,
extending the message with
```js
` and not a Rust keyword${lib ? ", a standard crate's name" : ", or one of Cargo's build directories"}`
```

at the end of the message's first sentence.

In `zshPluginName`, extend the acceptance with
`&& !/^test_/.test(name) && !ZSH_RUNNER.has(name)` where
`const ZSH_RUNNER = new Set(["assert_equal", "on_fpath"]);` sits beside
`ZSH_RESERVED` with a comment naming them as the test runner's helpers, and
extend the message's examples with `"test_x"`.

- [ ] **Step 5: Run the tests, then commit**

Expected: 0 failed; `npm run check` exit 0.

`fix(template): Refuse Rust names Cargo refuses`,
`fix(template): Refuse zsh names the runner uses`.

---

### Task 5: The nvim type check

**Files:**

- Create: `test/mise-task.js`, `test/nvim.test.js`
- Modify: `templates/nvim/.config/mise/conf.d/nvim.toml`

- [ ] **Step 1: Write the helper and the failing tests**

Create `test/mise-task.js` (not a test file; `npm test` globs `*.test.js`):

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/mise-task.js
//
//

// @ts-check

import { readFileSync } from "node:fs";

/**
 * The script of a mise task: the multi-line `run` string of
 * `[tasks."<name>"]`, with TOML's `\\` undone, so a test can run it.
 * @param {string} file
 * @param {string} name
 */
export function taskScript(file, name) {
    const text = readFileSync(file, "utf8");
    const header = `[tasks."${name}"]`;
    const start = text.indexOf(header);
    if (start < 0) throw new Error(`${name} is not in ${file}`);
    const section = text.slice(start + header.length).split(/^\[/m)[0];
    const match = /^run\s*=\s*"""\n([\s\S]*?)"""/m.exec(section);
    if (!match) throw new Error(`${name} has no multi-line run in ${file}`);
    return match[1].replaceAll("\\\\", "\\");
}
```

Create `test/nvim.test.js`:

```js
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/nvim.test.js
//
//

// @ts-check

// Runs the nvim layer's type check against stand-ins for Neovim and
// lua-language-server, so each way it can go wrong is a test.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { taskScript } from "./mise-task.js";

const TOML = fileURLToPath(
    new URL("../templates/nvim/.config/mise/conf.d/nvim.toml", import.meta.url),
);

/**
 * @param {{ nvim: string, output?: string, status?: number }} fakes the
 *     stand-in `nvim`'s body, and what `lua-language-server` prints and exits
 */
function typeCheck({ nvim, output = "no problems found", status = 0 }) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-nvim-"));
    try {
        const bin = join(root, "bin");
        mkdirSync(bin);
        const fake = (/** @type {string} */ name, /** @type {string} */ body) => {
            writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
            chmodSync(join(bin, name), 0o755);
        };
        fake("nvim", nvim);
        fake(
            "lua-language-server",
            `touch "${root}/called"
for a; do case $a in --logpath=*) printf %s "\${a#--logpath=}" > "${root}/log";; esac; done
echo "${output}"
exit ${status}`,
        );
        const result = spawnSync(
            "sh",
            ["-e", "-c", taskScript(TOML, "lint:types")],
            {
                cwd: root,
                encoding: "utf8",
                env: { PATH: `${bin}:/usr/bin:/bin`, TMPDIR: root },
            },
        );
        const log = existsSync(join(root, "log"))
            ? readFileSync(join(root, "log"), "utf8")
            : undefined;
        return {
            result,
            called: existsSync(join(root, "called")),
            logLeft: log !== undefined && existsSync(log),
        };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("a failed nvim fails the check instead of running without its types", () => {
    const { result, called } = typeCheck({ nvim: "exit 3" });
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(called, false);
});

test("an nvim that prints no runtime fails the check", () => {
    const { result, called } = typeCheck({ nvim: "exit 0" });
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(called, false);
});

test("the check removes the log directory it made", () => {
    const { result, logLeft } = typeCheck({ nvim: "printf /rt" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(logLeft, false);
});

test("a run without the summary line fails though the server exits 0", () => {
    const { result } = typeCheck({ nvim: "printf /rt", output: "1 problem" });
    assert.equal(result.status, 1, result.stdout);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/nvim.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: the first three fail (the script ignores the failure, and leaves
its log), the fourth passes: it characterises behaviour that must stay.

- [ ] **Step 3: Implement**

In `nvim.toml`, replace the `lint:types` `run` script with:

```toml
run         = """
log=$(mktemp -d)
trap 'rm -rf "$log"' EXIT
VIMRUNTIME=$(nvim --headless --clean --cmd 'lua io.stdout:write(vim.env.VIMRUNTIME)' --cmd quit) || exit
if [ -z "$VIMRUNTIME" ]; then
    echo "nvim printed no runtime directory" >&2
    exit 1
fi
export VIMRUNTIME
out=$(lua-language-server --check=. --checklevel=Warning --logpath="$log" 2>&1) || status=$?
printf '%s\\n' "$out"
case $out in
*"no problems found"*) exit "${status:-0}" ;;
*) exit 1 ;;
esac
"""
```

and update the comment above it to say that a failed `nvim`, or one that
prints no runtime directory, fails the check, and that the log directory is
removed on exit.

- [ ] **Step 4: Run, then commit**

Run: `node --test test/nvim.test.js` (expected 4 passed) and `npm run check`
(exit 0). Then run the real task once in a generated repository (Task 8).

`fix(template): Fail the type check without nvim`,
`fix(template): Remove the type check's logs`.

---

### Task 6: The zsh layer

**Files:**

- Modify: `test/zsh.test.js`, `templates/zsh/.config/mise/conf.d/zsh.toml`,
  `templates/zsh/README.md`

- [ ] **Step 1: Write the failing test**

In `test/zsh.test.js` add `chmodSync` and `readFileSync` to the `node:fs`
import, `fileURLToPath` from `node:url`, and `taskScript` from
`./mise-task.js`, then append:

```js
const ZSH_TOML = fileURLToPath(
    new URL("../templates/zsh/.config/mise/conf.d/zsh.toml", import.meta.url),
);

// `git ls-files` alone names only what is tracked, so a new file would pass
// the runner's glob and never be linted or formatted.
test("lint:zsh and format:zsh name an untracked file, not an ignored one", { skip }, () =>
    inCopy((dir) => {
        const bin = join(dir, ".fake");
        mkdirSync(bin);
        writeFileSync(
            join(bin, "shuck"),
            `#!/bin/sh\nprintf '%s\\n' "$@" >> "${dir}/shuck.log"\n`,
        );
        chmodSync(join(bin, "shuck"), 0o755);
        spawnSync("git", ["init", "--quiet"], { cwd: dir });
        spawnSync("git", ["add", "--all"], { cwd: dir });
        mkdirSync(join(dir, "functions"), { recursive: true });
        writeFileSync(join(dir, "functions", "fresh"), "fresh() { :; }\n");
        writeFileSync(join(dir, ".gitignore"), "ignored.zsh\n", { flag: "a" });
        writeFileSync(join(dir, "ignored.zsh"), ": ignored\n");
        for (const task of ["lint:zsh", "format:zsh"]) {
            rmSync(join(dir, "shuck.log"), { force: true });
            const result = spawnSync(
                "sh",
                ["-e", "-c", taskScript(ZSH_TOML, task)],
                {
                    cwd: dir,
                    encoding: "utf8",
                    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
                },
            );
            assert.equal(result.status, 0, task + result.stderr);
            const log = readFileSync(join(dir, "shuck.log"), "utf8");
            assert.match(log, /functions\/fresh/, task);
            assert.doesNotMatch(log, /ignored\.zsh/, task);
        }
    }),
);
```

`taskScript` needs `format:zsh`'s single-line `run`. Extend it: when the
section has no `"""` run, accept `^run\s*=\s*"([^"\n]*)"$`. (Write that
failing first: the helper's own behaviour is exercised here.)

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/zsh.test.js 2>&1 | grep -E '^(ℹ (tests|pass|fail)|✖)'`

Expected: the new test fails, `functions/fresh` is not in the log.

- [ ] **Step 3: Implement**

In `zsh.toml`, replace each `git ls-files -z '*.zsh' 'functions/*'` with
`git ls-files -z --cached --others --exclude-standard -- '*.zsh' 'functions/*'`
(`lint:zsh` three times, `format:zsh` once), and add to the comment above
`lint:zsh`: `A new file counts before it is added, as the test runner's
glob does.`

In `templates/zsh/README.md`, under the `tests/` bullet of Layout, add a
sentence: `A test passes or fails by the status of its last command, so use
`assert_equal`, which ends the test on a mismatch, for a comparison.` Wrap at
80 columns.

- [ ] **Step 4: Run, then commit**

Run: `node --test test/zsh.test.js` (all pass; skipped only without zsh) and
`npm run check` (exit 0).

`fix(template): Lint and format an untracked zsh file`,
`docs(template): Say how a zsh test fails`.

---

### Task 7: Template files and their tests

Each item is its own commit. "Test" lines run first and must fail for the
reason given.

**Files:** as listed per item.

- [ ] **Step 1: `*.tgz` in the npm layers' `_gitignore`** (A3)

Test (append to `test/templates.test.js`): for each of `standard`,
`typescript`, `typescript+publish` and `cloudflare`, the composed
`_gitignore` matches `/^\*\.tgz$/m`. Expected RED: no match. Three layers
carry their own `_gitignore`, so each gets the line: append `*.tgz` to
`templates/npm/_gitignore`, `templates/cloudflare/_gitignore` and
`templates/typescript-publish/_gitignore`. Commit
`fix(template): Ignore npm pack tarballs`.

- [ ] **Step 2: The lock drift test compares every dependency field** (B1)

In the `each layer's lockfile matches its package.json` test, replace the
single `devDependencies` assertion with a loop:

```js
        for (const field of [
            "dependencies",
            "devDependencies",
            "optionalDependencies",
            "peerDependencies",
        ]) {
            assert.deepEqual(lock.packages[""][field], pkg[field], `${layer} ${field}`);
        }
```

It passes now: prove it can fail by editing one `dependencies` version in a
layer's `package.json`, seeing the test fail, and reverting. Commit
`test: Compare every dependency field in locks`.

- [ ] **Step 3: The yamllint copy cannot drift silently** (D4)

Create `test/yamllint.test.js` with a `shape()` function that drops blank and
comment lines and turns each line's indentation into a depth (its width
divided by the smallest indent), and one test that
`shape(templates/native/.yamllint.yaml)` deep-equals
`shape(node_modules/@chewygumxx/yamllint-config/config.yaml)`. It passes now;
prove it fails by changing `line-length: disable` to `enable` in the native
copy, then revert. Commit `test: Guard the native yamllint copy`.

- [ ] **Step 4: Created Workers ignore Vitest majors** (C1)

Test: the composed `.github/dependabot.yml` of `cloudflare` comes from
`templates/cloudflare/` and matches `/dependency-name: "vitest"/`; the one of
`standard` does not. Expected RED: it comes from `templates/npm/`. Fix:
create `templates/cloudflare/.github/dependabot.yml`, a copy of the npm one
with the header unchanged and, under the npm entry's `ignore:`, after the
`@types/node` item:

```yaml
          # @cloudflare/vitest-pool-workers peers on Vitest 4.
          - dependency-name: "vitest"
            update-types: ["version-update:semver-major"]
```

Commit `fix(template): Ignore Vitest majors in Workers`.

- [ ] **Step 5: The deploy condition test reads the whole expression** (C3)

Replace the four `assert.match` lines of `the deploy job needs the account,
and a push or a manual run` with

```js
    const condition = /^ {8}if: >-\n((?: {12}.*\n)+)/m
        .exec(text)?.[1]
        .replace(/\s+/g, " ")
        .trim();
    assert.equal(
        condition,
        "${{ vars.CLOUDFLARE_ACCOUNT_ID != '' && ( github.event_name == 'workflow_dispatch' || ( github.event.workflow_run.event == 'push' && github.event.workflow_run.conclusion == 'success')) }}",
    );
```

It passes now; prove it fails by deleting `&&` from `deploy.yaml`, then
revert. Move the two-line comment that begins `// The job must stay
skipped` from above the tabs test (where it was left) to above this test
(C4), and add the missing blank lines between tests: find them with
`grep -nPzo '\}\);\ntest\(' test/*.test.js`, and fix every hit. Commit
`test: Read the whole deploy condition`.

- [ ] **Step 6: READMEs** (B2, C2, D3)

`templates/typescript-publish/README.md`: `the typecheck, the tests,` becomes
`the typecheck, the build, the tests,`. `templates/cloudflare/README.md`:
after the `npm run check` bullet add `A Dependabot pull request that bumps
only `wrangler` can fail that check until `npm run types` is run on its
branch.` `templates/rust/README.md`: the `cargo run` bullet becomes
`- `cargo test` runs the tests, and for a binary `cargo run` runs it.` Wrap
at 80 columns; `npm run lint:md` passes. Commit
`docs(template): Correct three README lines`.

- [ ] **Step 7: Native commitlint job installs only `committed`** (D5)

Test: add `readFileSync` to `test/native.test.js`'s `node:fs` import and
append

```js
test("the commitlint job installs only committed and skips the tools", () => {
    const text = readFileSync(
        join(NATIVE, ".github/workflows/ci.yaml"),
        "utf8",
    );
    const job = text.split(/^ {2}check:$/m)[0].split(/^ {2}commitlint:$/m)[1];
    assert.match(job, /install_args: aqua:crate-ci\/committed/);
    const runs = job.match(/run: mise run .*/g) ?? [];
    assert.equal(runs.length, 3);
    for (const run of runs) assert.match(run, /--skip-tools commitlint/);
});
```

RED: neither the input nor the flag is there.

Mechanism already proven by hand: in a generated repository with a fresh
`MISE_DATA_DIR`, `mise install aqua:crate-ci/committed` then
`mise run --skip-tools commitlint -- -1 HEAD` exits 0 on a good commit and 1
on a bad one, and installs nothing else (`mise run` would otherwise install
every tool, which `task.run_auto_install` defaults to). Repeat that once
after the change, with `rm -rf` of the scratch dirs afterwards.

Fix: under `Setup mise` in the `commitlint` job add

```yaml
        with:
          install_args: aqua:crate-ci/committed
```

and change the three `run: mise run commitlint --` to
`run: mise run --skip-tools commitlint --`. Commit
`ci(template): Install only committed to lint`.

- [ ] **Step 8: editorconfig-checker runs on the repo and each template** (C5)

Add `"aqua:editorconfig-checker/editorconfig-checker" = "4.0.2"` to
`mise.toml`'s `[tools]`, under a `# Lint` comment, then in `package.json`
add `"lint:editorconfig": "editorconfig-checker -disable-indent-size"`, put
`npm run lint:editorconfig &&` before `npm run lint:templates` in `check`,
and extend `lint:templates`' loop body to
`(cd "$dir" && biome ci --vcs-use-ignore-file=false . && editorconfig-checker -disable-indent-size -exclude '^\\.materialized$') || exit 1`.
(`-disable-indent-size` is the flag the shared CI uses, for the same reason.)
Checked beforehand by hand: the repository and all eight materialised
templates exit 0. Prove the check bites: add a trailing space to a template
file, see `npm run lint:templates` fail, revert. Commit
`build: Run editorconfig-checker on the templates`.

- [ ] **Step 9: Run `npm run check`; expected exit 0.**

---

### Task 8: The spec, the README and a real run

**Files:**

- Modify: `docs/specs/2026-09-30-multiple-templates-design.md`, `README.md`

- [ ] **Step 1: The spec's Deferred section**

Delete item 5 (zsh on the machine that runs `create-repo`): it is now a
preflight. In the zsh section, say the preflight checks for `zsh` after the
template is chosen. In the Testing paragraph mention the task-script tests
(`test/nvim.test.js`, the zsh lint test) and `lint:editorconfig`. Commit
`docs: Update the spec for the minors`.

- [ ] **Step 2: A real dry run of every changed path**

For each, run the CLI with `--dry-run --yes --no-metadata --owner example`,
in a scratch `--dir`, and read the output; every command must exit 0:

- `x-repo_tmpl --template rust --with lib` (was `cargo test` failing).
- `nvim-a --template nvim` and `nvim-plugin_name_x --template nvim`, then in
  each result `mise run lint:types` and `mise run test:nvim`.
- `zsh-x --template zsh`, then add an untracked `functions/bad` with a
  syntax error and confirm `mise run lint:zsh` fails on it.
- `--with lib` alone, and `--with nonsense`, each exit 2 before any output
  of a key command (use `--metadata-key-command 'touch marker'`).
- `--template rust` with `--dir '/tmp/q[x]/y'` exits 2, as before.

- [ ] **Step 3: The full suite and the ledger**

Run `npm run check` (exit 0, count the tests) and collect every `Ruling:`
above into the final message, with what each costs if wrong, and every
minor left, each with its reason.

- [ ] **Step 4: Commit and stop**

Commit any docs change, then stop. Do not bump, tag or push: ask the user
whether this is `2.1.1`.
