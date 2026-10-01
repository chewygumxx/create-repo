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
        assert.ok(directories("npm").includes(`/templates/${layer}`), layer);
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

// A directory that exists but holds nothing for its ecosystem is read without
// error too: github-actions reads the `uses:` lines of the YAML directly in
// it, and npm the `package.json` there.
test("every directory holds what its ecosystem reads", () => {
    for (const { ecosystem, directory } of entries()) {
        const dir = join(ROOT, directory);
        if (ecosystem === "npm") {
            assert.ok(existsSync(join(dir, "package.json")), directory);
        } else if (ecosystem === "github-actions") {
            // `/` is the one directory whose workflows are in `.github/`.
            const workflows =
                directory === "/" ? join(dir, ".github/workflows") : dir;
            const used = readdirSync(workflows)
                .filter((file) => /\.ya?ml$/.test(file))
                .some((file) =>
                    /^\s*(?:- )?uses: /m.test(
                        readFileSync(join(workflows, file), "utf8"),
                    ),
                );
            assert.ok(used, `${directory} has no workflow that uses an action`);
        } else {
            // A new ecosystem needs its own rule of what it reads.
            assert.fail(`no content rule for ecosystem ${ecosystem}`);
        }
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
    assert.notEqual(
        lint("ci(template): bump actions/checkout from 6 to 7 in /x").status,
        0,
    );
});
