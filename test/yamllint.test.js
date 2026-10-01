// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/yamllint.test.js
//
//

// @ts-check

// The native layer copies `@chewygumxx/yamllint-config` because a repository
// with no npm cannot install it. Nothing else updates the copy, so this test
// is what notices when the package moves on.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/** @param {string} path relative to the repository root */
const read = (path) =>
    readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

/**
 * What a YAML file says apart from its comments, blank lines and how wide
 * its indent is: each line's text with its depth.
 * @param {string} text
 */
function shape(text) {
    const lines = text
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("#"));
    const unit = Math.min(
        ...lines
            .map((line) => line.length - line.trimStart().length)
            .filter(Boolean),
    );
    return lines.map((line) => ({
        depth: (line.length - line.trimStart().length) / unit,
        text: line.trim(),
    }));
}

test("the native yamllint config is the shared one", () => {
    assert.deepEqual(
        shape(read("templates/native/.yamllint.yaml")),
        shape(read("node_modules/@chewygumxx/yamllint-config/config.yaml")),
    );
});
