// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/materialize.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { combinations } from "../lib/templates.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "materialize.js");

/** @param {string[]} args */
const materialize = (args) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

/** @param {(root: string) => void} body */
function inTemp(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-materialize-"));
    try {
        body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("--list is a matrix of every combination", () => {
    const result = materialize(["--list"]);
    assert.equal(result.status, 0, result.stderr);
    const { include } = JSON.parse(result.stdout);
    assert.equal(include.length, combinations().length);
    assert.deepEqual(include[0], {
        template: "standard",
        with: "",
        name: "standard",
    });
});

test("writes one template, as it is before init", () =>
    inTemp((root) => {
        const result = materialize(["standard", join(root, "x")]);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(existsSync(join(root, "x", ".gitignore")));
        assert.ok(existsSync(join(root, "x", ".repo-metadata.jsonc")));
    }));

test("--all writes every combination under its name", () =>
    inTemp((root) => {
        const result = materialize(["--all", join(root, "all")]);
        assert.equal(result.status, 0, result.stderr);
        assert.ok(existsSync(join(root, "all", "standard", "package.json")));
    }));

test("an unknown template is a usage error", () =>
    inTemp((root) => {
        const result = materialize(["nope", join(root, "x")]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Unknown template "nope"/);
    }));

test("materialisations in the root are ignored by git", () => {
    const result = spawnSync(
        "git",
        ["check-ignore", "--quiet", ".templates/standard/package.json"],
        { cwd: ROOT },
    );
    assert.equal(result.status, 0);
});

test("--all replaces its own earlier output", () =>
    inTemp((root) => {
        const all = join(root, "all");
        assert.equal(materialize(["--all", all]).status, 0);
        writeFileSync(join(all, "standard", "stale.txt"), "");
        assert.equal(materialize(["--all", all]).status, 0);
        assert.ok(!existsSync(join(all, "standard", "stale.txt")));
    }));

test("--all refuses a directory that is not its own output", () =>
    inTemp((root) => {
        const all = join(root, "mine");
        mkdirSync(all);
        writeFileSync(join(all, "keep.txt"), "precious\n");
        const result = materialize(["--all", all]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /not empty/);
        assert.ok(existsSync(join(all, "keep.txt")));
    }));

test("--all takes no template, --with or directory", () =>
    inTemp((root) => {
        for (const extra of [["standard"], ["--with", "a"]]) {
            const result = materialize(["--all", join(root, "all"), ...extra]);
            assert.equal(result.status, 2, extra.join(" "));
        }
    }));
