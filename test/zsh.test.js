// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/zsh.test.js
//
//

// @ts-check

// Runs the zsh layer's own test runner in a copy of the layers, against zsh,
// with tests added that fail in each way a test can, so that a green
// `mise run check` in a new repository means something. Skipped where zsh is
// not installed, since `npm test` needs nothing installed; the Create Repo
// workflow installs it and runs the runner for every generated repository.

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
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { copyTemplate } from "../lib/template.js";
import { TEMPLATES } from "../lib/templates.js";
import { taskScript } from "./mise-task.js";

const skip =
    spawnSync("zsh", ["--version"]).status === 0
        ? false
        : "zsh is not installed";

/**
 * Copies the zsh template, and hands `body` its directory and a function that
 * runs its tests as its mise task does.
 * @param {(dir: string, run: () => import("node:child_process").SpawnSyncReturns<string>) => void} body
 * @param {string} [name] the copy's directory name
 */
function inCopy(body, name = "x") {
    const root = mkdtempSync(join(tmpdir(), "create-repo-zsh-"));
    try {
        const dir = join(root, name);
        copyTemplate(dir, TEMPLATES.zsh.layers(new Set()));
        body(dir, () =>
            spawnSync("zsh", ["-f", "tests/run.zsh"], {
                cwd: dir,
                encoding: "utf8",
            }),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * Adds a test file to a copy.
 * @param {string} dir
 * @param {string} file relative to `tests/`
 * @param {string[]} lines
 */
function addTest(dir, file, lines) {
    const path = join(dir, "tests", file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${lines.join("\n")}\n`);
}

test("the layer's own tests pass", { skip }, () =>
    inCopy((_dir, run) => {
        const result = run();
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /^\d+ tests, 0 failed$/m);
    }),
);

test("a failed assertion ends its test, wherever it is", { skip }, () =>
    inCopy((dir, run) => {
        addTest(dir, "test_early.zsh", [
            "test_fails_early() {",
            "    assert_equal a b",
            "    true",
            "}",
        ]);
        const result = run();
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stdout, /^FAIL test_fails_early$/m);
        assert.match(result.stderr, /expected: a/);
    }),
);

test("a test in a subdirectory of tests runs", { skip }, () =>
    inCopy((dir, run) => {
        addTest(dir, "sub/test_nested.zsh", [
            "test_nested() {",
            "    return 1",
            "}",
        ]);
        const result = run();
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stdout, /^FAIL test_nested$/m);
    }),
);

test("a run that collects no test fails", { skip }, () =>
    inCopy((dir, run) => {
        rmSync(join(dir, "tests", "test_repo_tmpl.zsh"));
        const result = run();
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, /collected no tests/);
    }),
);

test("a test's changes reach no other", { skip }, () =>
    inCopy((dir, run) => {
        addTest(dir, "test_a_changes.zsh", [
            "test_a_changes() {",
            "    leaked=1",
            "    unfunction repo_tmpl",
            "}",
        ]);
        addTest(dir, "test_b_reads.zsh", [
            "test_b_reads() {",
            '    assert_equal "" "$leaked"',
            '    assert_equal "Hello, world!" "$(repo_tmpl)"',
            "}",
        ]);
        const result = run();
        assert.equal(result.status, 0, result.stdout + result.stderr);
    }),
);

test("a test file that cannot be sourced fails the run", { skip }, () =>
    inCopy((dir, run) => {
        addTest(dir, "test_broken.zsh", [
            "test_syntax() {",
            "    if true; then",
            "}",
        ]);
        const result = run();
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /could not load .*test_broken\.zsh/);
    }),
);

test("a plugin in a path with pattern characters passes its tests", {
    skip,
}, () => {
    for (const name of ["a[b]", "st*r", "q?z", "(x)"]) {
        inCopy((_dir, run) => {
            const result = run();
            assert.equal(
                result.status,
                0,
                `${name}\n${result.stdout}${result.stderr}`,
            );
        }, name);
    }
});

const ZSH_TOML = fileURLToPath(
    new URL("../templates/zsh/.config/mise/conf.d/zsh.toml", import.meta.url),
);

// `git ls-files` alone names only what is tracked, so a new file would pass
// the runner's glob and never be linted or formatted.
test(
    "lint:zsh and format:zsh name an untracked file, not an ignored one",
    { skip },
    () =>
        inCopy((dir) => {
            const bin = join(dir, ".fake");
            mkdirSync(bin);
            writeFileSync(
                join(bin, "shuck"),
                `#!/bin/sh\nprintf '%s\\n' "$@" >> "${dir}/shuck.log"\n`,
            );
            chmodSync(join(bin, "shuck"), 0o755);
            spawnSync("git", ["init", "--quiet"], { cwd: dir });
            spawnSync("git", ["add", "--all"], { cwd: dir });
            mkdirSync(join(dir, "functions"), { recursive: true });
            writeFileSync(join(dir, "functions", "fresh"), "fresh() { :; }\n");
            writeFileSync(join(dir, ".gitignore"), "ignored.zsh\n", {
                flag: "a",
            });
            writeFileSync(join(dir, "ignored.zsh"), ": ignored\n");
            for (const task of ["lint:zsh", "format:zsh"]) {
                rmSync(join(dir, "shuck.log"), { force: true });
                const result = spawnSync(
                    "sh",
                    ["-e", "-c", taskScript(ZSH_TOML, task)],
                    {
                        cwd: dir,
                        encoding: "utf8",
                        env: {
                            ...process.env,
                            PATH: `${bin}:${process.env.PATH}`,
                        },
                    },
                );
                assert.equal(result.status, 0, task + result.stderr);
                const log = readFileSync(join(dir, "shuck.log"), "utf8");
                assert.match(log, /functions\/fresh/, task);
                assert.doesNotMatch(log, /ignored\.zsh/, task);
            }
        }),
);
