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
        ".config/hk.pkl",
        ".config/mise/tasks/standard.task.toml",
        ".config/mise/tasks/worker.task.toml",
        ".knip.jsonc",
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
    /** @param {string} file */
    const read = (file) => readFileSync(sources.get(file) ?? "", "utf8");
    assert.match(
        read(".config/mise/tasks/standard.task.toml"),
        /^run {5}= "bun run vitest run"$/m,
    );
    const worker = read(".config/mise/tasks/worker.task.toml");
    for (const [task, run] of [
        ["dev", "bun run wrangler dev"],
        ["deploy", "bun run wrangler deploy"],
        ["types", "bun run wrangler types --include-runtime=false"],
    ]) {
        assert.match(
            worker,
            new RegExp(`^\\[${task}\\]\\n[^[]*^run {9}= "${run}"$`, "m"),
            task,
        );
    }
    assert.match(
        read(".config/hk.pkl"),
        /check = "bun run wrangler types --check --include-runtime=false"/,
    );
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

// The package's exports and types are in dist/, which the package check
// builds before publint and attw read the packed tarball.
test("a published template builds, then lints its package with publint and attw", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set(["publish"])));
    const hk = readFileSync(sources.get(".config/hk.pkl") ?? "", "utf8");
    const step = /\["packages"\] \{\n {16}check = """\n([\s\S]*?)"""/.exec(
        hk,
    )?.[1];
    assert.ok(step);
    const commands = step.split("&&").map((command) => command.trim());
    assert.deepEqual(commands, [
        "bun run tsc -p tsconfig.build.json",
        "bun run publint --level warning .",
        "bun pm pack --quiet --filename package.tgz > /dev/null",
        "bun run attw package.tgz --profile esm-only",
        "rm package.tgz",
    ]);
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
    // The words each layer's own configuration adds, such as a path its
    // comments name: a template's files are spelled to its own.
    const words = readdirSync(TEMPLATES_DIR).flatMap((layer) => {
        const file = join(TEMPLATES_DIR, layer, ".config/cspell.json");
        return existsSync(file)
            ? JSON.parse(readFileSync(file, "utf8")).words
            : [];
    });
    writeFileSync(
        config,
        JSON.stringify({
            import: [
                join(
                    root,
                    "node_modules/@chewygumxx/cspell-config/config.yaml",
                ),
            ],
            words,
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
        format: { file: "mise", args: ["run", "format", "--all"] },
        check: { file: "mise", args: ["run", "check", "--all"] },
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
        ".config/mise/tasks/standard.task.toml",
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
    assert.match(
        readFileSync(
            sources.get(".config/mise/tasks/standard.task.toml") ?? "",
            "utf8",
        ),
        /^run {5}= "bun test"$/m,
    );
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
        ".config/hk.pkl",
        ".config/mise/tasks/package.task.toml",
        ".knip.jsonc",
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
    assert.equal(pkg.scripts.prepack, "tsc -p tsconfig.build.json");
    assert.equal(pkg.publishConfig.provenance, true);
    assert.match(
        readFileSync(
            sources.get(".config/mise/tasks/package.task.toml") ?? "",
            "utf8",
        ),
        /^\[build\]\n[^[]*^run {9}= "bun run tsc -p tsconfig\.build\.json"$/m,
    );
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
        assert.match(pkg.devDependencies["@types/bun"], /^\^1\.4\./, layer);
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
    assert.match(text, /run: bun run wrangler deploy$/m);
    assert.doesNotMatch(text, /\bnpm\b|\bnpx\b/);
});
