// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/preflight.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions, UsageError } from "../lib/args.js";
import { checkTarget, checkTools, METADATA_REPO } from "../lib/preflight.js";
import { completeAnswers } from "../lib/prompt.js";
import { CommandError } from "../lib/run.js";

/**
 * A fake `run`: each key is "file arg arg"; a string value is its standard
 * output, a CommandError is thrown. Anything else is a missing program.
 * @param {Record<string, string | CommandError>} results
 */
function tools(results, existing = new Set()) {
    /** @type {string[]} */
    const calls = [];
    return {
        calls,
        /**
         * @param {string} file
         * @param {string[]} args
         */
        run: async (file, args) => {
            const key = [file, ...args].join(" ");
            calls.push(key);
            const result = results[key];
            if (result instanceof CommandError) throw result;
            if (result === undefined)
                throw new CommandError(key, null, "ENOENT");
            return { stdout: result, stderr: "" };
        },
        /** @param {string} path */
        exists: (path) => existing.has(path),
    };
}

const present = {
    "git --version": "git version 2",
    "mise --version": "2026.9.0",
    "bun --version": "1.4.2",
};
const loggedIn = { ...present, "gh api user --jq .login": "someone\n" };
const clientId = {
    [`gh variable get METADATA_APP_CLIENT_ID --repo ${METADATA_REPO}`]:
        "Iv1.abc\n",
};

test("a missing tool is named", async () => {
    const { "mise --version": _, ...rest } = loggedIn;
    await assert.rejects(
        checkTools(parseOptions([]), tools(rest)),
        (error) => error instanceof UsageError && /mise/.test(error.message),
    );
});

test("gh must be logged in unless dry running", async () => {
    await assert.rejects(
        checkTools(parseOptions([]), tools(present)),
        /gh auth login/,
    );
    assert.deepEqual(
        await checkTools(parseOptions(["--dry-run"]), tools(present)),
        { login: undefined, clientId: undefined },
    );
});

test("the client ID comes from create-repo's variable", async () => {
    assert.equal(METADATA_REPO, "chewygumxx/create-repo");
    assert.deepEqual(
        await checkTools(parseOptions([]), tools({ ...loggedIn, ...clientId })),
        { login: "someone", clientId: "Iv1.abc" },
    );
});

test("an empty client ID stops it, naming --no-metadata", async () => {
    await assert.rejects(
        checkTools(
            parseOptions([]),
            tools({
                ...loggedIn,
                [Object.keys(clientId)[0]]: "\n",
            }),
        ),
        (error) =>
            error instanceof UsageError &&
            /is empty/.test(error.message) &&
            /--no-metadata/.test(error.message),
    );
});

test("--no-metadata does not read the client ID", async () => {
    const fake = tools(loggedIn);
    assert.deepEqual(await checkTools(parseOptions(["--no-metadata"]), fake), {
        login: "someone",
        clientId: undefined,
    });
    assert.ok(!fake.calls.some((call) => call.includes("variable")));
});

/** @param {string[]} argv */
async function answers(argv) {
    return completeAnswers(parseOptions(argv), { owner: "o" });
}

test("an existing directory or repository stops it", async () => {
    const target = await answers(["x", "--description", "D", "--dir", "/d"]);
    await assert.rejects(
        checkTarget(target, tools({}, new Set(["/d"])), { remote: false }),
        /\/d already exists/,
    );
    await assert.rejects(
        checkTarget(target, tools({ "gh api repos/o/x": "{}" }), {
            remote: true,
        }),
        /o\/x already exists/,
    );
});

// GitHub takes either spelling, but the header check compares the one CI
// is told with the one init wrote.
test("an owner spelt otherwise than GitHub spells it stops it", async () => {
    const target = await answers(["x", "--description", "D", "--dir", "/d"]);
    const lookup = "gh api users/o --jq .login";
    const free = new CommandError("gh api repos/o/x", 1, "HTTP 404");
    await assert.rejects(
        checkTarget(
            target,
            tools({ [lookup]: "O\n", "gh api repos/o/x": free }),
            { remote: true },
        ),
        (error) =>
            error instanceof UsageError && /--owner O\b/.test(error.message),
    );
    await checkTarget(
        target,
        tools({ [lookup]: "o\n", "gh api repos/o/x": free }),
        { remote: true },
    );
    // An owner GitHub cannot find is gh repo create's to report.
    await checkTarget(target, tools({ "gh api repos/o/x": free }), {
        remote: true,
    });
});

test("every template refuses a path with a bracket", async () => {
    // mise skips .config/mise/conf.d in a path holding "[", so the tasks
    // every template takes from there are not found.
    for (const template of ["standard", "typescript", "cloudflare"]) {
        const target = await answers([
            "x",
            "--template",
            template,
            "--description",
            "D",
            "--dir",
            "/a[b]/x",
        ]);
        await assert.rejects(
            checkTarget(target, tools({}), { remote: false }),
            (error) =>
                error instanceof UsageError &&
                /\/a\[b\]\/x/.test(error.message) &&
                /mise/.test(error.message),
            template,
        );
    }
});

test("other pattern characters pass", async () => {
    for (const dir of ["/a]b/x", "/st*r/q?z/{a,b}/(x)/x"]) {
        const target = await answers(["x", "--description", "D", "--dir", dir]);
        await checkTarget(target, tools({}), { remote: false });
    }
});

test("a 404 means the repository is free; other errors stop it", async () => {
    const target = await answers(["x", "--description", "D", "--dir", "/d"]);
    await checkTarget(
        target,
        tools({
            "gh api repos/o/x": new CommandError(
                "gh api repos/o/x",
                1,
                "gh: Not Found (HTTP 404)",
            ),
        }),
        { remote: true },
    );
    await assert.rejects(
        checkTarget(
            target,
            tools({
                "gh api repos/o/x": new CommandError(
                    "gh api repos/o/x",
                    1,
                    "connection refused",
                ),
            }),
            { remote: true },
        ),
        /Cannot check whether o\/x exists/,
    );
});

test("without remote access the repository is not checked", async () => {
    const target = await answers(["x", "--description", "D", "--dir", "/d"]);
    const fake = tools({});
    await checkTarget(target, fake, { remote: false });
    assert.deepEqual(fake.calls, []);
});

test("bun is required", async () => {
    const { "bun --version": _, ...rest } = loggedIn;
    await assert.rejects(
        checkTools(parseOptions([]), tools(rest)),
        (error) =>
            error instanceof UsageError &&
            /bun is required/.test(error.message),
    );
});
