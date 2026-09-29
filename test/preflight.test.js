// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/preflight.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions, UsageError } from "../lib/args.js";
import { checkTarget, checkTools } from "../lib/preflight.js";
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
    "npm --version": "11",
};
const loggedIn = { ...present, "gh api user --jq .login": "someone\n" };
const clientId = {
    "gh variable get METADATA_APP_CLIENT_ID --repo chewygumxx/repo-tmpl":
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

test("the client ID comes from the template's variable", async () => {
    assert.deepEqual(
        await checkTools(parseOptions([]), tools({ ...loggedIn, ...clientId })),
        { login: "someone", clientId: "Iv1.abc" },
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
