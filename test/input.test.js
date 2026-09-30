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
    assert.throws(() => parseOptions(["--owner", "repo-tmpl"]), UsageError);
    assert.equal(checkName("my-repo-tmpl"), "my-repo-tmpl");
    assert.equal(checkDescription("A repo_tmpl fork"), "A repo_tmpl fork");
});
