// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/nvim.test.js
//
//

// @ts-check

// Runs the nvim layer's type check against stand-ins for Neovim and
// lua-language-server, so each way it can go wrong is a test.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
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
import { taskScript } from "./mise-task.js";

const TOML = fileURLToPath(
    new URL("../templates/nvim/.config/mise/conf.d/nvim.toml", import.meta.url),
);

/**
 * @param {{ nvim: string, output?: string, status?: number }} fakes the
 *     stand-in `nvim`'s body, and what `lua-language-server` prints and exits
 */
function typeCheck({ nvim, output = "no problems found", status = 0 }) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-nvim-"));
    try {
        const bin = join(root, "bin");
        mkdirSync(bin);
        const fake = (
            /** @type {string} */ name,
            /** @type {string} */ body,
        ) => {
            writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
            chmodSync(join(bin, name), 0o755);
        };
        fake("nvim", nvim);
        fake(
            "lua-language-server",
            `touch "${root}/called"
for a; do case $a in --logpath=*) printf %s "\${a#--logpath=}" > "${root}/log";; esac; done
echo "${output}"
exit ${status}`,
        );
        const result = spawnSync(
            "sh",
            ["-e", "-c", taskScript(TOML, "lint:types")],
            {
                cwd: root,
                encoding: "utf8",
                env: { PATH: `${bin}:/usr/bin:/bin`, TMPDIR: root },
            },
        );
        const log = existsSync(join(root, "log"))
            ? readFileSync(join(root, "log"), "utf8")
            : undefined;
        return {
            result,
            called: existsSync(join(root, "called")),
            logLeft: log !== undefined && existsSync(log),
        };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("a failed nvim fails the check instead of running without its types", () => {
    const { result, called } = typeCheck({ nvim: "exit 3" });
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(called, false);
});

test("an nvim that prints no runtime fails the check", () => {
    const { result, called } = typeCheck({ nvim: "exit 0" });
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(called, false);
});

test("a run without the summary line fails though the server exits 0", () => {
    const { result } = typeCheck({ nvim: "printf /rt", output: "1 problem" });
    assert.equal(result.status, 1, result.stdout);
});

test("the check removes the log directory it made", () => {
    const { result, logLeft } = typeCheck({ nvim: "printf /rt" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(logLeft, false);
});
