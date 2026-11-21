// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/paradigm.test.js
//
//

// @ts-check

// This repository is set up as shared-config and agentic-library are: mise
// is the switchboard, its tasks extend the cgxx: templates of
// @chewygumxx/mise-tasks-config, and lint and format run the hk steps of
// @chewygumxx/hk-config. These tests hold it to that.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** @param {string} file */
const read = (file) => readFileSync(join(ROOT, file), "utf8");

/** The tracked files, and those about to be, outside templates/. */
function ownFiles() {
    const result = spawnSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard"],
        { cwd: ROOT, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout
        .split("\n")
        .filter((file) => file && !file.startsWith("templates/"))
        .filter((file) => existsSync(join(ROOT, file)));
}

const MISE_SCHEMA = "https://mise.jdx.dev/schema/mise.json";
const TASK_SCHEMA = "https://mise.jdx.dev/schema/mise-task.json";

/**
 * The schema a TOML file names on its third line, by its path.
 * @param {string} file
 */
function schemaOf(file) {
    if (/^\.config\/mise\/(?:config|conf\.d\/[^/]+)\.toml$/.test(file)) {
        return MISE_SCHEMA;
    }
    if (/^\.config\/mise\/tasks\/[^/]+\.task\.toml$/.test(file)) {
        return TASK_SCHEMA;
    }
    return {
        ".config/tombi.toml": "https://www.schemastore.org/tombi.json",
        "bunfig.toml": "https://www.schemastore.org/bunfig.json",
    }[file];
}

/** TOML files whose tools publish no schema. */
const SCHEMALESS = new Set([".moxide.toml"]);

// tombi validates each TOML file by the schema it names, rather than
// leaving tombi to look one up by name.
test("every TOML file names its schema", () => {
    const problems = ownFiles()
        .filter((file) => file.endsWith(".toml") && !SCHEMALESS.has(file))
        .flatMap((file) => {
            const schema = schemaOf(file);
            if (schema === undefined) return [`${file}: no known schema`];
            const line = read(file).split("\n")[2];
            return line === `#:schema ${schema}` ? [] : [`${file}: ${line}`];
        });
    assert.deepEqual(problems, []);
});

test("package.json scripts are check alone, with no install hook", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.deepEqual(pkg.scripts, { check: "mise run check --all" });
    assert.deepEqual(pkg.engines, { bun: ">=1.4" });
    assert.equal(pkg.prettier, undefined);
    assert.equal(pkg.remarkConfig, undefined);
    assert.equal(pkg.cspell, undefined);
});

test("husky is gone; hk installs the hooks", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.devDependencies.husky, undefined);
    assert.ok(!existsSync(join(ROOT, ".husky/pre-commit")));
    const mise = read(".config/mise/config.toml");
    assert.match(
        mise,
        /^postinstall = 'test -n "\$\{CI-\}" \|\| \{ bun ci && hk install --mise; \}'$/m,
    );
});

// 0.x: every functional change is breaking, so a range would take one in.
test("the shared hk steps and mise tasks are pinned exactly", () => {
    const { devDependencies: deps } = JSON.parse(read("package.json"));
    assert.match(deps["@chewygumxx/hk-config"], /^\d+\.\d+\.\d+$/);
    assert.match(deps["@chewygumxx/mise-tasks-config"], /^\d+\.\d+\.\d+$/);
});

test("the cgxx: task templates are linked into conf.d", () => {
    assert.equal(
        readlinkSync(join(ROOT, ".config/mise/conf.d/50-cgxx.toml")),
        "../../../node_modules/@chewygumxx/mise-tasks-config/tasks.toml",
    );
    const mise = read(".config/mise/config.toml");
    assert.match(
        mise,
        /^includes = \[ "\.config\/mise\/tasks\/\*\.task\.toml" \]$/m,
    );
});

test("each standard task extends its cgxx: template", () => {
    const tasks = read(".config/mise/tasks/standard.task.toml");
    for (const task of ["install", "test", "check"]) {
        assert.match(
            tasks,
            new RegExp(`^\\[${task}\\]\\nextends = "cgxx:${task}"$`, "m"),
            task,
        );
    }
    // A bare `bun test` also runs the templates' own tests under
    // templates/, which need their own dependencies.
    assert.match(tasks, /^run {5}= "bun test \.\/test\/"$/m);
});

// hk's steps.pkl and this repository's hk.pkl each name an hk version, and
// mise installs one: all three must agree.
test("hk's version agrees across mise, hk.pkl and the shared steps", () => {
    const pinned = /^hk = "(\d+\.\d+\.\d+)"$/m.exec(
        read(".config/mise/config.toml"),
    )?.[1];
    assert.ok(pinned);
    const own = read(".config/hk.pkl");
    const shared = read("node_modules/@chewygumxx/hk-config/steps.pkl");
    for (const [name, text] of [
        ["hk.pkl", own],
        ["steps.pkl", shared],
    ]) {
        assert.ok(
            text.includes(`/v${pinned}/hk@${pinned}#/Config.pkl`),
            `${name} names hk ${pinned}`,
        );
    }
    assert.match(
        own,
        /^import "\.\.\/node_modules\/@chewygumxx\/hk-config\/steps\.pkl" as shared$/m,
    );
});

// Installed up front: a lazy install from inside a parallel hk step has
// failed CI.
test("the linters hk runs from mise are pinned, not lazy", () => {
    const mise = read(".config/mise/config.toml");
    for (const tool of [
        "aqua:editorconfig-checker/editorconfig-checker",
        "aqua:koalaman/shellcheck",
        "aqua:tombi-toml/tombi",
        "aqua:rhysd/actionlint",
        "pypi:yamllint",
    ]) {
        assert.ok(mise.includes(`"${tool}"`), tool);
    }
    assert.match(mise, /^sh {3}= "\d+\.\d+\.\d+"$/m);
    assert.doesNotMatch(mise, /lazy\s*=\s*true/);
});

test("the configurations the shared steps read are under .config/", () => {
    for (const file of [
        ".config/cspell.json",
        ".config/prettierrc.json",
        ".config/remarkrc.json",
        ".config/tombi.toml",
    ]) {
        assert.ok(existsSync(join(ROOT, file)), file);
    }
    for (const file of [".tombi.toml", ".yamllint.yaml", "mise.toml"]) {
        assert.ok(!existsSync(join(ROOT, file)), file);
    }
});
