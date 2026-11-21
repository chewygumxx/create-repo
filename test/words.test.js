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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { recordWords } from "../lib/init.js";
import { STEPS } from "../lib/templates.js";

/** @param {string} text the cspell configuration */
function repository(text) {
    const dir = mkdtempSync(join(tmpdir(), "create-repo-words-"));
    mkdirSync(join(dir, ".config"));
    writeFileSync(join(dir, ".config/cspell.json"), text);
    return dir;
}

/** @param {object} data */
const json = (data) => `${JSON.stringify(data, null, 4)}\n`;

/** @param {string} dir */
const config = (dir) => readFileSync(join(dir, ".config/cspell.json"), "utf8");

test("records each unknown word once, sorted, beside the import", () => {
    const dir = repository(
        json({ import: ["@chewygumxx/cspell-config"], words: [] }),
    );
    recordWords(dir, "filebin\nWrangler\nfilebin\n\n  cfw  \n");
    assert.deepEqual(JSON.parse(config(dir)), {
        import: ["@chewygumxx/cspell-config"],
        words: ["cfw", "filebin", "Wrangler"],
    });
});

test("keeps words the configuration already lists", () => {
    const dir = repository(json({ words: ["zeta"] }));
    recordWords(dir, "alpha\nzeta\n");
    assert.deepEqual(JSON.parse(config(dir)).words, ["alpha", "zeta"]);
});

test("leaves the configuration alone when every word is known", () => {
    const dir = repository(json({ import: ["x"] }));
    const before = config(dir);
    recordWords(dir, "\n");
    assert.equal(config(dir), before);
});

test("keeps the configuration's indentation", () => {
    const dir = repository('{\n  "words": []\n}\n');
    recordWords(dir, "qux\n");
    assert.equal(config(dir), '{\n  "words": [\n    "qux"\n  ]\n}\n');
});

test("package.json is not where the words go", () => {
    const dir = repository(json({ words: [] }));
    writeFileSync(join(dir, "package.json"), json({ name: "x" }));
    recordWords(dir, "qux\n");
    assert.deepEqual(
        JSON.parse(readFileSync(join(dir, "package.json"), "utf8")),
        {
            name: "x",
        },
    );
});

// The words are read from the tracked files on stdin, and the check that
// follows fails on any left unknown, so listing them must not fail. cspell
// finds .config/cspell.json itself, as hk's cspell step relies on.
test("unknown words are listed without failing on them", () => {
    const { words } = STEPS;
    assert.equal(words.file, "bun");
    assert.deepEqual(words.args.slice(0, 3), ["run", "cspell", "lint"]);
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
    assert.ok(!words.args.includes("--config"));
});
