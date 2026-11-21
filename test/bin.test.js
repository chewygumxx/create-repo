// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/bin.test.js
//
//

// @ts-check

// Runs the real entry point with logging stand-ins for gh, git, mise, bun, npm
// and node first on PATH, so what every child process sees can be checked
// without touching GitHub or the network.

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
 * pinned=<MISE_PINNED>`, and its whole command line and GITHUB_REPOSITORY
 * to `<log>.argv`. `mise env --json` reports a pinned environment, and gh
 * fails as if not logged in, unless `GH_LOGIN` names the account; it
 * creates repositories and sets secrets only with `GH_CREATE` set.
 * @param {string} log
 */
function standIn(log) {
    return `#!/bin/sh
printf '%s %s key=%s pinned=%s\\n' "$(basename "$0")" "$1" \\
    "\${METADATA_APP_PRIVATE_KEY:+PRESENT}" "\${MISE_PINNED:-}" >> '${log}'
printf '%s %s repo=%s\\n' "$(basename "$0")" "$*" "\${GITHUB_REPOSITORY:-}" >> '${log}.argv'
case "$(basename "$0") $1" in
"gh repo" | "gh secret") if [ -n "$GH_CREATE" ]; then cat > /dev/null; else exit 1; fi ;;
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
        writeFileSync(`${log}.argv`, "");
        for (const tool of ["gh", "git", "mise", "bun", "npm", "node"]) {
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
            argv: readFileSync(`${log}.argv`, "utf8").trim().split("\n"),
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
            ci: existsSync(join(dir, ".github/workflows/ci.yaml"))
                ? readFileSync(join(dir, ".github/workflows/ci.yaml"), "utf8")
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
    assert.ok(after.some((line) => line.startsWith("bun run")));
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
    assert.deepEqual(lines, [""], "no gh, mise or bun was run");
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
    assert.deepEqual(lines, [""], "no gh, mise or bun was run");
});

test("--help lists the templates", () => {
    const { result } = runBin(() => ["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--template <name>/);
    assert.match(result.stdout, /\nTemplates:\n {2}standard {4}Any repository/);
    assert.match(result.stdout, /\n {2}typescript {2}A Bun library or CLI/);
    assert.match(result.stdout, /\n {2}cloudflare {2}A Cloudflare Worker/);
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
    assert.match(result.stderr, /^Repository +example\/x \(public\)$/m);
});

// Neither a flag nor a login names an owner, which nothing after can make up,
// so the key command (which may prompt for a secret) has no cause to run.
test("no owner at all stops before the key command", () => {
    const { result, ran, copied } = runBin(
        (root) => [
            "x",
            "--description",
            "D",
            "--dir",
            join(root, "x"),
            "--dry-run",
            "--yes",
            "--metadata-key-command",
            `touch ${join(root, "ran")}; echo k`,
        ],
        // A key variable would be taken before the command, which then
        // could never run, whatever the order.
        { METADATA_APP_PRIVATE_KEY: "" },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Cannot tell the owner/);
    assert.equal(ran, false);
    assert.equal(copied, false);
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
        { GH_LOGIN: "Mixed", METADATA_APP_PRIVATE_KEY: "" },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /lowercase/);
    assert.equal(ran, false);
    assert.equal(copied, false);
});

test("no bun template runs npm or node", () => {
    for (const template of ["standard", "typescript", "cloudflare"]) {
        const { lines } = dryRun(["--template", template]);
        assert.deepEqual(
            lines.filter((line) => /^(?:npm|node) /.test(line)),
            [],
            template,
        );
    }
});

const PEM =
    "-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----\n";

/**
 * The positions in `argv` of the first line matching each pattern, after
 * the one before it.
 * @param {string[]} argv
 * @param {RegExp[]} patterns
 */
function inOrder(argv, patterns) {
    let at = -1;
    return patterns.map((pattern) => {
        at = argv.findIndex((line, index) => index > at && pattern.test(line));
        return at;
    });
}

test("it stages, records words, formats, restages, checks, then commits", () => {
    const { argv } = dryRun();
    const order = inOrder(argv, [
        /^mise install /,
        /^git add --all /,
        /^bun run cspell lint --file-list stdin /,
        /^mise run format --all /,
        /^git add --all /,
        /^mise run check --all /,
        /^git commit /,
    ]);
    assert.ok(!order.includes(-1), `${order}\n${argv.join("\n")}`);
});

// The header check reads GITHUB_REPOSITORY before the origin remote, which
// does not exist until the repository is created; the caller's own, as in
// CI, must not leak through.
test("its checks are told the new repository, not the caller's", () => {
    const run = runBin(
        (root) => [
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
        { GITHUB_REPOSITORY: "caller/elsewhere" },
    );
    assert.equal(run.result.status, 0, run.result.stderr);
    for (const pattern of [/^mise run format /, /^mise run check /]) {
        const line = run.argv.find((entry) => pattern.test(entry)) ?? "";
        assert.match(line, / repo=example\/x$/, String(pattern));
    }
});

test("--no-metadata switches the new repository's metadata sync off", () => {
    assert.match(
        dryRun().ci ?? "",
        /^ {12}metadata-sync: false # create-repo --no-metadata/m,
    );
});

/**
 * A real run, against a gh that creates.
 * @param {string[]} extra
 */
function create(extra) {
    return runBin(
        (root) => [
            "x",
            "--description",
            "D",
            "--dir",
            join(root, "x"),
            "--yes",
            ...extra,
        ],
        {
            GH_LOGIN: "example",
            GH_CREATE: "1",
            METADATA_APP_PRIVATE_KEY: PEM,
        },
    );
}

test("with metadata, the variable and secret are set before the push", () => {
    const run = create([]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.match(
        run.ci ?? "",
        /^ {12}metadata-sync: \$\{\{ vars\.METADATA_APP_CLIENT_ID != '' \}\}$/m,
    );
    const order = inOrder(run.argv, [
        /^gh repo create example\/x --public /,
        /^gh variable set METADATA_APP_CLIENT_ID --repo example\/x --body client /,
        /^gh secret set METADATA_APP_PRIVATE_KEY --repo example\/x /,
        /^git -C \S+ push --quiet --set-upstream origin main /,
    ]);
    assert.ok(!order.includes(-1), `${order}\n${run.argv.join("\n")}`);
});

test("--no-metadata sets neither the variable nor the secret", () => {
    const run = create(["--no-metadata"]);
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.ok(run.argv.some((line) => /^gh repo create /.test(line)));
    assert.ok(run.argv.some((line) => / push /.test(line)));
    assert.deepEqual(
        run.argv.filter((line) => /^gh (?:variable|secret) set /.test(line)),
        [],
    );
});
