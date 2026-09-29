// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/run.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { childEnv } from "../lib/key.js";
import { CommandError, run } from "../lib/run.js";

const node = process.execPath;

test("captures standard output", async () => {
    const { stdout } = await run(node, ["-e", "process.stdout.write('hi')"], {
        capture: true,
    });
    assert.equal(stdout, "hi");
});

test("writes input to standard input", async () => {
    const { stdout } = await run(
        node,
        ["-e", "process.stdin.pipe(process.stdout)"],
        { input: "secret", capture: true },
    );
    assert.equal(stdout, "secret");
});

test("a failure carries the code and standard error", async () => {
    await assert.rejects(
        run(node, ["-e", "console.error('bad'); process.exit(3)"], {
            capture: true,
        }),
        (error) =>
            error instanceof CommandError &&
            error.code === 3 &&
            /bad/.test(error.stderr),
    );
});

test("a missing program is a CommandError", async () => {
    await assert.rejects(
        run("definitely-not-a-program", [], { capture: true }),
        CommandError,
    );
});

test("a child given childEnv cannot read the key", async () => {
    const { stdout } = await run(
        node,
        [
            "-e",
            "process.stdout.write(String(process.env.METADATA_APP_PRIVATE_KEY))",
        ],
        {
            env: childEnv({ ...process.env, METADATA_APP_PRIVATE_KEY: "k" }),
            capture: true,
        },
    );
    assert.equal(stdout, "undefined");
});
