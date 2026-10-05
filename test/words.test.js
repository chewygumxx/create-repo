// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/words.test.js
//
//

// @ts-check

// A new repository's name, owner, description, topics and scopes are its
// own words; the templates' text is spelled to the shared word list.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { recordWords } from "../lib/init.js";
import { FAMILIES } from "../lib/templates.js";

/** @param {object} data */
function repository(data) {
    const dir = mkdtempSync(join(tmpdir(), "create-repo-words-"));
    writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify(data, null, 4)}\n`,
    );
    return dir;
}

/** @param {string} dir */
const pkg = (dir) =>
    JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

test("records each unknown word once, sorted, beside the import", () => {
    const dir = repository({
        name: "filebin",
        cspell: { import: ["@chewygumxx/cspell-config"] },
    });
    recordWords(dir, "filebin\nWrangler\nfilebin\n\n  cfw  \n");
    assert.deepEqual(pkg(dir).cspell, {
        import: ["@chewygumxx/cspell-config"],
        words: ["cfw", "filebin", "Wrangler"],
    });
});

test("keeps words the package already lists", () => {
    const dir = repository({ cspell: { words: ["zeta"] } });
    recordWords(dir, "alpha\nzeta\n");
    assert.deepEqual(pkg(dir).cspell.words, ["alpha", "zeta"]);
});

test("leaves the package alone when every word is known", () => {
    const dir = repository({ cspell: { import: ["x"] } });
    const before = readFileSync(join(dir, "package.json"), "utf8");
    recordWords(dir, "\n");
    assert.equal(readFileSync(join(dir, "package.json"), "utf8"), before);
});

test("keeps the package's indentation", () => {
    const dir = mkdtempSync(join(tmpdir(), "create-repo-words-"));
    writeFileSync(join(dir, "package.json"), '{\n  "cspell": {}\n}\n');
    recordWords(dir, "qux\n");
    assert.equal(
        readFileSync(join(dir, "package.json"), "utf8"),
        '{\n  "cspell": {\n    "words": [\n      "qux"\n    ]\n  }\n}\n',
    );
});

// The words are read from the tracked files on stdin, and the check that
// follows fails on any left unknown, so listing them must not fail.
test("the bun family lists unknown words without failing on them", () => {
    const { words } = FAMILIES.bun;
    assert.ok(words);
    assert.equal(words.file, "bun");
    assert.deepEqual(words.args.slice(0, 4), [
        "x",
        "--bun",
        "--no-install",
        "cspell",
    ]);
    for (const flag of [
        "--file-list",
        "--words-only",
        "--unique",
        "--no-exit-code",
        "--no-must-find-files",
    ]) {
        assert.ok(words.args.includes(flag), flag);
    }
    assert.equal(words.args[words.args.indexOf("--file-list") + 1], "stdin");
    assert.equal(FAMILIES.native.words, undefined);
});
