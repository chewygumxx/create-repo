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
import { spawnSync } from "node:child_process";
import {
    existsSync,
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
    getTemplate,
    label,
    STEPS,
    TEMPLATES,
} from "../lib/templates.js";
import { taskScript } from "./mise-task.js";

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

test("every template has layers that exist", () => {
    const layers = readdirSync(TEMPLATES_DIR);
    for (const combination of combinations()) {
        const name = label(combination.template, combination.features);
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

const MISE_SCHEMA = "https://mise.jdx.dev/schema/mise.json";

/** Each TOML file's published schema, by name. */
const SCHEMAS = new Map([
    [".tombi.toml", "https://www.schemastore.org/tombi.json"],
    ["bunfig.toml", "https://www.schemastore.org/bunfig.json"],
    ["mise.toml", MISE_SCHEMA],
]);

/** The TOML files whose tools publish no schema. */
const SCHEMALESS = new Set();

/**
 * The schema a TOML file declares on its third line, after its SPDX line,
 * as `#:schema <url>` for tombi; a new TOML file must be added to SCHEMAS or
 * SCHEMALESS.
 * @param {string} file the path, relative to the repository
 * @param {string} source
 * @returns {string | undefined} what is wrong, if anything
 */
function schemaProblem(file, source) {
    const name = file.split("/").at(-1) ?? file;
    const schema = /^\.config\/mise\/conf\.d\/[^/]+\.toml$/.test(file)
        ? MISE_SCHEMA
        : SCHEMAS.get(name);
    if (schema === undefined) {
        return SCHEMALESS.has(name) ? undefined : `${file}: no known schema`;
    }
    const line = readFileSync(source, "utf8").split("\n")[2];
    return line === `#:schema ${schema}` ? undefined : `${file}: ${line}`;
}

// tombi cannot extend a shared configuration, so each repository carries
// its own, and each file names its schema rather than leaving tombi to look
// it up by name.
test("every template has a .tombi.toml, and each TOML file names its schema", () => {
    for (const combination of combinations()) {
        const name = label(combination.template, combination.features);
        const sources = compose(layersOf(combination));
        assert.ok(sources.has(".tombi.toml"), name);
        const problems = [...sources]
            .filter(([file]) => file.endsWith(".toml"))
            .map(([file, source]) => schemaProblem(file, source))
            .filter(Boolean);
        assert.deepEqual(problems, [], name);
    }
});

const TOMBI_PIN = /^"aqua:tombi-toml\/tombi"\s*=\s*"\d+\.\d+\.\d+"$/m;

/**
 * Asserts that a check formats and lints TOML with tombi.
 * @param {string} script
 * @param {string} name
 */
function assertTombiCheck(script, name) {
    assert.match(script, /'\*\.toml'/, name);
    assert.match(script, /tombi format --check/, name);
    assert.match(script, /tombi lint --error-on-warnings/, name);
}

/**
 * Asserts that a Bun repository's scripts and hook run tombi.
 * @param {string} pkgFile its package.json
 * @param {string} hookFile its .husky/pre-commit
 * @param {string} name
 */
function assertBunRunsTombi(pkgFile, hookFile, name) {
    const { scripts } = JSON.parse(readFileSync(pkgFile, "utf8"));
    assertTombiCheck(scripts["lint:toml"] ?? "", name);
    assert.match(scripts["format:toml"] ?? "", /tombi format$/, name);
    assert.match(scripts.check, /bun run lint:toml/, name);
    assert.match(scripts.format, /bun run format:toml/, name);
    const hook = readFileSync(hookFile, "utf8");
    assert.match(hook, /--cached .*'\*\.toml'/, name);
    assertTombiCheck(hook, name);
}

// An editor reads .tombi.toml, but nothing enforces it unless the toolchain
// pins tombi and the checks, formatters and hooks run it.
test("every template pins tombi, and its checks run it", () => {
    for (const combination of combinations()) {
        const name = label(combination.template, combination.features);
        const sources = compose(layersOf(combination));
        const mise = sources.get("mise.toml") ?? "";
        assert.match(readFileSync(mise, "utf8"), TOMBI_PIN, name);
        if (sources.has("package.json")) {
            assertBunRunsTombi(
                sources.get("package.json") ?? "",
                sources.get(".husky/pre-commit") ?? "",
                name,
            );
        } else {
            assertTombiCheck(taskScript(mise, "lint:toml"), name);
            assert.match(
                taskScript(mise, "format:toml"),
                /tombi format$/,
                name,
            );
            const staged = taskScript(mise, "pre-commit:toml");
            assert.match(staged, /--cached /, name);
            assertTombiCheck(staged, name);
        }
    }
});

/** Pins of the tools CI's lint jobs run, which a bun template runs too. */
const HYGIENE_PINS = [
    "aqua:koalaman/shellcheck",
    "aqua:mvdan/sh",
    "aqua:editorconfig-checker/editorconfig-checker",
    "aqua:rhysd/actionlint",
].map(
    (tool) =>
        new RegExp(
            `^"${tool.replaceAll("/", "\\/")}"\\s*=\\s*"\\d+\\.\\d+\\.\\d+"$`,
            "m",
        ),
);

/** Each shared configuration, and the package that runs by it. */
const SHARED = {
    "@chewygumxx/tsconfig": "typescript",
    "@chewygumxx/cspell-config": "cspell",
    "@chewygumxx/secretlint-rule-preset": "secretlint",
    "@chewygumxx/markdownlint-cli2-config": "markdownlint-cli2",
    "@chewygumxx/prettier-config": "prettier",
    "@chewygumxx/shellcheck-config": undefined,
    "@chewygumxx/editorconfig-checker-config": undefined,
    "@chewygumxx/actionlint-config": undefined,
};

// A shared configuration is enforced only where the template depends on it,
// and its check and its pre-commit hook run the tool by it.
test("every bun template checks by the shared configurations", () => {
    for (const combination of combinations()) {
        const name = label(combination.template, combination.features);
        const sources = compose(layersOf(combination));
        /** @param {string} file */
        const read = (file) =>
            readFileSync(
                sources.get(file) ?? assert.fail(`${name}: no ${file}`),
                "utf8",
            );
        const mise = read("mise.toml");
        for (const pin of HYGIENE_PINS) assert.match(mise, pin, name);
        const pkg = JSON.parse(read("package.json"));
        const deps = pkg.devDependencies;
        for (const [config, tool] of Object.entries(SHARED)) {
            assert.ok(config in deps, `${name} ${config}`);
            if (tool) assert.ok(tool in deps, `${name} ${tool}`);
        }
        assert.ok("sort-package-json" in deps, name);
        assert.ok("knip" in deps, name);
        const { scripts } = pkg;
        for (const script of [
            "lint:sh",
            "lint:editorconfig",
            "lint:actions",
            "lint:package",
            "lint:deps",
            "lint:spell",
            "lint:secrets",
        ]) {
            assert.match(
                scripts.check,
                new RegExp(`bun run ${script}( |$)`),
                `${name} ${script}`,
            );
        }
        assert.match(scripts.format, /bun run format:sh$/, name);
        assert.match(scripts["format:sh"], /shfmt -w$/, name);
        assert.match(scripts["lint:sh"], /shfmt -d /, name);
        assert.match(
            scripts["lint:sh"],
            /shellcheck --rcfile node_modules\/@chewygumxx\/shellcheck-config\/config\.shellcheckrc$/,
            name,
        );
        assert.equal(
            scripts["lint:editorconfig"],
            "editorconfig-checker -config node_modules/@chewygumxx/editorconfig-checker-config/config.json",
            name,
        );
        assert.equal(
            scripts["lint:actions"],
            "actionlint -config-file node_modules/@chewygumxx/actionlint-config/config.yaml",
            name,
        );
        assert.match(
            scripts["lint:md"],
            /xargs -0 -r markdownlint-cli2$/,
            name,
        );
        assert.match(
            scripts["lint:package"],
            /^sort-package-json --check package\.json/,
            name,
        );
        assert.match(scripts["lint:spell"], /xargs -0 -r cspell /, name);
        assert.match(scripts["lint:secrets"], /xargs -0 -r secretlint$/, name);
        assert.deepEqual(
            pkg.cspell,
            { import: ["@chewygumxx/cspell-config"] },
            name,
        );
        assert.equal(pkg.prettier, "@chewygumxx/prettier-config", name);
        assert.deepEqual(
            parse(read(".secretlintrc.json")).rules,
            [{ id: "@chewygumxx/secretlint-rule-preset" }],
            name,
        );
        assert.equal(
            parse(read(".markdownlint-cli2.jsonc")).config.extends,
            "@chewygumxx/markdownlint-cli2-config",
            name,
        );
        assert.equal(
            parse(read("tsconfig.json")).extends,
            "@chewygumxx/tsconfig/bun",
            name,
        );
        // Continued lines joined, as the shell reads them.
        const hook = read(".husky/pre-commit").replace(/\\\n\s*/g, "");
        for (const tool of [
            /shellcheck --rcfile node_modules\/@chewygumxx\/shellcheck-config\//,
            /actionlint -config-file node_modules\/@chewygumxx\/actionlint-config\//,
            /editorconfig-checker -config node_modules\/@chewygumxx\/editorconfig-checker-config\//,
            /markdownlint-cli2/,
            /bunx --bun --no-install cspell/,
            /bunx --bun --no-install secretlint/,
        ]) {
            assert.match(hook, tool, name);
        }
    }
});

test("a published template lints its package with publint and attw", () => {
    const pkg = JSON.parse(
        readFileSync(
            join(TEMPLATES_DIR, "typescript-publish", "package.json"),
            "utf8",
        ),
    );
    assert.ok("publint" in pkg.devDependencies);
    assert.ok("@arethetypeswrong/cli" in pkg.devDependencies);
    assert.match(pkg.scripts["lint:package"], /&& publint --level warning &&/);
    assert.match(
        pkg.scripts["lint:package"],
        /attw package\.tgz --profile esm-only/,
    );
});

// A spelling the shared word list lacks would otherwise be recorded as a new
// repository's own word, and never reported.
test("every bun template is spelled to the shared word list", () => {
    const files = new Set();
    for (const combination of combinations()) {
        for (const source of compose(layersOf(combination)).values()) {
            files.add(source);
        }
    }
    const root = fileURLToPath(new URL("..", import.meta.url));
    const config = join(
        mkdtempSync(join(tmpdir(), "create-repo-spell-")),
        "cspell.json",
    );
    writeFileSync(
        config,
        JSON.stringify({
            import: [
                join(
                    root,
                    "node_modules/@chewygumxx/cspell-config/config.yaml",
                ),
            ],
        }),
    );
    const result = spawnSync(
        join(root, "node_modules/.bin/cspell"),
        [
            "lint",
            "--config",
            config,
            "--file-list",
            "stdin",
            "--no-progress",
            "--no-summary",
            "--no-must-find-files",
        ],
        { input: [...files].join("\n"), encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
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

// Bun prints no deprecation notices, so the install needs no flags to quiet
// them; a lock that no longer matches package.json fails it.
test("every template installs from its lock alone", () => {
    // Its words, which the spell check is told, are tested in words.test.js.
    const { words: _words, ...steps } = STEPS;
    assert.deepEqual(steps, {
        setup: [{ file: "bun", args: ["install", "--frozen-lockfile"] }],
        format: { file: "bun", args: ["run", "--silent", "format"] },
        check: { file: "bun", args: ["run", "check"] },
    });
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
        features: {},
        layers: () => ["common"],
        edits: [],
    },
    crate: {
        description: "C",
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
    assert.equal(label("typescript", ["publish"]), "typescript, with publish");
});

test("every bun template ignores the tarballs a pack leaves", () => {
    for (const { template, features } of combinations()) {
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

test("cloudflare deploys with Bun", () => {
    const text = readFileSync(
        join(TEMPLATES_DIR, "cloudflare", ".github/workflows/deploy.yaml"),
        "utf8",
    );
    assert.match(text, /run: bun install --frozen-lockfile$/m);
    assert.match(text, /run: bunx --bun wrangler deploy$/m);
    assert.doesNotMatch(text, /\bnpm\b|\bnpx\b/);
});
