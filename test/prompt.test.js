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
