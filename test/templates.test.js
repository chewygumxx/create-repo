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

test("cloudflare replaces the npm package and adds the Worker", () => {
    const sources = compose(TEMPLATES.cloudflare.layers(new Set()));
    for (const file of [
        "package.json",
        "package-lock.json",
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
    assert.match(pkg.scripts.check, /npm run types:check/);
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

// The job must stay skipped until the account is configured, and must not
// deploy a pull request's run.
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

test("the deploy job needs the account, and a push or a manual run", () => {
    const text = readFileSync(
        compose(TEMPLATES.cloudflare.layers(new Set())).get(
            ".github/workflows/deploy.yaml",
        ) ?? "",
        "utf8",
    );
    assert.match(text, /vars\.CLOUDFLARE_ACCOUNT_ID != ''/);
    assert.match(text, /github\.event_name == 'workflow_dispatch'/);
    assert.match(text, /github\.event\.workflow_run\.event == 'push'/);
    assert.match(text, /github\.event\.workflow_run\.conclusion == 'success'/);
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

test("the native family runs its checks through mise, not npm", () => {
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
    assert.doesNotThrow(() => check("my-lib", "lib"));
    for (const name of ["My-Lib", "myLib"]) {
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

test("typescript adds sources, tests and its own package over npm", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set()));
    for (const file of [
        "src/index.ts",
        "src/index.test.ts",
        "tsconfig.json",
        "package.json",
        "package-lock.json",
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
    assert.equal(pkg.engines.node, ">=24");
    assert.equal(pkg.scripts.test, "node --test 'src/**/*.test.ts'");
    assert.match(pkg.scripts.check, /npm run test/);
});

test("publish replaces the package, adds the build and the workflow", () => {
    const sources = compose(TEMPLATES.typescript.layers(new Set(["publish"])));
    for (const file of [
        "package.json",
        "package-lock.json",
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
    assert.equal(pkg.scripts.prepack, "npm run build");
    assert.equal(pkg.publishConfig.provenance, true);
    assert.match(pkg.scripts.check, /npm run build/);
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

// `npm ci` fails when they differ, which only the CI matrix would notice.
test("each layer's lockfile matches its package.json", () => {
    for (const layer of readdirSync(TEMPLATES_DIR)) {
        const dir = join(TEMPLATES_DIR, layer);
        if (!existsSync(join(dir, "package.json"))) continue;
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        const lock = JSON.parse(
            readFileSync(join(dir, "package-lock.json"), "utf8"),
        );
        assert.equal(lock.name, pkg.name, layer);
        assert.equal(lock.version, pkg.version, layer);
        assert.equal(lock.packages[""].name, pkg.name, layer);
        assert.deepEqual(
            lock.packages[""].devDependencies,
            pkg.devDependencies,
            layer,
        );
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
        family: "npm",
        features: {},
        layers: () => ["common"],
        edits: [],
    },
    crate: {
        description: "C",
        family: "npm",
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
