// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/paradigm.test.js
//
//

// @ts-check

// This repository, and every repository a template creates, is set up as
// shared-config and agentic-library are: mise is the switchboard, its tasks
// extend the cgxx: templates of @chewygumxx/mise-tasks-config, and lint and
// format run the hk steps of @chewygumxx/hk-config. These tests hold each
// to that.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "jsonc-parser";
import { compose } from "../lib/template.js";
import { combinations, label, TEMPLATES } from "../lib/templates.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * A repository's files, as this checkout holds them or as a template
 * composes them.
 * @typedef {object} View
 * @property {string} name
 * @property {boolean} root whether it is this repository
 * @property {string[]} files relative paths, as the repository names them
 * @property {(file: string) => string} read
 */

/** @returns {View} this repository, its tracked files and those to be */
function rootView() {
    const result = spawnSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard"],
        { cwd: ROOT, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const files = result.stdout
        .split("\n")
        .filter((file) => file && !file.startsWith("templates/"))
        .filter((file) => existsSync(join(ROOT, file)));
    return {
        name: "create-repo",
        root: true,
        files,
        read: (file) => readFileSync(join(ROOT, file), "utf8"),
    };
}

/** @returns {View[]} each template, with each combination of features */
function templateViews() {
    return combinations().map(({ template, features }) => {
        const sources = compose(TEMPLATES[template].layers(new Set(features)));
        /** @param {string} file */
        const stored = (file) => (file === ".gitignore" ? "_gitignore" : file);
        return {
            name: label(template, features),
            root: false,
            files: [...sources.keys()].map((file) =>
                file === "_gitignore" ? ".gitignore" : file,
            ),
            read: (file) =>
                readFileSync(
                    sources.get(stored(file)) ?? assert.fail(`no ${file}`),
                    "utf8",
                ),
        };
    });
}

const VIEWS = [rootView(), ...templateViews()];

/**
 * Runs `body` for each repository, naming it in any failure.
 * @param {(view: View) => void} body
 */
function eachView(body) {
    for (const view of VIEWS) {
        try {
            body(view);
        } catch (error) {
            if (error instanceof Error) {
                error.message = `${view.name}: ${error.message}`;
            }
            throw error;
        }
    }
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
test("every TOML file names its schema", () =>
    eachView(({ files, read }) => {
        const problems = files
            .filter((file) => file.endsWith(".toml") && !SCHEMALESS.has(file))
            .flatMap((file) => {
                const schema = schemaOf(file);
                if (schema === undefined) return [`${file}: no known schema`];
                const line = read(file).split("\n")[2];
                return line === `#:schema ${schema}`
                    ? []
                    : [`${file}: ${line}`];
            });
        assert.deepEqual(problems, []);
    }));

test("package.json scripts are check and lifecycle scripts alone", () =>
    eachView(({ read, root }) => {
        const pkg = JSON.parse(read("package.json"));
        const { check, ...lifecycle } = pkg.scripts;
        assert.equal(check, "mise run check --all");
        for (const name of Object.keys(lifecycle)) {
            assert.match(name, /^(?:pre|post)?(?:pack|prepare|publish)$/);
        }
        // Installed from the registry, the package must run no script.
        if (root) assert.deepEqual(lifecycle, {});
        assert.deepEqual(pkg.engines, { bun: ">=1.4" });
        for (const field of ["prettier", "remarkConfig", "cspell"]) {
            assert.equal(pkg[field], undefined, field);
        }
    }));

test("husky is gone; hk installs the hooks from mise", () =>
    eachView(({ files, read }) => {
        const pkg = JSON.parse(read("package.json"));
        assert.equal(pkg.devDependencies.husky, undefined);
        assert.ok(!files.some((file) => file.startsWith(".husky/")));
        assert.match(
            read(".config/mise/config.toml"),
            /^postinstall = 'test -n "\$\{CI-\}" \|\| \{ bun ci && hk install --mise; \}'$/m,
        );
    }));

// 0.x: every functional change is breaking, so a range would take one in;
// and hk-config names one Biome.
test("the shared hk steps, mise tasks and Biome are pinned exactly", () =>
    eachView(({ read }) => {
        const { devDependencies: deps } = JSON.parse(read("package.json"));
        for (const name of [
            "@chewygumxx/hk-config",
            "@chewygumxx/mise-tasks-config",
            "@biomejs/biome",
        ]) {
            assert.match(deps[name] ?? "", /^\d+\.\d+\.\d+$/, name);
        }
    }));

// What hk-config's steps run: each optional peer it names, publint and
// attw only where the package check runs, and each configuration read.
test("every package the shared steps run is a devDependency", () => {
    const peers = Object.keys(
        JSON.parse(
            readFileSync(
                join(ROOT, "node_modules/@chewygumxx/hk-config/package.json"),
                "utf8",
            ),
        ).peerDependencies,
    );
    eachView(({ read }) => {
        const { devDependencies: deps } = JSON.parse(read("package.json"));
        const hk = read(".config/hk.pkl");
        const packages = !hk.includes('.remove("packages")');
        for (const peer of peers) {
            if (peer === "publint") assert.equal(peer in deps, packages);
            else if (peer === "@arethetypeswrong/cli") {
                assert.equal(peer in deps, hk.includes("attw"));
            } else assert.ok(peer in deps, peer);
        }
        for (const config of [
            "actionlint-config",
            "biome-config",
            "commitlint-config",
            "cspell-config",
            "editorconfig-checker-config",
            "markdownlint-cli2-config",
            "prettier-config",
            "remark-preset",
            "secretlint-rule-preset",
            "shellcheck-config",
            "tsconfig",
            "yamllint-config",
        ]) {
            assert.ok(`@chewygumxx/${config}` in deps, config);
        }
    });
});

test("each configuration the shared steps read is where they read it", () =>
    eachView(({ files, read }) => {
        for (const file of [
            ".config/cspell.json",
            ".config/prettierrc.json",
            ".config/remarkrc.json",
            ".config/tombi.toml",
            ".secretlintrc.json",
            ".markdownlint-cli2.jsonc",
        ]) {
            assert.ok(files.includes(file), file);
        }
        for (const file of [".tombi.toml", ".yamllint.yaml", "mise.toml"]) {
            assert.ok(!files.includes(file), file);
        }
        assert.deepEqual(parse(read(".config/cspell.json")).import, [
            "@chewygumxx/cspell-config",
        ]);
        assert.equal(
            JSON.parse(read(".config/prettierrc.json")),
            "@chewygumxx/prettier-config",
        );
        assert.deepEqual(JSON.parse(read(".config/remarkrc.json")).plugins, [
            "@chewygumxx/remark-preset",
        ]);
        assert.deepEqual(parse(read(".secretlintrc.json")).rules, [
            { id: "@chewygumxx/secretlint-rule-preset" },
        ]);
        assert.equal(
            parse(read(".markdownlint-cli2.jsonc")).config.extends,
            "@chewygumxx/markdownlint-cli2-config",
        );
    }));

// A template's link is made by the copy; see template.test.js.
test("the cgxx: task templates are linked into conf.d", () => {
    assert.equal(
        readlinkSync(join(ROOT, ".config/mise/conf.d/50-cgxx.toml")),
        "../../../node_modules/@chewygumxx/mise-tasks-config/tasks.toml",
    );
    eachView(({ read }) => {
        assert.match(
            read(".config/mise/config.toml"),
            /^includes = \[ "\.config\/mise\/tasks\/\*\.task\.toml" \]$/m,
        );
    });
});

test("each standard task extends its cgxx: template", () =>
    eachView(({ read }) => {
        const tasks = read(".config/mise/tasks/standard.task.toml");
        for (const task of ["install", "test", "check"]) {
            assert.match(
                tasks,
                new RegExp(`^\\[${task}\\]\\nextends = "cgxx:${task}"$`, "m"),
                task,
            );
        }
        assert.match(tasks, /^\[test\]\nextends = "cgxx:test"\nrun {5}= "/m);
        const lint = read(".config/mise/tasks/lint.task.toml");
        assert.match(lint, /^\[lint\]\nextends = "cgxx:lint"$/m);
        assert.match(
            lint,
            /^\["lint:commit"\]\nextends = "cgxx:lint:commit"$/m,
        );
        assert.match(
            read(".config/mise/tasks/format.task.toml"),
            /^\[format\]\nextends = "cgxx:format"$/m,
        );
    }));

// hk's steps.pkl and each hk.pkl name an hk version, and mise installs one:
// all three must agree.
test("hk's version agrees across mise, hk.pkl and the shared steps", () => {
    const shared = readFileSync(
        join(ROOT, "node_modules/@chewygumxx/hk-config/steps.pkl"),
        "utf8",
    );
    eachView(({ read }) => {
        const pinned = /^hk {0,2}= "(\d+\.\d+\.\d+)"$/m.exec(
            read(".config/mise/config.toml"),
        )?.[1];
        assert.ok(pinned);
        const own = read(".config/hk.pkl");
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
        assert.match(own, /^ {16}check = "mise run check --staged"$/m);
        assert.match(own, /mise run lint:commit/);
    });
});

// Installed up front: a lazy install from inside a parallel hk step has
// failed CI.
test("the linters hk runs from mise are pinned, not lazy", () =>
    eachView(({ read }) => {
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
        assert.match(mise, /^sh {1,3}= "\d+\.\d+\.\d+"$/m);
        assert.doesNotMatch(mise, /lazy\s*=\s*true/);
        assert.match(mise, /^CGXX_WIDEN_ON = "bun\.lock \.config /m);
    }));

test("the guidance for agents is AGENTS.md, not .claude/", () =>
    eachView(({ files }) => {
        assert.ok(files.includes("AGENTS.md"));
        assert.ok(!files.some((file) => file.startsWith(".claude/")));
    }));
