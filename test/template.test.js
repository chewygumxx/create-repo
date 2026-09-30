// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/template.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import {
    copyTemplate,
    RENAMED,
    TEMPLATE_DIR,
    TemplateError,
    templateFiles,
} from "../lib/template.js";

/** @param {(root: string) => void} body */
function inTemp(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-template-"));
    try {
        body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("copies every file, restoring .gitignore", () =>
    inTemp((root) => {
        const files = copyTemplate(join(root, "x"));
        assert.ok(files.includes(".gitignore"));
        assert.ok(!files.includes("_gitignore"));
        assert.equal(files.length, templateFiles().length);
        assert.equal(
            readFileSync(join(root, "x", ".gitignore"), "utf8"),
            readFileSync(join(TEMPLATE_DIR, "_gitignore"), "utf8"),
        );
    }));

test("refuses a directory that exists", () =>
    inTemp((root) => {
        mkdirSync(join(root, "x"));
        assert.throws(
            () => copyTemplate(join(root, "x")),
            (error) =>
                error instanceof TemplateError &&
                /already exists/.test(error.message),
        );
    }));

// The header sync would rewrite these to name create-repo and template/,
// and init would then find no header to rewrite.
test("every template header names the template and its own path", () => {
    const slug = parse(
        readFileSync(join(TEMPLATE_DIR, ".repo-metadata.jsonc"), "utf8"),
    ).slug;
    const stray = templateFiles().filter((file) => {
        const text = readFileSync(join(TEMPLATE_DIR, file), "utf8");
        const path = RENAMED[file] ?? file;
        return (
            text.includes("::: :/") &&
            !(text.includes(`~${slug}.git`) && text.includes(`::: :/${path}`))
        );
    });
    assert.deepEqual(stray, []);
});

/** Files a checkout's template/ may gain, all ignored by its _gitignore. */
const STRAY = [
    "node_modules/pkg/index.js",
    ".env.local",
    "docs/notes.local.md",
    ".claude/worktrees/x/file",
];

/**
 * A copy of the template with stray files added.
 * @param {string} root
 */
function strayTemplate(root) {
    const from = join(root, "template");
    cpSync(TEMPLATE_DIR, from, { recursive: true });
    for (const file of STRAY) {
        mkdirSync(dirname(join(from, file)), { recursive: true });
        writeFileSync(join(from, file), "stray\n");
    }
    return from;
}

test("lists no file the template's own .gitignore ignores", () =>
    inTemp((root) => {
        const files = templateFiles(strayTemplate(root));
        assert.deepEqual(
            STRAY.filter((file) => files.includes(file)),
            [],
        );
        assert.deepEqual(files, templateFiles());
    }));

test("copies no file the template's own .gitignore ignores", () =>
    inTemp((root) => {
        const from = strayTemplate(root);
        const files = copyTemplate(join(root, "x"), from);
        assert.deepEqual(
            STRAY.filter(
                (file) =>
                    files.includes(file) || existsSync(join(root, "x", file)),
            ),
            [],
        );
    }));

test("an ignore rule it cannot follow fails loudly", () =>
    inTemp((root) => {
        const from = strayTemplate(root);
        writeFileSync(join(from, "_gitignore"), "*.log\n!keep.log\n");
        assert.throws(
            () => templateFiles(from),
            (error) =>
                error instanceof TemplateError &&
                /!keep\.log/.test(error.message),
        );
    }));
