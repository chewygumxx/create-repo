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
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
    copyTemplate,
    TargetExistsError,
    TEMPLATES_DIR,
    TemplateError,
    templateFiles,
} from "../lib/template.js";

/** The standard template's layers. */
const LAYERS = ["common", "npm"];

/** @param {(root: string) => void} body */
function inTemp(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-template-"));
    try {
        body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * Writes `files` under `root`, creating directories.
 * @param {string} root
 * @param {Record<string, string>} files
 */
function write(root, files) {
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), text);
    }
}

test("copies every file, restoring .gitignore", () =>
    inTemp((root) => {
        const files = copyTemplate(join(root, "x"), LAYERS);
        assert.ok(files.includes(".gitignore"));
        assert.ok(!files.includes("_gitignore"));
        assert.equal(files.length, templateFiles(LAYERS).length);
        assert.equal(
            readFileSync(join(root, "x", ".gitignore"), "utf8"),
            readFileSync(join(TEMPLATES_DIR, "npm", "_gitignore"), "utf8"),
        );
    }));

test("a later layer's file replaces an earlier one's", () =>
    inTemp((root) => {
        const from = join(root, "layers");
        write(from, {
            "a/_gitignore": "",
            "a/same.txt": "a\n",
            "a/only-a.txt": "a\n",
            "b/same.txt": "b\n",
            "b/sub/only-b.txt": "b\n",
        });
        const files = copyTemplate(join(root, "x"), ["a", "b"], from);
        assert.deepEqual(files, [
            ".gitignore",
            "only-a.txt",
            "same.txt",
            "sub/only-b.txt",
        ]);
        assert.equal(readFileSync(join(root, "x", "same.txt"), "utf8"), "b\n");
    }));

test("the last layer's _gitignore applies to every layer", () =>
    inTemp((root) => {
        const from = join(root, "layers");
        write(from, {
            "a/_gitignore": "a.txt\n",
            "a/a.txt": "",
            "a/b.txt": "",
            "b/_gitignore": "b.txt\n",
        });
        const files = copyTemplate(join(root, "x"), ["a", "b"], from);
        assert.deepEqual(files, [".gitignore", "a.txt"]);
        assert.equal(
            readFileSync(join(root, "x", ".gitignore"), "utf8"),
            "b.txt\n",
        );
    }));

test("a missing layer is a TemplateError naming it; nothing is copied", () =>
    inTemp((root) => {
        assert.throws(
            () => copyTemplate(join(root, "x"), ["common", "nope"]),
            (error) =>
                error instanceof TemplateError && /"nope"/.test(error.message),
        );
        assert.ok(!existsSync(join(root, "x")));
    }));

test("refuses a directory that exists", () =>
    inTemp((root) => {
        mkdirSync(join(root, "x"));
        assert.throws(
            () => copyTemplate(join(root, "x"), LAYERS),
            (error) =>
                error instanceof TargetExistsError &&
                error instanceof TemplateError &&
                /already exists/.test(error.message),
        );
    }));

/** Files a checkout's layers may gain, all ignored by the _gitignore. */
const STRAY = [
    "node_modules/pkg/index.js",
    ".env.local",
    "docs/notes.local.md",
    ".claude/worktrees/x/file",
];

/**
 * A copy of the layers with stray files added to each of the standard's.
 * @param {string} root
 */
function strayTemplates(root) {
    const from = join(root, "templates");
    cpSync(TEMPLATES_DIR, from, { recursive: true });
    for (const layer of LAYERS) {
        write(
            join(from, layer),
            Object.fromEntries(STRAY.map((file) => [file, "stray\n"])),
        );
    }
    return from;
}

test("lists no file the composed _gitignore ignores", () =>
    inTemp((root) => {
        const files = templateFiles(LAYERS, strayTemplates(root));
        assert.deepEqual(
            STRAY.filter((file) => files.includes(file)),
            [],
        );
        assert.deepEqual(files, templateFiles(LAYERS));
    }));

test("copies no file the composed _gitignore ignores", () =>
    inTemp((root) => {
        const from = strayTemplates(root);
        const files = copyTemplate(join(root, "x"), LAYERS, from);
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
        const from = strayTemplates(root);
        writeFileSync(join(from, "npm", "_gitignore"), "*.log\n!keep.log\n");
        assert.throws(
            () => templateFiles(LAYERS, from),
            (error) =>
                error instanceof TemplateError &&
                /!keep\.log/.test(error.message),
        );
    }));

test("layers without a _gitignore are a TemplateError naming it", () =>
    inTemp((root) => {
        const from = strayTemplates(root);
        rmSync(join(from, "npm", "_gitignore"));
        assert.throws(
            () => copyTemplate(join(root, "x"), LAYERS, from),
            (error) =>
                error instanceof TemplateError &&
                /_gitignore/.test(error.message),
        );
    }));

test("a symlink in a layer is a TemplateError, not silently dropped", () =>
    inTemp((root) => {
        const from = join(root, "layers");
        write(from, { "a/_gitignore": "", "a/real.txt": "x\n" });
        symlinkSync("real.txt", join(from, "a", "link.txt"));
        assert.throws(
            () => templateFiles(["a"], from),
            (error) =>
                error instanceof TemplateError &&
                /link\.txt/.test(error.message),
        );
    }));

test("an ignored symlink is left alone", () =>
    inTemp((root) => {
        const from = join(root, "layers");
        write(from, { "a/_gitignore": "link.txt\n", "a/real.txt": "x\n" });
        symlinkSync("real.txt", join(from, "a", "link.txt"));
        assert.deepEqual(templateFiles(["a"], from), [
            "_gitignore",
            "real.txt",
        ]);
    }));
