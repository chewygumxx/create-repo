// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/prompt.test.js
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

/**
 * One template, so the tests of the other prompts are not asked to choose.
 * @type {Record<string, import("../lib/templates.js").Template>}
 */
const ONLY_STANDARD = {
    standard: {
        description: "S",
        family: "npm",
        features: {},
        layers: () => [],
        edits: [],
    },
};

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
        templates: ONLY_STANDARD,
    });
    assert.deepEqual(answers, {
        name: "my-thing",
        description: "A thing",
        topics: ["a", "b"],
        scopes: [
            { name: "api", fullName: "Api" },
            { name: "cli", fullName: "Command Line" },
        ],
        template: "standard",
        features: [],
        owner: "someone",
        visibility: "public",
        dir: resolve("my-thing"),
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
        templates: ONLY_STANDARD,
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
        templates: ONLY_STANDARD,
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
    assert.equal(answers.template, "standard");
    assert.deepEqual(answers.features, []);
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

/** @type {Record<string, import("../lib/templates.js").Template>} */
const CATALOGUE = {
    standard: {
        description: "S",
        family: "npm",
        features: {},
        layers: () => [],
        edits: [],
    },
    crate: {
        description: "C",
        family: "npm",
        features: { lib: "L", bin: "B" },
        layers: () => [],
        edits: [],
        checkName: ({ name }) => {
            if (name.includes(".")) throw new UsageError("No dots.");
        },
    },
};

test("prompts for the template and its features when there is a choice", async () => {
    const { ask, asked } = asker(["2", "lib", "my-thing", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: CATALOGUE,
    });
    assert.equal(answers.template, "crate");
    assert.deepEqual(answers.features, ["lib"]);
    assert.match(
        asked[0],
        /1\. standard +S\n {2}2\. crate +C\nTemplate \[standard\]: $/,
    );
    assert.match(asked[1], /lib +L/);
});

test("an empty reply takes standard, which asks for no features", async () => {
    const { ask, asked } = asker(["", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: CATALOGUE,
    });
    assert.equal(answers.template, "standard");
    assert.deepEqual(answers.features, []);
    assert.equal(asked.length, 5);
});

/** The crate template, taking `lib` when its features are not chosen. */
const DEFAULTING = {
    ...CATALOGUE,
    crate: { ...CATALOGUE.crate, defaultFeatures: ["lib"] },
};

test("an empty reply to the features prompt takes the defaults", async () => {
    const { ask, asked } = asker(["crate", "", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: DEFAULTING,
    });
    assert.deepEqual(answers.features, ["lib"]);
    assert.match(asked[1], /\[lib\]: $/);
});

test("none takes no feature, and other replies replace the defaults", async () => {
    /** @type {[string, string[]][]} */
    const cases = [
        ["none", []],
        ["bin", ["bin"]],
        ["lib, bin", ["lib", "bin"]],
    ];
    for (const [reply, expected] of cases) {
        const { ask } = asker(["crate", reply, "x", "D", "", ""]);
        const answers = await completeAnswers(parseOptions([]), {
            owner: "o",
            ask,
            templates: DEFAULTING,
        });
        assert.deepEqual(answers.features, expected, reply);
    }
});

test("a template without defaults shows none, and an empty reply takes it", async () => {
    const { ask, asked } = asker(["crate", "", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        templates: CATALOGUE,
    });
    assert.deepEqual(answers.features, []);
    assert.match(asked[1], /\[none\]: $/);
});

test("flags and a missing terminal never take the defaults", async () => {
    const run = (/** @type {string[]} */ extra) =>
        completeAnswers(
            parseOptions([
                "x",
                "--description",
                "D",
                "--template",
                "crate",
                ...extra,
            ]),
            { owner: "o", templates: DEFAULTING },
        );
    assert.deepEqual((await run([])).features, []);
    assert.deepEqual((await run(["--with", ""])).features, []);
    assert.deepEqual((await run(["--with", "bin"])).features, ["bin"]);
});

test("a bad template reply asks again", async () => {
    /** @type {string[]} */
    const warnings = [];
    const { ask } = asker(["0", "9", "nope", "crate", "", "x", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        warn: (message) => warnings.push(message),
        templates: CATALOGUE,
    });
    assert.equal(answers.template, "crate");
    assert.deepEqual(warnings.slice(0, 2), [
        "Choose 1 to 2.",
        "Choose 1 to 2.",
    ]);
    assert.match(warnings[2], /Unknown template "nope"/);
});

test("the template's name rule asks again, and refuses a flag", async () => {
    /** @type {string[]} */
    const warnings = [];
    const { ask } = asker(["crate", "", "a.b", "ab", "D", "", ""]);
    const answers = await completeAnswers(parseOptions([]), {
        owner: "o",
        ask,
        warn: (message) => warnings.push(message),
        templates: CATALOGUE,
    });
    assert.equal(answers.name, "ab");
    assert.deepEqual(warnings, ["No dots."]);
    await assert.rejects(
        completeAnswers(
            parseOptions(["a.b", "--template", "crate", "--description", "D"]),
            { owner: "o", templates: CATALOGUE },
        ),
        /No dots\./,
    );
});

test("flags choose the template and features without asking", async () => {
    const answers = await completeAnswers(
        parseOptions([
            "x",
            "--description",
            "D",
            "--template",
            "crate",
            "--with",
            "bin,lib",
            "--topics",
            "",
            "--scopes",
            "",
        ]),
        { owner: "o", ask: asker([]).ask, templates: CATALOGUE },
    );
    assert.equal(answers.template, "crate");
    assert.deepEqual(answers.features, ["lib", "bin"]);
});

test("without a terminal, a template's features default to none", async () => {
    const answers = await completeAnswers(
        parseOptions(["x", "--description", "D", "--template", "crate"]),
        { owner: "o", templates: CATALOGUE },
    );
    assert.deepEqual(answers.features, []);
});

test("unknown templates and features are refused", async () => {
    const run = (/** @type {string[]} */ argv) =>
        completeAnswers(parseOptions(["x", "--description", "D", ...argv]), {
            owner: "o",
            templates: CATALOGUE,
        });
    await assert.rejects(
        run(["--template", "nope"]),
        /Unknown template "nope"/,
    );
    await assert.rejects(
        run(["--template", "crate", "--with", "wasm"]),
        /no feature "wasm"/,
    );
    await assert.rejects(run(["--with", "lib"]), /has no features/);
});

test("the summary names the template and its features", async () => {
    const answers = await completeAnswers(
        parseOptions([
            "x",
            "--description",
            "D",
            "--template",
            "crate",
            "--with",
            "lib",
        ]),
        { owner: "o", templates: CATALOGUE },
    );
    assert.match(
        summary(answers, { dryRun: false }),
        /Template +crate, with lib/,
    );
});
