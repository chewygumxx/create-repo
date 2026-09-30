// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/native.test.js
//
//

// @ts-check

// Runs the native layer's commit-msg hook and commitlint task against stand-ins
// for committed and mise that reject every message, so what passes was skipped
// by the script, as the shared commitlint configuration's default ignores skip
// a merge, a revert and an autosquash commit.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const NATIVE = fileURLToPath(new URL("../templates/native", import.meta.url));
const HOOK = join(NATIVE, ".githooks/commit-msg");
const TASK = join(NATIVE, ".config/mise/tasks/commitlint");

/**
 * A directory of stand-ins that reject everything, and a git repository.
 * @param {(root: string, run: (command: string, args: string[], input?: string) => import("node:child_process").SpawnSyncReturns<string>) => void} body
 */
function inRepo(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-native-"));
    try {
        const bin = join(root, "bin");
        const dir = join(root, "repo");
        spawnSync("mkdir", ["-p", bin, dir]);
        for (const tool of ["committed", "mise"]) {
            writeFileSync(
                join(bin, tool),
                "#!/bin/sh\ncat >/dev/null\nexit 1\n",
            );
            chmodSync(join(bin, tool), 0o755);
        }
        /** @type {NodeJS.ProcessEnv} */
        const env = {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            GIT_AUTHOR_NAME: "t",
            GIT_AUTHOR_EMAIL: "t@example.com",
            GIT_COMMITTER_NAME: "t",
            GIT_COMMITTER_EMAIL: "t@example.com",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
        };
        body(root, (command, args, input = "") =>
            spawnSync(command, args, {
                cwd: dir,
                env,
                input,
                encoding: "utf8",
            }),
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("the commit-msg hook skips a merge, a revert and an autosquash message", () =>
    inRepo((root, run) => {
        const message = join(root, "message");
        /** @param {string} text */
        const hook = (text) => {
            writeFileSync(message, `${text}\n`);
            return run("sh", [HOOK, message]).status;
        };
        for (const text of [
            "Merge branch 'x' into main",
            "Merge pull request #1 from a/b",
            'Revert "feat: a"',
            "fixup! feat: a",
            "squash! feat: a",
            "amend! feat: a",
        ]) {
            assert.equal(hook(text), 0, text);
        }
        for (const text of ["feat: a", "revert: a", "Merged nothing"]) {
            assert.equal(hook(text), 1, text);
        }
    }));

test("the commitlint task skips merge commits and reverts, not the rest", () =>
    inRepo((root, run) => {
        /** @param {string[]} args */
        const git = (...args) => {
            const result = run("git", args);
            assert.equal(result.status, 0, result.stderr);
            return result.stdout.trim();
        };
        git("init", "-q", "-b", "main");
        writeFileSync(join(root, "repo", "a.txt"), "a\n");
        git("add", "a.txt");
        git("commit", "-q", "-m", "feat: a");
        const feat = git("rev-parse", "HEAD");
        git("switch", "-q", "-c", "topic");
        git("commit", "-q", "--allow-empty", "-m", "fix: b");
        git("switch", "-q", "main");
        git("commit", "-q", "--allow-empty", "-m", "fix: c");
        git("merge", "-q", "--no-ff", "-m", "Merge branch 'topic'", "topic");
        const merge = git("rev-parse", "HEAD");
        git("revert", "--no-edit", feat);
        const revert = git("rev-parse", "HEAD");
        git("commit", "-q", "--allow-empty", "-m", "fixup! fix: c");
        const fixup = git("rev-parse", "HEAD");
        /** @param {string[]} args */
        const task = (...args) => run("bash", [TASK, ...args]).status;
        assert.equal(task("-1", merge), 0, "merge");
        assert.equal(task("-1", revert), 0, "revert");
        assert.equal(task("-1", fixup), 0, "fixup");
        assert.equal(task("-1", feat), 1, "an ordinary commit is still linted");
        // A range holds the merge and its side; the merge itself is not linted.
        assert.equal(task(`${feat}..${merge}`), 1, "the side's commits are");
    }));
