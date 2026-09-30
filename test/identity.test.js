// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/identity.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { init } from "../lib/init.js";
import { copyTemplate } from "../lib/template.js";
import { TEMPLATES } from "../lib/templates.js";

/**
 * Copies and initialises a template, and hands `body` a reader of its files.
 * @param {string} template
 * @param {string[]} features
 * @param {Partial<import("../lib/init.js").Identity>} identity
 * @param {(at: (file: string) => string) => void} body
 */
function initialised(template, features, identity, body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-identity-"));
    try {
        const dir = join(root, "x");
        const files = copyTemplate(
            dir,
            TEMPLATES[template].layers(new Set(features)),
        );
        init(
            dir,
            {
                owner: "o",
                name: "x",
                description: "D",
                topics: [],
                scopes: [],
                ...identity,
            },
            files,
            {
                edits: TEMPLATES[template].edits,
                features,
                today: "2026-10-01",
            },
        );
        body((file) => readFileSync(join(dir, file), "utf8"));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("a crate named with repo_tmpl keeps its name in every file", () => {
    initialised("rust", ["lib"], { name: "x-repo_tmpl" }, (at) => {
        assert.match(at("Cargo.toml"), /^name\s*=\s*"x-repo_tmpl"$/m);
        assert.match(at("src/lib.rs"), /x_repo_tmpl::greeting/);
        for (const file of ["Cargo.toml", "src/lib.rs", "README.md"]) {
            assert.doesNotMatch(at(file), /x-x_repo_tmpl|x_x_repo_tmpl/, file);
        }
        assert.match(at("Cargo.toml"), /~o\/x-repo_tmpl\.git/);
    });
});

test("a description that mentions repo_tmpl is not rewritten", () => {
    initialised("rust", [], { description: "Wraps repo_tmpl" }, (at) => {
        assert.match(
            at("Cargo.toml"),
            /^description\s*=\s*"Wraps repo_tmpl"$/m,
        );
        assert.match(at("README.md"), /Wraps repo_tmpl/);
    });
});
