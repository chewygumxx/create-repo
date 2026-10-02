// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/bun.test.js
//
//

// @ts-check

// This repository runs on Bun: its scripts, its tests and its hooks.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** @param {string} file */
const read = (file) => readFileSync(join(ROOT, file), "utf8");

// Without it, `bun run` honours a CLI's `#!/usr/bin/env node`, and runs
// whatever Node is on PATH, as every CI runner has.
test("every script runs on Bun, even with Node on PATH", () => {
    assert.match(read("bunfig.toml"), /^\[run\]\nbun = true$/m);
});

// A bare `bun test` also runs the test files lint:templates materialises
// under .templates/.
test("the scripts call Bun, and test only test/", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.scripts.test, "bun test ./test/");
    assert.deepEqual(pkg.engines, { bun: ">=1.4" });
    for (const [name, script] of Object.entries(pkg.scripts)) {
        assert.doesNotMatch(script, /\b(?:npm|npx|node)\b/, name);
    }
});

test("the lock is Bun's", () => {
    assert.ok(existsSync(join(ROOT, "bun.lock")));
    assert.ok(!existsSync(join(ROOT, "package-lock.json")));
});

test("the hooks run their tools with Bun", () => {
    for (const hook of [".husky/pre-commit", ".husky/commit-msg"]) {
        const text = read(hook);
        assert.doesNotMatch(text, /\bnpx\b/, hook);
        assert.match(text, /bunx --bun --no-install /, hook);
    }
});
