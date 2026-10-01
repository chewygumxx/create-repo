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
    readdirSync,
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
 * gh fails as if not logged in, unless `GH_LOGIN` names the account.
 * @param {string} log
 */
function standIn(log) {
    return `#!/bin/sh
printf '%s %s key=%s pinned=%s\\n' "$(basename "$0")" "$1" \\
    "\${METADATA_APP_PRIVATE_KEY:+PRESENT}" "\${MISE_PINNED:-}" >> '${log}'
case "$(basename "$0") $1" in
"mise env") printf '{"PATH":"%s","MISE_PINNED":"yes"}' "$PATH" ;;
"gh api") if [ "$2" = user ] && [ -n "$GH_LOGIN" ]; then printf '%s\\n' "$GH_LOGIN"; else echo "HTTP 404" >&2; exit 1; fi ;;
"gh variable") if [ -n "$GH_LOGIN" ]; then echo client; else exit 1; fi ;;
"gh "*) exit 1 ;;
"git commit") printf '%s\\n' "$*" >> '${log}.commit' ;;
esac
`;
}

/**
 * Runs the entry point with stand-ins first on PATH.
 * @param {(root: string) => string[]} argv given the temporary root
 * @param {Record<string, string>} [env] more variables for the entry point
 */
function runBin(argv, env = {}) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-bin-"));
    try {
        const bin = join(root, "bin");
        const log = join(root, "log");
        mkdirSync(bin);
        writeFileSync(log, "");
        writeFileSync(`${log}.commit`, "");
        for (const tool of ["gh", "git", "mise", "npm", "node", "zsh"]) {
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
                ...env,
            },
        });
        const dir = join(root, "x");
        return {
            result,
            lines: readFileSync(log, "utf8").trim().split("\n"),
            commit: readFileSync(`${log}.commit`, "utf8"),
            copied: existsSync(dir),
            ran: existsSync(join(root, "ran")),
            pkg: existsSync(join(dir, "package.json"))
                ? JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
                : undefined,
            gitignore: existsSync(join(dir, ".gitignore")),
            wrangler: existsSync(join(dir, "wrangler.jsonc"))
                ? readFileSync(join(dir, "wrangler.jsonc"), "utf8")
                : undefined,
            cargo: existsSync(join(dir, "Cargo.toml"))
                ? readFileSync(join(dir, "Cargo.toml"), "utf8")
                : undefined,
            lib: existsSync(join(dir, "src/lib.rs"))
                ? readFileSync(join(dir, "src/lib.rs"), "utf8")
                : undefined,
            lua: existsSync(join(dir, "lua"))
                ? readdirSync(join(dir, "lua"))
                : undefined,
            plugin: existsSync(dir)
                ? readdirSync(dir).filter((file) =>
                      file.endsWith(".plugin.zsh"),
                  )
                : undefined,
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
    assert.deepEqual(pkg.repository, {
        type: "git",
        url: "git+https://github.com/example/x.git",
    });
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

test("cloudflare is copied, initialised and named in the commit", () => {
    const { commit, pkg, wrangler } = dryRun(["--template", "cloudflare"]);
    assert.match(commit, /\(cloudflare\)\./);
    assert.equal(pkg.name, "x");
    assert.equal(pkg.private, true);
    assert.match(wrangler ?? "", /"name": "x"/);
});

test("a name a Worker cannot use stops before anything is copied", () => {
    const { result, copied } = runBin((root) => [
        "My_Worker",
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
        "cloudflare",
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Worker name/);
    assert.ok(!copied);
});

test("rust is copied, initialised and run through mise, not npm", () => {
    const { commit, cargo, lines } = dryRun(["--template", "rust"]);
    assert.match(commit, /\(rust\)\./);
    assert.match(cargo ?? "", /^name\s*= "x"$/m);
    assert.match(
        cargo ?? "",
        /^repository\s*= "https:\/\/github\.com\/example\/x"$/m,
    );
    const env = lines.findIndex((line) => line.startsWith("mise env"));
    assert.deepEqual(
        lines
            .slice(env + 1)
            .map((line) => line.split(" ").slice(0, 2).join(" ")),
        ["git add", "mise run", "git add", "mise run", "git commit"],
        lines.join("\n"),
    );
});

test("rust with lib is named in the commit and names its library", () => {
    const run = runBin((root) => [
        "my-tool",
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
        "rust",
        "--with",
        "lib",
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.match(run.commit, /\(rust, with lib\)\./);
    assert.match(run.lib ?? "", /my_tool::greeting/);
});

test("a name a crate cannot use stops before anything is copied", () => {
    /** @type {[string, string[], RegExp][]} */
    const cases = [
        ["my.tool", [], /crate name/],
        ["My-Tool", ["--with", "lib"], /snake case/],
    ];
    for (const [name, extra, message] of cases) {
        const { result, copied } = runBin((root) => [
            name,
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
            "rust",
            ...extra,
        ]);
        assert.equal(result.status, 2, name);
        assert.match(result.stderr, message, name);
        assert.ok(!copied, name);
    }
});

test("nvim is copied, initialised and run through mise, not npm", () => {
    const { commit, lua, lines } = dryRun(["--template", "nvim"]);
    assert.match(commit, /\(nvim\)\./);
    assert.deepEqual(lua, ["x"]);
    const env = lines.findIndex((line) => line.startsWith("mise env"));
    assert.deepEqual(
        lines
            .slice(env + 1)
            .map((line) => line.split(" ").slice(0, 2).join(" ")),
        ["git add", "mise run", "git add", "mise run", "git commit"],
        lines.join("\n"),
    );
});

test("nvim names its module without the affixes", () => {
    const run = runBin((root) => [
        "nvim-my-tool.nvim",
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
        "nvim",
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.deepEqual(run.lua, ["my-tool"]);
});

test("a name a Lua module cannot use stops before anything is copied", () => {
    for (const name of ["my.plugin.nvim", "nvim-", "1plugin"]) {
        const { result, copied } = runBin((root) => [
            name,
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
            "nvim",
        ]);
        assert.equal(result.status, 2, name);
        assert.match(result.stderr, /module/, name);
        assert.ok(!copied, name);
    }
});

test("zsh is copied, initialised and run through mise, not npm", () => {
    const { commit, plugin, lines } = dryRun(["--template", "zsh"]);
    assert.match(commit, /\(zsh\)\./);
    assert.deepEqual(plugin, ["x.plugin.zsh"]);
    const env = lines.findIndex((line) => line.startsWith("mise env"));
    assert.deepEqual(
        lines
            .slice(env + 1)
            .map((line) => line.split(" ").slice(0, 2).join(" ")),
        ["git add", "mise run", "git add", "mise run", "git commit"],
        lines.join("\n"),
    );
});

test("zsh names its plugin for the repository", () => {
    const run = runBin((root) => [
        "zsh-my-tool",
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
        "zsh",
    ]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.deepEqual(run.plugin, ["zsh-my-tool.plugin.zsh"]);
});

test("a name a zsh function cannot have stops before anything is copied", () => {
    for (const name of ["my.plugin", "if", "while"]) {
        const { result, copied } = runBin((root) => [
            name,
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
            "zsh",
        ]);
        assert.equal(result.status, 2, name);
        assert.match(result.stderr, /plugin name/, name);
        assert.ok(!copied, name);
    }
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

test("an owner npm refuses stops publish before anything is copied", () => {
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
    assert.match(result.stderr, /owner "Example".*lowercase.*--owner/);
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
    assert.match(result.stdout, /\n {2}cloudflare {2}A Cloudflare Worker/);
    assert.match(result.stdout, /\n {2}rust {8}A Rust crate/);
    assert.match(result.stdout, /\n {2}nvim {8}A Neovim plugin/);
    assert.match(result.stdout, /\n {2}zsh {9}A zsh plugin/);
});

test("zsh is checked for the zsh template only", () => {
    const checked = (/** @type {string} */ template) =>
        dryRun(["--template", template]).lines.some((line) =>
            line.startsWith("zsh --version"),
        );
    assert.equal(checked("zsh"), true);
    assert.equal(checked("rust"), false);
});

// With no --owner the account gh is logged in as is the owner, which the
// flag's own refusal never sees.
test("a gh login that is the template's own is refused as the owner", () => {
    const { result, copied } = runBin(
        (root) => [
            "x",
            "--description",
            "D",
            "--dir",
            join(root, "x"),
            "--no-metadata",
            "--dry-run",
            "--yes",
        ],
        { GH_LOGIN: "repo-tmpl" },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /owner "repo-tmpl" is the template's own/);
    // A login cannot be changed from here, so the remedy is the flag.
    assert.match(result.stderr, /pass another with --owner/);
    assert.equal(copied, false);
});

test("a gh login is the owner when --owner is not given", () => {
    const { result } = runBin(
        (root) => [
            "x",
            "--description",
            "D",
            "--dir",
            join(root, "x"),
            "--no-metadata",
            "--dry-run",
            "--yes",
        ],
        { GH_LOGIN: "example" },
    );
    assert.equal(result.status, 0, result.stderr);
});

// The owner is settled once gh has said who is logged in, which is before the
// key command, so what the template refuses of it must stop there too.
test("a gh login the template refuses stops before the key command", () => {
    const { result, ran, copied } = runBin(
        (root) => [
            "x",
            "--template",
            "typescript",
            "--with",
            "publish",
            "--description",
            "D",
            "--dir",
            join(root, "x"),
            "--dry-run",
            "--yes",
            "--metadata-key-command",
            `touch ${join(root, "ran")}; echo k`,
        ],
        { GH_LOGIN: "Mixed" },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /lowercase/);
    assert.equal(ran, false);
    assert.equal(copied, false);
});
