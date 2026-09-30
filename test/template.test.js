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
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import {
    copyTemplate,
    listFiles,
    RENAMED,
    TEMPLATE_DIR,
    TemplateError,
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
        assert.equal(files.length, listFiles(TEMPLATE_DIR).length);
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
    const stray = listFiles(TEMPLATE_DIR).filter((file) => {
        const text = readFileSync(join(TEMPLATE_DIR, file), "utf8");
        const path = RENAMED[file] ?? file;
        return (
            text.includes("::: :/") &&
            !(text.includes(`~${slug}.git`) && text.includes(`::: :/${path}`))
        );
    });
    assert.deepEqual(stray, []);
});
