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
        ["preinstall", "install", "postinstall"].filter(
            (name) => name in scripts,
        ),
        [],
    );
});
