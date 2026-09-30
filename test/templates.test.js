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
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
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
