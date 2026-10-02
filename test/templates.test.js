// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/templates.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import {
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { types } from "@chewygumxx/commitlint-config";
import { parse } from "jsonc-parser";
import { UsageError } from "../lib/args.js";
import { init } from "../lib/init.js";
import {
    compose,
    copyTemplate,
    RENAMED,
    TEMPLATES_DIR,
} from "../lib/template.js";
import {
    checkFeatures,
    combinations,
    FAMILIES,
    getTemplate,
    label,
    TEMPLATES,
} from "../lib/templates.js";

/** @typedef {import("../lib/templates.js").Template} Template */

const IDENTITY = {
    owner: "example",
    name: "derived-repo",
    description: "A derived repository.",
    topics: ["alpha"],
    scopes: [{ name: "api", fullName: "Api" }],
};

/**
 * @param {{ template: string, features: string[] }} combination
 */
const layersOf = ({ template, features }) =>
    TEMPLATES[template].layers(new Set(features));

test("every template has a family, and layers that exist", () => {
    const layers = readdirSync(TEMPLATES_DIR);
    for (const combination of combinations()) {
        const name = label(combination.template, combination.features);
        assert.ok(
            Object.hasOwn(FAMILIES, TEMPLATES[combination.template].family),
            name,
        );
        assert.deepEqual(
            layersOf(combination).filter((layer) => !layers.includes(layer)),
            [],
            name,
        );
    }
});

test("every layer belongs to a template", () => {
    const used = new Set(combinations().flatMap(layersOf));
    assert.deepEqual(
        readdirSync(TEMPLATES_DIR).filter((layer) => !used.has(layer)),
        [],
    );
});

test("cloudflare replaces the bun package and adds the Worker", () => {
    const sources = compose(TEMPLATES.cloudflare.layers(new Set()));
    for (const file of [
        "package.json",
        "bun.lock",
        "tsconfig.json",
        ".biome.json",
        "_gitignore",
        "README.md",
        "wrangler.jsonc",
        "worker-configuration.d.ts",
        "vitest.config.ts",
        "src/index.ts",
        "test/index.test.ts",
        ".github/workflows/deploy.yaml",
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(sources.get(file) ?? "", /templates\/cloudflare\//, file);
    }
    // The typescript layer's test imports a function the Worker replaces.
    assert.ok(!sources.has("src/index.test.ts"));
    const pkg = JSON.parse(
        readFileSync(sources.get("package.json") ?? "", "utf8"),
    );
    assert.equal(pkg.private, true);
    assert.equal(pkg.scripts.test, "vitest run");
    assert.equal(pkg.scripts.types, "wrangler types --include-runtime=false");
    assert.match(pkg.scripts.check, /bun run types:check/);
});

// The full runtime types are 600 KB of Cloudflare's doc comments, em dashes
// included, which lint:emdash and the hooks refuse.
test("no template file holds an em dash", () => {
    for (const combination of combinations()) {
        const bad = [...compose(layersOf(combination)).entries()]
            .filter(([, source]) =>
                readFileSync(source, "utf8").includes("\u2014"),
            )
            .map(([file]) => file);
        assert.deepEqual(
            bad,
            [],
            label(combination.template, combination.features),
        );
    }
});

// CI's editorconfig-checker refuses tabs where the .editorconfig says spaces,
// and Wrangler writes worker-configuration.d.ts with tabs.
test("a template file indented with tabs is allowed by its .editorconfig", () => {
    for (const combination of combinations()) {
        const sources = compose(layersOf(combination));
        const config = readFileSync(sources.get(".editorconfig") ?? "", "utf8");
        const tabs = (/** @type {string} */ name) =>
            new RegExp(
                `^\\[${name.replaceAll(".", "\\.")}\\]\\n(?:(?!\\[).*\\n)*?indent_style = tab$`,
                "m",
            ).test(config);
        const refused = [...sources]
            .filter(([, source]) => /^\t/m.test(readFileSync(source, "utf8")))
            .map(([file]) => file)
            .filter((file) => !tabs(file.split("/").at(-1) ?? file));
        assert.deepEqual(
            refused,
            [],
            label(combination.template, combination.features),
        );
    }
});

// The job must stay skipped until the account is configured, and must not
// deploy a pull request's run.
test("the deploy job needs the account, and a push or a manual run", () => {
    const text = readFileSync(
        compose(TEMPLATES.cloudflare.layers(new Set())).get(
            ".github/workflows/deploy.yaml",
        ) ?? "",
        "utf8",
    );
    const condition = /^ {8}if: >-\n((?: {12}.*\n)+)/m
        .exec(text)?.[1]
        .replace(/\s+/g, " ")
        .trim();
    assert.equal(
        condition,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub expression, not a template
        "${{ vars.CLOUDFLARE_ACCOUNT_ID != '' && ( github.event_name == 'workflow_dispatch' || ( github.event.workflow_run.event == 'push' && github.event.workflow_run.conclusion == 'success')) }}",
    );
});

test("a Worker's name must be a lowercase label of 1 to 63 characters", () => {
    const { checkName } = TEMPLATES.cloudflare;
    assert.ok(checkName);
    for (const name of ["a", "my-worker", "w2", "a".repeat(63)]) {
        checkName({ owner: "example", name }, new Set());
    }
    for (const name of [
        "My-Worker",
        "my_worker",
        "my.worker",
        "-worker",
        "worker-",
        "a".repeat(64),
    ]) {
        assert.throws(
            () => checkName({ owner: "example", name }, new Set()),
            (error) =>
                error instanceof UsageError &&
                /Worker name/.test(error.message),
            name,
        );
    }
});

test("rust is the native layer, Cargo and a binary", () => {
    const sources = compose(TEMPLATES.rust.layers(new Set()));
    for (const [file, layer] of [
        ["mise.toml", "native"],
        ["committed.toml", "native"],
        [".githooks/pre-commit", "native"],
        [".github/workflows/ci.yaml", "native"],
        ["Cargo.toml", "rust"],
        ["Cargo.lock", "rust"],
        ["rustfmt.toml", "rust"],
        [".config/mise/conf.d/rust.toml", "rust"],
        ["_gitignore", "rust"],
        [".github/dependabot.yml", "rust"],
        ["README.md", "rust"],
        ["src/main.rs", "rust-bin"],
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            new RegExp(`templates/${layer}/`),
            file,
        );
    }
    for (const file of ["package.json", ".husky/pre-commit", "src/lib.rs"]) {
        assert.ok(!sources.has(file), file);
    }
    assert.match(
        readFileSync(sources.get("_gitignore") ?? "", "utf8"),
        /^\/target\/$/m,
    );
});

test("rust with lib swaps the binary for a library", () => {
    const sources = compose(TEMPLATES.rust.layers(new Set(["lib"])));
    assert.match(sources.get("src/lib.rs") ?? "", /templates\/rust-lib\//);
    assert.ok(!sources.has("src/main.rs"));
});

test("rust offers lib and takes nothing by default", () => {
    assert.deepEqual(Object.keys(TEMPLATES.rust.features), ["lib"]);
    assert.equal(TEMPLATES.rust.defaultFeatures, undefined);
});

// Bun prints no deprecation notices, so the install needs no flags to quiet
// them; a lock that no longer matches package.json fails it.
test("the bun family installs from its lock alone", () => {
    assert.deepEqual(FAMILIES.bun, {
        setup: [{ file: "bun", args: ["install", "--frozen-lockfile"] }],
        format: { file: "bun", args: ["run", "--silent", "format"] },
        check: { file: "bun", args: ["run", "check"] },
    });
    assert.equal(FAMILIES.npm, undefined);
});

test("every template's family is bun or native", () => {
    for (const [name, { family }] of Object.entries(TEMPLATES)) {
        assert.ok(["bun", "native"].includes(family), name);
    }
});

test("the native family runs its checks through mise, not Bun", () => {
    assert.equal(TEMPLATES.rust.family, "native");
    assert.deepEqual(FAMILIES.native.setup, []);
    assert.deepEqual(FAMILIES.native.format, {
        file: "mise",
        args: ["run", "format"],
    });
    assert.deepEqual(FAMILIES.native.check, {
        file: "mise",
        args: ["run", "check"],
    });
});

// A hook or task that is not executable fails every commit that meets it.
test("the native hooks and the commitlint task are executable once copied", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
    try {
        const dir = join(root, "x");
        copyTemplate(dir, layersOf({ template: "rust", features: [] }));
        for (const file of [
            ".githooks/pre-commit",
            ".githooks/commit-msg",
            ".config/mise/tasks/commitlint",
        ]) {
            assert.ok(statSync(join(dir, file)).mode & 0o100, file);
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

// There is no npm to install the shared configurations from, so the native
// layer holds copies, and a change to the packages would otherwise go
// unnoticed.
test("the native Biome configuration is the shared one", () => {
    const shared = JSON.parse(
        readFileSync(
            fileURLToPath(import.meta.resolve("@chewygumxx/biome-config")),
            "utf8",
        ),
    );
    const own = JSON.parse(
        readFileSync(join(TEMPLATES_DIR, "native", ".biome.json"), "utf8"),
    );
    assert.deepEqual(own, shared);
});

test("the native commit types are the shared ones", () => {
    const toml = readFileSync(
        join(TEMPLATES_DIR, "native", "committed.toml"),
        "utf8",
    );
    const listed = /^allowed_types\s*=\s*\[([^\]]*)\]/m.exec(toml)?.[1] ?? "";
    assert.deepEqual(
        [...listed.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
        types.map((type) => type.name),
    );
});

// `cargo test --locked` fails when they differ, which only the CI matrix
// would notice.
test("the rust layer's Cargo.lock names the crate its Cargo.toml does", () => {
    const dir = join(TEMPLATES_DIR, "rust");
    const toml = readFileSync(join(dir, "Cargo.toml"), "utf8");
    const name = /^name\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    const version = /^version\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    assert.ok(
        readFileSync(join(dir, "Cargo.lock"), "utf8").includes(
            `[[package]]\nname = "${name}"\nversion = "${version}"\n`,
        ),
    );
});

test("a crate's name is 1 to 64 letters, digits, - and _, a library's lowercase", () => {
    const { checkName } = TEMPLATES.rust;
    assert.ok(checkName);
    /**
     * @param {string} name
     * @param {string[]} features
     */
    const check = (name, ...features) =>
        checkName({ owner: "example", name }, new Set(features));
    for (const name of ["a", "my-tool", "My_Tool2", "a".repeat(64)]) {
        assert.doesNotThrow(() => check(name), name);
    }
    for (const name of [
        "my.tool",
        "-tool",
        "_tool",
        "1tool",
        "my tool",
        "a".repeat(65),
    ]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError && /crate name/.test(error.message),
            name,
        );
    }
    // Cargo refuses a keyword and `test` for every crate.
    for (const name of ["fn", "match", "self", "async", "try", "test"]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError && /crate name/.test(error.message),
            name,
        );
        assert.throws(() => check(name, "lib"), UsageError, name);
    }
    // `std` shadows the standard library in the library's own tests, and
    // `gen` is a keyword from edition 2024, which the template uses. Cargo
    // accepts both. `core` and its like only draw a Cargo warning.
    for (const name of ["std", "gen"]) {
        assert.doesNotThrow(() => check(name), name);
        assert.throws(() => check(name, "lib"), UsageError, name);
    }
    for (const name of ["core", "alloc", "proc_macro", "proc-macro"]) {
        assert.doesNotThrow(() => check(name), name);
        assert.doesNotThrow(() => check(name, "lib"), name);
    }
    // A binary named for Cargo's build directories fails to parse.
    for (const name of ["build", "deps", "examples", "incremental"]) {
        assert.doesNotThrow(() => check(name, "lib"), name);
        assert.throws(() => check(name), UsageError, name);
    }
    // Cargo warns that a Windows reserved filename "will not work on Windows
    // platforms", in any case, for every crate.
    for (const name of ["con", "PRN", "Aux", "nul", "com1", "COM9", "lpt1"]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError && /Windows/.test(error.message),
            name,
        );
        assert.throws(() => check(name, "lib"), UsageError, name);
    }
    for (const name of ["com", "com0", "com10", "lpt", "console", "nuls"]) {
        assert.doesNotThrow(() => check(name), name);
    }
    assert.doesNotThrow(() => check("my-lib", "lib"));
    for (const name of ["My-Lib", "myLib", "my--lib", "my__lib", "a_-b"]) {
        assert.doesNotThrow(() => check(name), name);
        assert.throws(
            () => check(name, "lib"),
            (error) =>
                error instanceof UsageError && /snake case/.test(error.message),
            name,
        );
    }
});

test("rust is initialised with the crate's name, scopes and module", () => {
    for (const features of [[], ["lib"]]) {
        const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
        try {
            const dir = join(root, "x");
            const files = copyTemplate(
                dir,
                layersOf({ template: "rust", features }),
            );
            init(dir, IDENTITY, files, {
                edits: TEMPLATES.rust.edits,
                features,
                today: "2026-10-01",
            });
            /** @param {string} file */
            const at = (file) => readFileSync(join(dir, file), "utf8");
            assert.match(at("Cargo.toml"), /^name\s*= "derived-repo"$/m);
            assert.match(at("Cargo.lock"), /^name = "derived-repo"$/m);
            assert.match(at("committed.toml"), /^ {4}"api",$/m);
            if (features.includes("lib")) {
                assert.match(at("src/lib.rs"), /derived_repo::greeting/);
            }
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    }
});

test("nvim is the native layer, a Lua plugin and its tests", () => {
    const sources = compose(TEMPLATES.nvim.layers(new Set()));
    for (const [file, layer] of [
        ["mise.toml", "native"],
        ["committed.toml", "native"],
        [".githooks/pre-commit", "native"],
        [".github/workflows/ci.yaml", "native"],
        [".config/mise/conf.d/nvim.toml", "nvim"],
        [".luafmt.toml", "nvim"],
        [".luarc.json", "nvim"],
        ["selene.toml", "nvim"],
        ["vim.yml", "nvim"],
        ["lua/repo_tmpl/init.lua", "nvim"],
        ["lua/repo_tmpl/health.lua", "nvim"],
        ["plugin/repo_tmpl.lua", "nvim"],
        ["doc/repo_tmpl.txt", "nvim"],
        ["tests/minimal_init.lua", "nvim"],
        ["tests/run.lua", "nvim"],
        ["tests/test_repo_tmpl.lua", "nvim"],
        ["_gitignore", "nvim"],
        ["README.md", "nvim"],
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            new RegExp(`templates/${layer}/`),
            file,
        );
    }
    for (const file of ["package.json", "Cargo.toml", "src/main.rs"]) {
        assert.ok(!sources.has(file), file);
    }
    const ignored = readFileSync(sources.get("_gitignore") ?? "", "utf8");
    assert.match(ignored, /^\/\.tests\/$/m);
    assert.match(ignored, /^\/doc\/tags$/m);
});

test("nvim has no features", () => {
    assert.deepEqual(TEMPLATES.nvim.features, {});
    assert.equal(TEMPLATES.nvim.family, "native");
});

// mini.test is cloned at this tag by `deps`, and LuaLS reads it as a library,
// so the two must be one thing.
test("the nvim layer names one mini.test tag, which its types read", () => {
    const toml = readFileSync(
        join(TEMPLATES_DIR, "nvim", ".config/mise/conf.d/nvim.toml"),
        "utf8",
    );
    assert.equal(
        toml.match(/MINI_TEST_TAG\s*=\s*"v\d+\.\d+\.\d+"/g)?.length,
        1,
    );
    const luarc = JSON.parse(
        readFileSync(join(TEMPLATES_DIR, "nvim", ".luarc.json"), "utf8"),
    );
    assert.ok(luarc["workspace.library"].includes(".tests/mini.test"));
    assert.ok(luarc["workspace.ignoreDir"].includes(".tests"));
});

// `-u` with `-l` leaves `packpath` alone, so a package installed on the
// machine is sourced into every run, and a test that needs one passes here and
// fails in CI.
test("the nvim test run isolates the packpath as well as the runtimepath", () => {
    const init = readFileSync(
        join(TEMPLATES_DIR, "nvim", "tests/minimal_init.lua"),
        "utf8",
    );
    assert.match(init, /^vim\.o\.packpath\s*= vim\.env\.VIMRUNTIME$/m);
});

// mini.test's own default is recursive; a narrower one skips nested tests
// while `mise run check` stays green.
test("the nvim test run collects tests in subdirectories", () => {
    const run = readFileSync(
        join(TEMPLATES_DIR, "nvim", "tests/run.lua"),
        "utf8",
    );
    assert.match(run, /"\*\*\/test_\*\.lua"/);
});

// `:help local-additions` reads only a doc file's first line, for its tag.
test("the nvim help file opens with its tag", () => {
    const doc = readFileSync(
        join(TEMPLATES_DIR, "nvim", "doc/repo_tmpl.txt"),
        "utf8",
    );
    assert.match(doc.split("\n")[0], /^\*repo_tmpl\.txt\*\s+\S/);
});

test("a plugin's module is the name without .nvim or nvim-, and a Lua name", () => {
    const { checkName } = TEMPLATES.nvim;
    assert.ok(checkName);
    /** @param {string} name */
    const check = (name) => checkName({ owner: "example", name }, new Set());
    for (const name of [
        "a",
        "my-plugin",
        "my-plugin.nvim",
        "nvim-my-plugin",
        "nvim-my-plugin.nvim",
        "_x",
        "My_Plugin2",
        "a".repeat(100),
    ]) {
        assert.doesNotThrow(() => check(name), name);
    }
    for (const name of [
        "my.plugin",
        "my.plugin.nvim",
        "nvim-",
        ".nvim",
        "nvim-.nvim",
        "1plugin",
        "nvim-1plugin",
        "-plugin",
        "my plugin",
        // The template's own module, however it is affixed: `repo-tmpl` is
        // what init's guard looks for, and a case-insensitive filesystem
        // would keep the directory `lua/repo_tmpl/` for `Repo_Tmpl`.
        "nvim-repo-tmpl",
        "repo-tmpl.nvim",
        "nvim-repo_tmpl.nvim",
        "Repo_Tmpl.nvim",
        "REPO_TMPL",
    ]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError && /module/.test(error.message),
            name,
        );
    }
});

// Every path of the template spells the module with an underscore and init's
// guard is case sensitive, so a hyphenated name in another case clashes with
// neither: it is renamed like any other, and the guard still reads the rest.
test("a hyphenated template name in another case is a module like any", () => {
    for (const [template, names] of /** @type {[string, string[]][]} */ ([
        [
            "nvim",
            ["Repo-Tmpl", "REPO-TMPL", "nvim-Repo-TMPL", "Repo-Tmpl.nvim"],
        ],
        ["zsh", ["Repo-Tmpl", "REPO-TMPL"]],
    ])) {
        const { checkName } = TEMPLATES[template];
        assert.ok(checkName);
        for (const name of names) {
            assert.doesNotThrow(
                () => checkName({ owner: "example", name }, new Set()),
                name,
            );
        }
    }
});

test("nvim is initialised with the module's name in every path", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
    try {
        const dir = join(root, "x");
        const files = copyTemplate(
            dir,
            layersOf({ template: "nvim", features: [] }),
        );
        init(dir, { ...IDENTITY, name: "nvim-derived.nvim" }, files, {
            edits: TEMPLATES.nvim.edits,
            today: "2026-10-01",
        });
        /** @param {string} file */
        const at = (file) => readFileSync(join(dir, file), "utf8");
        for (const file of [
            "lua/derived/init.lua",
            "lua/derived/health.lua",
            "plugin/derived.lua",
            "doc/derived.txt",
            "tests/test_derived.lua",
        ]) {
            assert.ok(existsSync(join(dir, file)), file);
        }
        assert.ok(!existsSync(join(dir, "lua/repo_tmpl")));
        assert.match(
            at("lua/derived/init.lua"),
            /^-- ::: :\/lua\/derived\/init\.lua$/m,
        );
        assert.match(
            at("lua/derived/init.lua"),
            /^-- ~example\/nvim-derived\.nvim\.git$/m,
        );
        assert.match(at("plugin/derived.lua"), /vim\.g\["loaded_derived"\]/);
        assert.match(at("committed.toml"), /^ {4}"api",$/m);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("zsh is the native layer, a zsh plugin and its tests", () => {
    const sources = compose(TEMPLATES.zsh.layers(new Set()));
    for (const [file, layer] of [
        ["mise.toml", "native"],
        ["committed.toml", "native"],
        [".githooks/pre-commit", "native"],
        [".github/workflows/ci.yaml", "native"],
        ["_gitignore", "native"],
        [".config/mise/conf.d/zsh.toml", "zsh"],
        [".shuck.toml", "zsh"],
        [".github/apt-packages.txt", "zsh"],
        ["repo_tmpl.plugin.zsh", "zsh"],
        ["functions/repo_tmpl", "zsh"],
        ["tests/run.zsh", "zsh"],
        ["tests/test_repo_tmpl.zsh", "zsh"],
        ["README.md", "zsh"],
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            new RegExp(`templates/${layer}/`),
            file,
        );
    }
    for (const file of [
        "package.json",
        "Cargo.toml",
        "lua/repo_tmpl/init.lua",
    ]) {
        assert.ok(!sources.has(file), file);
    }
});

test("zsh has no features", () => {
    assert.deepEqual(TEMPLATES.zsh.features, {});
    assert.equal(TEMPLATES.zsh.family, "native");
});

test("the zsh layer's apt packages name zsh, which mise does not install", () => {
    assert.equal(
        readFileSync(
            join(TEMPLATES_DIR, "zsh", ".github/apt-packages.txt"),
            "utf8",
        ),
        "zsh\n",
    );
});

test("shuck reads the zsh scripts as zsh and formats as the native hooks are", () => {
    const config = readFileSync(
        join(TEMPLATES_DIR, "zsh", ".shuck.toml"),
        "utf8",
    );
    assert.match(config, /^"\*\*\/\*\.zsh"\s+= "zsh"$/m);
    assert.match(config, /^"functions\/\*"\s+= "zsh"$/m);
    // A repository's shuck configuration makes the shared CI run shuck over
    // the hooks too, which are formatted as shfmt does: only the indentation
    // is set.
    assert.match(config, /^indent-style = "space"$/m);
    assert.match(config, /^indent-width = 4$/m);
    assert.doesNotMatch(
        config,
        /space-redirects|keep-padding|switch-case-indent|binary-next-line|function-next-line|never-split/,
    );
});

test("the zsh tasks name the files, which shuck's own walk never finds", () => {
    const tasks = readFileSync(
        join(TEMPLATES_DIR, "zsh", ".config/mise/conf.d/zsh.toml"),
        "utf8",
    );
    // An autoloaded function has no extension and no shebang, so a bare
    // `shuck` command would skip `functions/*`.
    assert.doesNotMatch(tasks, /^shuck /m);
    assert.match(
        tasks,
        /'\*\.zsh' 'functions\/\*' \| xargs -0 -r shuck check --$/m,
    );
    assert.match(
        tasks,
        /'\*\.zsh' 'functions\/\*' \| xargs -0 -r shuck format --diff --$/m,
    );
    assert.match(tasks, /xargs -0 -r -n 1 zsh -n --$/m);
    // `-f` skips the startup files, so the machine's cannot change a run.
    assert.match(tasks, /^run\s+= "zsh -f tests\/run\.zsh"$/m);
});

test("a zsh plugin's name is a function's: no leading -, no reserved word", () => {
    const { checkName } = TEMPLATES.zsh;
    assert.ok(checkName);
    /** @param {string} name */
    const check = (name) => checkName({ owner: "example", name }, new Set());
    for (const name of [
        "a",
        "my-plugin",
        "zsh-my-plugin",
        "My_Plugin2",
        "_x",
        "0",
        "1a",
        "a--b",
        "echo",
        "a".repeat(100),
    ]) {
        assert.doesNotThrow(() => check(name), name);
    }
    for (const name of [
        "-plugin",
        "my.plugin",
        "my plugin",
        "if",
        "while",
        "until",
        "function",
        "time",
        "end",
        "select",
        // Reserved words that zsh's own list holds beside those.
        "local",
        "export",
        "typeset",
        "declare",
        "float",
        "integer",
        "readonly",
        // Builtins the layer's own code calls, which the function would
        // shadow: `exit` then turns a failed assertion into a pass.
        "exit",
        "print",
        "return",
        "source",
        "emulate",
        "autoload",
        "unfunction",
        "unset",
        // The runner's own names: `test_*` functions are its tests, and the
        // others are functions its helpers define.
        "test_x",
        "test_greets",
        // Its unload function, `test_plugin_unload`, would run as a test.
        "test",
        "assert_equal",
        "on_fpath",
        // The template's own name, which init cannot tell from a leftover, and
        // which a case-insensitive filesystem would keep as
        // `repo_tmpl.plugin.zsh` in another case.
        "Repo_Tmpl",
        "REPO_TMPL",
        "repo-tmpl",
    ]) {
        assert.throws(
            () => check(name),
            (error) =>
                error instanceof UsageError &&
                /plugin name/.test(error.message),
            name,
        );
    }
});

// `test` is not a word zsh reads as syntax: the generic message, which lists
// those, would not say why it is refused.
test("a zsh plugin named for the test runner's functions says so", () => {
    const { checkName } = TEMPLATES.zsh;
    assert.ok(checkName);
    for (const name of ["test", "test_x", "assert_equal", "on_fpath"]) {
        assert.throws(
            () => checkName({ owner: "example", name }, new Set()),
            (error) =>
                error instanceof UsageError &&
                /test runner/.test(error.message) &&
                error.message.includes(`"${name}"`),
            name,
        );
    }
});

test("zsh is initialised with the plugin's name in every path", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
    try {
        const dir = join(root, "x");
        const files = copyTemplate(
            dir,
            layersOf({ template: "zsh", features: [] }),
        );
        init(dir, { ...IDENTITY, name: "zsh-derived" }, files, {
            edits: TEMPLATES.zsh.edits,
            today: "2026-10-01",
        });
        /** @param {string} file */
        const at = (file) => readFileSync(join(dir, file), "utf8");
        for (const file of [
            "zsh-derived.plugin.zsh",
            "functions/zsh-derived",
            "tests/test_zsh-derived.zsh",
        ]) {
            assert.ok(existsSync(join(dir, file)), file);
        }
        assert.ok(!existsSync(join(dir, "repo_tmpl.plugin.zsh")));
        assert.ok(!existsSync(join(dir, "functions/repo_tmpl")));
        const plugin = at("zsh-derived.plugin.zsh");
        assert.match(plugin, /^# ::: :\/zsh-derived\.plugin\.zsh$/m);
        assert.match(plugin, /^# ~example\/zsh-derived\.git$/m);
        assert.match(plugin, /^Plugins\[zsh-derived_dir\]=/m);
        assert.match(plugin, /^zsh-derived_plugin_unload\(\) \{$/m);
        assert.match(at("committed.toml"), /^ {4}"api",$/m);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("typescript takes publish by default at the prompt", () => {
    assert.deepEqual(TEMPLATES.typescript.defaultFeatures, ["publish"]);
});

test("every default feature is one the template has", () => {
    for (const [name, template] of Object.entries(TEMPLATES)) {
        for (const feature of template.defaultFeatures ?? []) {
            assert.ok(Object.hasOwn(template.features, feature), name);
        }
    }
});

test("typescript adds sources, tests and its own package over bun", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set()));
    for (const file of [
        "src/index.ts",
        "src/index.test.ts",
        "tsconfig.json",
        "package.json",
        "bun.lock",
        "README.md",
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(sources.get(file) ?? "", /templates\/typescript\//, file);
    }
    const pkg = JSON.parse(
        readFileSync(sources.get("package.json") ?? "", "utf8"),
    );
    assert.equal(pkg.type, "module");
    assert.equal(pkg.private, true);
    assert.equal(pkg.engines.bun, ">=1.4");
    assert.equal(pkg.scripts.test, "bun test");
    assert.match(pkg.scripts.check, /bun run test/);
});

test("publish replaces the package, adds the build and the workflow", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set(["publish"])));
    for (const file of [
        "package.json",
        "bun.lock",
        "_gitignore",
        "README.md",
        "tsconfig.build.json",
        ".github/workflows/publish.yaml",
    ]) {
        assert.ok(sources.has(file), file);
        assert.match(
            sources.get(file) ?? "",
            /templates\/typescript-publish\//,
            file,
        );
    }
    const pkg = JSON.parse(
        readFileSync(sources.get("package.json") ?? "", "utf8"),
    );
    assert.ok(!("private" in pkg));
    assert.equal(pkg.name, "@chewygumxx/repo-tmpl");
    assert.deepEqual(pkg.files, ["dist"]);
    assert.equal(pkg.scripts.prepack, "bun run build");
    assert.equal(pkg.publishConfig.provenance, true);
    assert.match(pkg.scripts.check, /bun run build/);
    assert.match(
        readFileSync(sources.get("_gitignore") ?? "", "utf8"),
        /^\/dist\/$/m,
    );
});

// The package stays private, and unpublishable by accident.
test("typescript without publish carries no publishing", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set()));
    assert.ok(!sources.has(".github/workflows/publish.yaml"));
    assert.ok(!sources.has("tsconfig.build.json"));
    assert.doesNotMatch(
        readFileSync(sources.get("_gitignore") ?? "", "utf8"),
        /dist/,
    );
});

test("a published package's name must be a lowercase npm name", () => {
    const { checkName } = TEMPLATES.typescript;
    assert.ok(checkName);
    const publish = new Set(["publish"]);
    checkName({ owner: "example", name: "my.thing_2" }, publish);
    // Not published: any GitHub name will do.
    checkName({ owner: "Example", name: ".Github" }, new Set());
    for (const name of ["X", ".github", "_notes"]) {
        assert.throws(
            () => checkName({ owner: "example", name }, publish),
            (error) =>
                error instanceof UsageError &&
                error.message.includes(`@example/${name}`) &&
                /lowercase/.test(error.message),
            name,
        );
    }
});

// It comes from --owner or the gh login, so the message says where to change it.
test("a published package's owner must be lowercase, and says how to change it", () => {
    const { checkOwner } = TEMPLATES.typescript;
    assert.ok(checkOwner);
    checkOwner("example", new Set(["publish"]));
    checkOwner("Example", new Set());
    assert.throws(
        () => checkOwner("Example", new Set(["publish"])),
        (error) =>
            error instanceof UsageError &&
            /"Example"/.test(error.message) &&
            /lowercase/.test(error.message) &&
            /--owner/.test(error.message) &&
            /gh login/.test(error.message),
    );
});

// A frozen install fails when they differ, which only the CI matrix would
// otherwise notice.
test("each layer's bun.lock matches its package.json", () => {
    for (const layer of readdirSync(TEMPLATES_DIR)) {
        const dir = join(TEMPLATES_DIR, layer);
        if (!existsSync(join(dir, "package.json"))) continue;
        assert.ok(!existsSync(join(dir, "package-lock.json")), layer);
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        const root = parse(readFileSync(join(dir, "bun.lock"), "utf8"), [], {
            allowTrailingComma: true,
        }).workspaces[""];
        assert.equal(root.name, pkg.name, layer);
        for (const field of [
            "dependencies",
            "devDependencies",
            "optionalDependencies",
            "peerDependencies",
        ]) {
            assert.deepEqual(root[field], pkg[field], `${layer} ${field}`);
        }
    }
});

// A Node on PATH, as every CI runner has, would otherwise run the CLIs
// whose shebang names node.
test("every bun template runs its scripts on Bun", () => {
    for (const combination of combinations()) {
        if (TEMPLATES[combination.template].family !== "bun") continue;
        const bunfig = compose(layersOf(combination)).get("bunfig.toml");
        assert.ok(bunfig, combination.template);
        assert.match(
            readFileSync(bunfig, "utf8"),
            /^\[run\]\nbun = true$/m,
            combination.template,
        );
    }
});

test("every bun template's package runs on Bun", () => {
    for (const layer of [
        "bun",
        "typescript",
        "typescript-publish",
        "cloudflare",
    ]) {
        const pkg = JSON.parse(
            readFileSync(join(TEMPLATES_DIR, layer, "package.json"), "utf8"),
        );
        assert.deepEqual(pkg.engines, { bun: ">=1.4" }, layer);
        assert.ok(!("@types/node" in pkg.devDependencies), layer);
        assert.equal(pkg.devDependencies["@types/bun"], "^1.4.2", layer);
        for (const [name, script] of Object.entries(pkg.scripts)) {
            assert.doesNotMatch(
                script,
                /\b(?:npm|npx|node)\b/,
                `${layer} ${name}`,
            );
        }
    }
});

// The header sync would rewrite these to name create-repo and templates/,
// and init would then find no header to rewrite.
test("every template header names the template and its own path", () => {
    for (const combination of combinations()) {
        const sources = compose(layersOf(combination));
        const slug = parse(
            readFileSync(sources.get(".repo-metadata.jsonc") ?? "", "utf8"),
        ).slug;
        const stray = [...sources]
            .filter(([file, source]) => {
                const text = readFileSync(source, "utf8");
                const path = RENAMED[file] ?? file;
                return (
                    text.includes("::: :/") &&
                    !(
                        text.includes(`~${slug}.git`) &&
                        text.includes(`::: :/${path}`)
                    )
                );
            })
            .map(([file]) => file);
        assert.deepEqual(
            stray,
            [],
            label(combination.template, combination.features),
        );
    }
});

test("every combination copies and initialises, leaving no identity", () => {
    for (const combination of combinations()) {
        const root = mkdtempSync(join(tmpdir(), "create-repo-templates-"));
        try {
            const dir = join(root, "x");
            const files = copyTemplate(dir, layersOf(combination));
            assert.ok(files.includes(".gitignore"));
            init(dir, IDENTITY, files, {
                edits: TEMPLATES[combination.template].edits,
                features: combination.features,
                today: "2026-10-01",
            });
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    }
});

/** @type {Record<string, Template>} */
const FAKE = {
    plain: {
        description: "P",
        family: "bun",
        features: {},
        layers: () => ["common"],
        edits: [],
    },
    crate: {
        description: "C",
        family: "bun",
        features: { lib: "L", bin: "B" },
        layers: () => ["common"],
        edits: [],
    },
};

test("an unknown template is a UsageError listing the templates", () => {
    assert.throws(
        () => getTemplate("nope", FAKE),
        (error) =>
            error instanceof UsageError &&
            /"nope".*plain, crate/.test(error.message),
    );
    assert.throws(() => getTemplate("constructor", FAKE), UsageError);
    assert.equal(getTemplate("crate", FAKE), FAKE.crate);
});

test("features are checked, deduplicated and in the template's order", () => {
    assert.deepEqual(
        checkFeatures("crate", FAKE.crate, ["bin", "lib", "bin"]),
        ["lib", "bin"],
    );
    assert.throws(
        () => checkFeatures("crate", FAKE.crate, ["wasm"]),
        (error) =>
            error instanceof UsageError &&
            /no feature "wasm".*lib, bin/.test(error.message),
    );
    assert.throws(
        () => checkFeatures("plain", FAKE.plain, ["lib"]),
        (error) =>
            error instanceof UsageError &&
            /has no features/.test(error.message),
    );
});

test("combinations cover every subset of every template's features", () => {
    assert.deepEqual(combinations(FAKE), [
        { template: "plain", features: [] },
        { template: "crate", features: [] },
        { template: "crate", features: ["lib"] },
        { template: "crate", features: ["bin"] },
        { template: "crate", features: ["lib", "bin"] },
    ]);
});

test("a label names the template and its features", () => {
    assert.equal(label("standard", []), "standard");
    assert.equal(label("rust", ["lib"]), "rust, with lib");
});

test("every bun template ignores the tarballs a pack leaves", () => {
    for (const { template, features } of combinations()) {
        if (TEMPLATES[template].family !== "bun") continue;
        const sources = compose(layersOf({ template, features }));
        assert.match(
            readFileSync(sources.get("_gitignore") ?? "", "utf8"),
            /^\*\.tgz$/m,
            label(template, features),
        );
    }
});

test("a created Worker's Dependabot ignores Vitest majors, others do not", () => {
    const dependabot = (/** @type {string} */ template) =>
        compose(TEMPLATES[template].layers(new Set())).get(
            ".github/dependabot.yml",
        ) ?? "";
    assert.match(dependabot("cloudflare"), /templates\/cloudflare\//);
    assert.match(
        readFileSync(dependabot("cloudflare"), "utf8"),
        /dependency-name: "vitest"/,
    );
    assert.doesNotMatch(
        readFileSync(dependabot("standard"), "utf8"),
        /dependency-name: "vitest"/,
    );
});

test("typescript's example test is Bun's", () => {
    const text = readFileSync(
        join(TEMPLATES_DIR, "typescript", "src", "index.test.ts"),
        "utf8",
    );
    assert.match(text, /from "bun:test"/);
    assert.doesNotMatch(text, /node:test|node:assert/);
});

// Bun cannot stage a publish, nor publish by trusted publishing; npm comes
// from Node, fetched for this step alone.
test("typescript-publish installs with Bun and publishes with npm", () => {
    const text = readFileSync(
        join(
            TEMPLATES_DIR,
            "typescript-publish",
            ".github/workflows/publish.yaml",
        ),
        "utf8",
    );
    assert.match(text, /run: bun install --frozen-lockfile$/m);
    assert.match(text, /run: mise exec node@24 -- npm stage publish$/m);
    assert.doesNotMatch(text, /npm ci|node -p/);
});
