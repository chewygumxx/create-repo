// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/bin.test.js
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

const BIN = fileURLToPath(new URL("../bin/create-repo.js", import.meta.url));

/**
 * Each stand-in logs `<tool> <first argument> key=<PRESENT or empty>
 * pinned=<MISE_PINNED>`. `mise env --json` reports a pinned environment, and
 * gh fails as if not logged in.
 * @param {string} log
 */
function standIn(log) {
    return `#!/bin/sh
printf '%s %s key=%s pinned=%s\\n' "$(basename "$0")" "$1" \\
    "\${METADATA_APP_PRIVATE_KEY:+PRESENT}" "\${MISE_PINNED:-}" >> '${log}'
case "$(basename "$0") $1" in
"mise env") printf '{"PATH":"%s","MISE_PINNED":"yes"}' "$PATH" ;;
"gh "*) exit 1 ;;
"git commit") printf '%s\\n' "$*" >> '${log}.commit' ;;
esac
`;
}

/**
 * Runs the entry point with stand-ins first on PATH.
 * @param {(root: string) => string[]} argv given the temporary root
 */
function runBin(argv) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-bin-"));
    try {
        const bin = join(root, "bin");
        const log = join(root, "log");
        mkdirSync(bin);
        writeFileSync(log, "");
        writeFileSync(`${log}.commit`, "");
        for (const tool of ["gh", "git", "mise", "npm", "node"]) {
            writeFileSync(join(bin, tool), standIn(log));
            chmodSync(join(bin, tool), 0o755);
        }
        const result = spawnSync(process.execPath, [BIN, ...argv(root)], {
            input: "",
            encoding: "utf8",
            env: {
                HOME: root,
                PATH: `${bin}:/usr/bin:/bin`,
                METADATA_APP_PRIVATE_KEY: "not for children",
            },
        });
        const dir = join(root, "x");
        return {
            result,
            lines: readFileSync(log, "utf8").trim().split("\n"),
            commit: readFileSync(`${log}.commit`, "utf8"),
            copied: existsSync(dir),
            pkg: existsSync(join(dir, "package.json"))
                ? JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
                : undefined,
            gitignore: existsSync(join(dir, ".gitignore")),
        };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * A dry run that must succeed.
 * @param {string[]} [extra] more flags
 */
function dryRun(extra = []) {
    const run = runBin((root) => [
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
        ...extra,
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    return run;
}

test("no child, preflight included, sees the key variables", () => {
    const { lines } = dryRun();
    assert.ok(lines.some((line) => line.startsWith("gh ")));
    assert.deepEqual(
        lines.filter((line) => line.includes("key=PRESENT")),
        [],
    );
});

test("every step after mise install runs with the pinned toolchain", () => {
    const { lines } = dryRun();
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

test("the copy is the bundled template, initialised", () => {
    const { lines, pkg, gitignore } = dryRun();
    assert.ok(!lines.some((line) => line.startsWith("git clone")));
    assert.equal(pkg.name, "x");
    assert.equal(pkg.repository, "github:example/x");
    assert.ok(gitignore);
});

// The template's format:yaml formats only the files git tracks.
test("the copy is staged before it is formatted", () => {
    const { lines } = dryRun();
    const installed = lines.findIndex((line) => line.startsWith("npm ci"));
    const format = lines.findIndex(
        (line, index) => index > installed && line.startsWith("npm run"),
    );
    assert.ok(
        lines
            .slice(installed + 1, format)
            .some((line) => line.startsWith("git add")),
        lines.join("\n"),
    );
});

test("the first commit names the template", () => {
    assert.match(dryRun().commit, /create-repo \S+ \(standard\)\./);
    assert.match(dryRun(["--template", "standard"]).commit, /\(standard\)\./);
});

test("typescript is copied, initialised and named in the commit", () => {
    const { commit, pkg } = dryRun(["--template", "typescript"]);
    assert.match(commit, /\(typescript\)\./);
    assert.equal(pkg.name, "x");
    assert.equal(pkg.type, "module");
    assert.equal(pkg.private, true);
});

test("publish names the package @owner/name and the commit", () => {
    const { commit, pkg } = dryRun([
        "--template",
        "typescript",
        "--with",
        "publish",
    ]);
    assert.match(commit, /\(typescript, with publish\)\./);
    assert.equal(pkg.name, "@example/x");
    assert.ok(!("private" in pkg));
    assert.equal(pkg.publishConfig.access, "public");
});

test("a name npm refuses stops publish before anything is copied", () => {
    const { result, copied } = runBin((root) => [
        "x",
        "--description",
        "D",
        "--owner",
        "Example",
        "--dir",
        join(root, "x"),
        "--no-metadata",
        "--dry-run",
        "--yes",
        "--template",
        "typescript",
        "--with",
        "publish",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /@Example\/x.*lowercase/);
    assert.ok(!copied);
});

test("--with publish is refused by a template without it", () => {
    const { result, copied } = runBin((root) => [
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
        "--with",
        "publish",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /standard template has no features/);
    assert.ok(!copied);
});

test("an unknown template stops before any tool runs", () => {
    const { result, copied, lines } = runBin((root) => [
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
        "--template",
        "nope",
    ]);
    assert.equal(result.status, 2);
    assert.match(
        result.stderr,
        /Unknown template "nope": choose one of standard/,
    );
    assert.ok(!copied);
    assert.deepEqual(lines, [""], "no gh, mise or npm was run");
});

test("an unknown feature stops before any tool runs", () => {
    const { result, lines } = runBin((root) => [
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
        "--template",
        "standard",
        "--with",
        "wasm",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /has no features/);
    assert.deepEqual(lines, [""], "no gh, mise or npm was run");
});

test("--help lists the templates", () => {
    const { result } = runBin(() => ["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--template <name>/);
    assert.match(result.stdout, /\nTemplates:\n {2}standard {4}Any repository/);
    assert.match(result.stdout, /\n {2}typescript {2}A Node library or CLI/);
});
