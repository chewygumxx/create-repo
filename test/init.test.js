// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/init.test.js
//
//

// @ts-check

// The description has quotes, a colon, a bare URL and more than 80
// characters, so the README frontmatter's folded scalar, the body's links and
// its wrapping are exercised.

import assert from "node:assert/strict";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    rmSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse } from "jsonc-parser";
import {
    commitlintScopes,
    headers,
    init,
    packageJson,
    packageLock,
    readme,
    repoMetadata,
} from "../lib/init.js";
import { copyTemplate, TEMPLATES_DIR, TemplateError } from "../lib/template.js";

const IDENTITY = {
    owner: "example",
    name: "derived-repo",
    description:
        'Tests "init": a description with quotes, a colon, a link to https://example.com/docs, and enough words to wrap past eighty columns.',
    topics: ["alpha", "beta"],
    scopes: [
        { name: "api", fullName: "Api" },
        { name: "cli", fullName: "Command Line" },
    ],
};

/** The standard template's edits. */
const EDITS = [
    headers,
    repoMetadata,
    packageJson,
    packageLock,
    readme,
    commitlintScopes,
];

/**
 * @param {string} dir
 * @param {string} file
 */
const read = (dir, file) => readFileSync(join(dir, file), "utf8");

/**
 * Copies the template, lets `before` change the copy, initialises it, and
 * hands it to `body`.
 * @param {(dir: string, files: string[]) => void} body
 * @param {Partial<typeof IDENTITY>} [changes]
 * @param {(dir: string) => void} [before]
 */
function initialised(body, changes = {}, before = () => {}) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
    try {
        const dir = join(root, "derived");
        const files = copyTemplate(dir, ["common", "npm"]);
        before(dir);
        init(dir, { ...IDENTITY, ...changes }, files, {
            edits: EDITS,
            today: "2026-10-01",
        });
        body(dir, files);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("no template identity remains", () =>
    initialised((dir, files) => {
        assert.deepEqual(
            files.filter((file) =>
                /repo-tmpl|is_template|Using this template/.test(
                    read(dir, file),
                ),
            ),
            [],
        );
    }));

// CI's header sync cannot push changes to workflow files.
test("headers name the new repository, workflows included", () =>
    initialised((dir) => {
        assert.match(
            read(dir, ".github/workflows/ci.yaml"),
            /~example\/derived-repo\.git/,
        );
    }));

test("metadata, package and lockfile carry the identity", () =>
    initialised((dir) => {
        const metadata = parse(read(dir, ".repo-metadata.jsonc"));
        assert.equal(metadata.slug, "example/derived-repo");
        assert.deepEqual(metadata.topics, ["alpha", "beta"]);
        assert.ok(!("is_template" in metadata));
        const pkg = JSON.parse(read(dir, "package.json"));
        assert.equal(pkg.name, "derived-repo");
        assert.equal(pkg.repository, "github:example/derived-repo");
        assert.equal(pkg.homepage, "https://github.com/example/derived-repo");
        assert.deepEqual(pkg.keywords, ["alpha", "beta"]);
        const lock = JSON.parse(read(dir, "package-lock.json"));
        assert.equal(lock.name, "derived-repo");
        assert.equal(lock.packages[""].name, "derived-repo");
    }));

test("README frontmatter, heading and body", () =>
    initialised((dir) => {
        const readme = read(dir, "README.md");
        assert.match(readme, /^ctime: 2026-10-01$/m);
        assert.match(readme, /^description: >-$/m);
        assert.match(readme, /^tags:\n {2}- alpha\n {2}- beta\n/m);
        assert.match(readme, /^# derived-repo$/m);
        assert.match(readme, /<https:\/\/example\.com\/docs>/);
    }));

test("scopes are added after the template's own", () =>
    initialised((dir) => {
        const config = read(dir, ".commitlintrc.mts");
        assert.match(config, /name: "claude"/);
        assert.match(config, /fullName: "Command Line"/);
    }));

test("no topics leaves empty tags; no scopes leaves commitlint alone", () =>
    initialised(
        (dir) => {
            assert.match(read(dir, "README.md"), /^tags: \[\]$/m);
            assert.equal(
                read(dir, ".commitlintrc.mts"),
                read(
                    join(TEMPLATES_DIR, "npm"),
                    ".commitlintrc.mts",
                ).replaceAll(
                    "~chewygumxx/repo-tmpl.git",
                    "~example/derived-repo.git",
                ),
            );
        },
        { topics: [], scopes: [] },
    ));

test("a template change init does not know about fails", () => {
    assert.throws(
        () =>
            initialised(
                () => {},
                {},
                (dir) =>
                    writeFileSync(
                        join(dir, "README.md"),
                        read(dir, "README.md").replace(/^ctime: .*\n/m, ""),
                    ),
            ),
        (error) =>
            error instanceof TemplateError &&
            /ctime not found/.test(error.message),
    );
});

test("a file init cannot parse is a TemplateError naming it", () => {
    assert.throws(
        () =>
            initialised(
                () => {},
                {},
                (dir) => writeFileSync(join(dir, "package.json"), "{ nope"),
            ),
        (error) =>
            error instanceof TemplateError &&
            /package\.json/.test(error.message),
    );
});

test("a file init cannot read is a TemplateError naming it", () => {
    assert.throws(
        () =>
            initialised(
                () => {},
                {},
                (dir) => unlinkSync(join(dir, "README.md")),
            ),
        (error) =>
            error instanceof TemplateError && /README\.md/.test(error.message),
    );
});

/** @param {(root: string) => void} body */
function inTemp(body) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
    try {
        body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

/**
 * A copy holding only `files`, and its file list.
 * @param {string} root
 * @param {Record<string, string>} files
 */
function bare(root, files) {
    const dir = join(root, "bare");
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, file)), { recursive: true });
        writeFileSync(join(dir, file), text);
    }
    return { dir, files: Object.keys(files).sort() };
}

/** Metadata naming a template slug the guard does not look for. */
const METADATA = { ".repo-metadata.jsonc": '{ "slug": "someone/tmpl" }\n' };

test("each edit sees the identity, features and both slugs", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, { ...METADATA, "a.txt": "a\n" });
        /** @type {import("../lib/init.js").EditContext[]} */
        const seen = [];
        init(dir, IDENTITY, files, {
            edits: [
                (context) => {
                    seen.push(context);
                },
            ],
            features: ["lib"],
            today: "2026-10-01",
        });
        assert.equal(seen.length, 1);
        assert.equal(seen[0].slug, "example/derived-repo");
        assert.equal(seen[0].template, "someone/tmpl");
        assert.deepEqual([...seen[0].features], ["lib"]);
        assert.equal(seen[0].today, "2026-10-01");
    }));

test("the template's identity left in a file fails, naming it", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, {
            ...METADATA,
            "a.txt": "see repo-tmpl\n",
            "b.txt": "fine\n",
        });
        assert.throws(
            () => init(dir, IDENTITY, files, { edits: [] }),
            (error) =>
                error instanceof TemplateError &&
                /remains in a\.txt$/.test(error.message),
        );
    }));

test("the template's identity left in a path fails, naming it", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, {
            ...METADATA,
            "lua/repo_tmpl/init.lua": "return {}\n",
        });
        assert.throws(
            () => init(dir, IDENTITY, files, { edits: [] }),
            (error) =>
                error instanceof TemplateError &&
                /lua\/repo_tmpl\/init\.lua/.test(error.message),
        );
    }));

test("a path an edit renames is checked under its new name", () =>
    inTemp((root) => {
        const { dir, files } = bare(root, {
            ...METADATA,
            "repo_tmpl.txt": "x\n",
        });
        init(dir, IDENTITY, files, {
            edits: [
                (context) => {
                    renameSync(
                        join(dir, "repo_tmpl.txt"),
                        join(dir, "derived.txt"),
                    );
                    context.files = context.files.map((file) =>
                        file === "repo_tmpl.txt" ? "derived.txt" : file,
                    );
                },
            ],
        });
        assert.ok(existsSync(join(dir, "derived.txt")));
    }));

test("an edit left out leaves identity the guard reports", () =>
    assert.throws(
        () =>
            inTemp((root) => {
                const dir = join(root, "derived");
                const files = copyTemplate(dir, ["common", "npm"]);
                init(dir, IDENTITY, files, {
                    edits: EDITS.filter((edit) => edit !== readme),
                });
            }),
        (error) =>
            error instanceof TemplateError &&
            /remains in .*README\.md/.test(error.message),
    ));

// The guard looks for the template's identity, not for text the user chose.
test("input that contains the template's identity is not a leftover", () => {
    for (const changes of [
        { name: "repo-tmpl-fork" },
        { description: "Based on repo-tmpl, with is_template off." },
        { description: `${"word ".repeat(14)}Using this template is easy.` },
        { topics: ["repo_tmpl"] },
    ]) {
        initialised(() => {}, changes);
    }
});

test("short input does not hide a leftover it is part of", () => {
    for (const changes of [{ name: "repo" }, { topics: ["tmpl"] }]) {
        assert.throws(
            () =>
                initialised(
                    () => {},
                    changes,
                    (dir) =>
                        writeFileSync(join(dir, "LICENSE"), "repo-tmpl\n", {
                            flag: "a",
                        }),
                ),
            (error) =>
                error instanceof TemplateError &&
                /remains in .*LICENSE/.test(error.message),
            JSON.stringify(changes),
        );
    }
});
