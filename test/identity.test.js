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
import {
    linkSync,
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
import { collides, init, vimdocTags } from "../lib/init.js";
import { copyTemplate } from "../lib/template.js";
import { TEMPLATES } from "../lib/templates.js";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates", import.meta.url));

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

test("the vimdoc's right-aligned lines keep their width for any module", () => {
    const original = readFileSync(
        join(TEMPLATES_DIR, "nvim/doc/repo_tmpl.txt"),
        "utf8",
    ).split("\n");
    for (const name of ["nvim-a", "nvim-plugin_name_x"]) {
        const module = name.replace(/^nvim-/, "");
        initialised("nvim", [], { name }, (at) => {
            const lines = at(`doc/${module}.txt`).split("\n");
            assert.equal(lines.length, original.length, name);
            original.forEach((line, index) => {
                if (!/[*|]$/.test(line) || /^\*/.test(line)) return;
                assert.equal(
                    lines[index].length,
                    line.length,
                    `${name}: ${line}`,
                );
                assert.match(
                    lines[index],
                    new RegExp(`[*|]${module}[-.:\\w]*[*|]$|[*|]:Hello[*|]$`),
                    name,
                );
            });
        });
    }
});

// A tag line is told from prose by the two or more spaces (or dots) before its
// tag, so prose that ends in a tag after a single space is left alone, and
// prose with a wide gap before one is not.
test("only a tag after a gap of two or more is realigned", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-identity-"));
    try {
        mkdirSync(join(root, "doc"));
        const text = [
            "SETUP                          *repo_tmpl-setup*",
            "See the tag |repo_tmpl-setup|",
            "Prose with a wide gap          |repo_tmpl-setup|",
            "",
        ].join("\n");
        writeFileSync(join(root, "doc/repo_tmpl.txt"), text);
        vimdocTags(() => "ab")({
            dir: root,
            files: ["doc/repo_tmpl.txt"],
            features: new Set(),
            slug: "o/ab",
            template: "nvim",
            today: "2026-10-01",
            own: [],
            identity: {
                owner: "o",
                name: "ab",
                description: "d",
                topics: [],
                scopes: [],
            },
        });
        const [tag, prose, wide] = readFileSync(
            join(root, "doc/repo_tmpl.txt"),
            "utf8",
        ).split("\n");
        // The token is still `repo_tmpl`: the gap takes up the 7 characters
        // that `moduleName` then takes out.
        assert.equal(tag.length, text.split("\n")[0].length + 7);
        assert.equal(prose, "See the tag |repo_tmpl-setup|");
        // The shape is all there is to go by, so prose written like a tag
        // line is realigned as one.
        assert.equal(wide.length, text.split("\n")[2].length + 7);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

// On a case-insensitive filesystem a case-only rename names the file being
// moved, which is not a collision. A hard link is the same file under a
// second name, as that path is.
test("a path naming the moved file is not a collision", () => {
    const root = mkdtempSync(join(tmpdir(), "create-repo-identity-"));
    try {
        const file = join(root, "a");
        writeFileSync(file, "a");
        linkSync(file, join(root, "same"));
        writeFileSync(join(root, "other"), "b");
        assert.equal(collides(file, join(root, "same")), false);
        assert.equal(collides(file, join(root, "other")), true);
        assert.equal(collides(file, join(root, "missing")), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
