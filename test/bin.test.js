// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/bin.test.js
//
//

// @ts-check

// Runs the real entry point with logging stand-ins for gh, git, mise, npm and
// node first on PATH, so what every child process sees can be checked without
// touching GitHub or the network.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/create-repo.js", import.meta.url));

/**
 * Each stand-in logs `<tool> <first argument> key=<PRESENT or empty>
 * pinned=<MISE_PINNED>`. `git clone` creates its target, `mise env --json`
 * reports a pinned environment, and gh fails as if not logged in.
 * @param {string} log
 */
function standIn(log) {
    return `#!/bin/sh
printf '%s %s key=%s pinned=%s\\n' "$(basename "$0")" "$1" \\
    "\${METADATA_APP_PRIVATE_KEY:+PRESENT}" "\${MISE_PINNED:-}" >> '${log}'
case "$(basename "$0") $1" in
"git clone")
    for last; do :; done
    mkdir -p "$last"
    ;;
"mise env") printf '{"PATH":"%s","MISE_PINNED":"yes"}' "$PATH" ;;
"gh "*) exit 1 ;;
esac
`;
}

/** Runs a dry run and returns the stand-ins' log lines. */
function dryRun() {
    const root = mkdtempSync(join(tmpdir(), "create-repo-bin-"));
    try {
        const bin = join(root, "bin");
        const log = join(root, "log");
        mkdirSync(bin);
        writeFileSync(log, "");
        for (const tool of ["gh", "git", "mise", "npm", "node"]) {
            writeFileSync(join(bin, tool), standIn(log));
            chmodSync(join(bin, tool), 0o755);
        }
        const result = spawnSync(
            process.execPath,
            [
                BIN,
                "x",
                "--description",
                "D",
                "--owner",
                "example",
                "--dir",
                join(root, "x"),
                "--no-metadata",
                "--dry-run",
                "--yes",
            ],
            {
                input: "",
                encoding: "utf8",
                env: {
                    HOME: root,
                    PATH: `${bin}:/usr/bin:/bin`,
                    METADATA_APP_PRIVATE_KEY: "not for children",
                },
            },
        );
        assert.equal(result.status, 0, result.stderr);
        return readFileSync(log, "utf8").trim().split("\n");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("no child, preflight included, sees the key variables", () => {
    const lines = dryRun();
    assert.ok(lines.some((line) => line.startsWith("gh ")));
    assert.deepEqual(
        lines.filter((line) => line.includes("key=PRESENT")),
        [],
    );
});

test("every step after mise install runs with the pinned toolchain", () => {
    const lines = dryRun();
    const env = lines.findIndex((line) => line.startsWith("mise env"));
    assert.ok(
        env > lines.indexOf("mise install key= pinned="),
        lines.join("\n"),
    );
    const after = lines.slice(env + 1);
    assert.ok(after.some((line) => line.startsWith("npm run")));
    assert.deepEqual(
        after.filter((line) => !line.endsWith("pinned=yes")),
        [],
    );
});
