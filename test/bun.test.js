// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/bun.test.js
//
//

// @ts-check

// This repository runs on Bun: its scripts and its tests.

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

test("the lock is Bun's", () => {
    assert.ok(existsSync(join(ROOT, "bun.lock")));
    assert.ok(!existsSync(join(ROOT, "package-lock.json")));
});
