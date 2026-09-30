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
    readdirSync,
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
    cargoLock,
    cargoToml,
    commitlintScopes,
    committedScopes,
    headers,
    init,
    moduleName,
    packageJson,
    packageLock,
    readme,
    repoMetadata,
    wranglerName,
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
 * @param {string[]} [features] the template's chosen features
 */
function initialised(body, changes = {}, before = () => {}, features = []) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
    try {
        const dir = join(root, "derived");
        const files = copyTemplate(dir, ["common", "npm"]);
        before(dir);
        init(dir, { ...IDENTITY, ...changes }, files, {
            edits: EDITS,
            features,
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

test("a published package is @owner/name, in package and lockfile", () =>
    initialised(
        (dir) => {
            const name = "@example/derived-repo";
            assert.equal(JSON.parse(read(dir, "package.json")).name, name);
            const lock = JSON.parse(read(dir, "package-lock.json"));
            assert.equal(lock.name, name);
            assert.equal(lock.packages[""].name, name);
        },
        {},
        undefined,
        ["publish"],
    ));

/**
 * Initialises a copy holding a wrangler.jsonc with `text`.
 * @param {string} text
 */
function withWrangler(text) {
    const root = mkdtempSync(join(tmpdir(), "create-repo-init-"));
    try {
        const dir = join(root, "derived");
        const files = copyTemplate(dir, ["common", "npm"]);
        writeFileSync(join(dir, "wrangler.jsonc"), text);
        init(dir, IDENTITY, [...files, "wrangler.jsonc"], {
            edits: [...EDITS, wranglerName],
            today: "2026-10-01",
        });
        return read(dir, "wrangler.jsonc");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("wranglerName names the Worker and keeps the comments", () => {
    const text = withWrangler(`// ~chewygumxx/repo-tmpl.git
{
    // The Worker's name.
    "name": "repo-tmpl",
    "main": "src/index.ts"
}
`);
    assert.match(text, /"name": "derived-repo"/);
    assert.match(text, /\/\/ The Worker's name\./);
    assert.match(text, /~example\/derived-repo\.git/);
});

test("wranglerName fails when wrangler.jsonc has no name", () => {
    assert.throws(
        () => withWrangler(`{ "main": "src/index.ts" }\n`),
        (error) =>
            error instanceof TemplateError &&
            /"name" in wrangler\.jsonc not found/.test(error.message),
    );
});
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
        // The README turns bare URLs into links, so the words differ there.
        {
            description:
                "Fork of https://github.com/chewygumxx/repo-tmpl, trimmed.",
        },
        { description: "See www.repo-tmpl.dev for more." },
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

/**
 * Runs `edits` over a copy holding only `files`, then hands `body` a reader
 * of the result, and the copy's directory.
 * @param {Record<string, string>} files
 * @param {import("../lib/init.js").Edit[]} edits
 * @param {(read: (file: string) => string, dir: string) => void} body
 * @param {Partial<typeof IDENTITY>} [changes]
 */
function edited(files, edits, body, changes = {}) {
    inTemp((root) => {
        const copy = bare(root, { ...METADATA, ...files });
        init(copy.dir, { ...IDENTITY, ...changes }, copy.files, {
            edits,
            today: "2026-10-01",
        });
        body((file) => read(copy.dir, file), copy.dir);
    });
}

const COMMITTED = `allowed_scopes = [
    # Claude Code assets
    "claude",
]
`;

test("committedScopes adds each scope, its full name as a comment", () =>
    edited({ "committed.toml": COMMITTED }, [committedScopes], (read) => {
        assert.equal(
            read("committed.toml"),
            `allowed_scopes = [
    # Claude Code assets
    "claude",
    # Api
    "api",
    # Command Line
    "cli",
]
`,
        );
    }));

test("committedScopes leaves the file alone when no scope is asked for", () =>
    edited(
        { "committed.toml": COMMITTED },
        [committedScopes],
        (read) => {
            assert.equal(read("committed.toml"), COMMITTED);
        },
        { scopes: [] },
    ));

test("committedScopes keeps a scope's quotes and lines out of the TOML", () =>
    edited(
        { "committed.toml": COMMITTED },
        [committedScopes],
        (read) => {
            assert.match(
                read("committed.toml"),
                /^ {4}# Two lines # not code$/m,
            );
            assert.match(read("committed.toml"), /^ {4}"a\\"b",$/m);
        },
        { scopes: [{ name: 'a"b', fullName: "Two\nlines # not code" }] },
    ));

test("committedScopes fails when committed.toml has no allowed_scopes", () => {
    assert.throws(
        () =>
            edited(
                { "committed.toml": 'style = "conventional"\n' },
                [committedScopes],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /allowed_scopes in committed\.toml/.test(error.message),
    );
});

test("moduleName names the module in every file that holds the token", () =>
    edited(
        {
            "src/lib.rs": "use repo_tmpl::greeting;\n",
            "docs/a.md": "repo_tmpl, twice: repo_tmpl\n",
            "notes.txt": "nothing to rename\n",
        },
        [moduleName((name) => name.replaceAll("-", "_"))],
        (read) => {
            assert.equal(read("src/lib.rs"), "use derived_repo::greeting;\n");
            assert.equal(
                read("docs/a.md"),
                "derived_repo, twice: derived_repo\n",
            );
            assert.equal(read("notes.txt"), "nothing to rename\n");
        },
    ));

test("moduleName takes its value literally, not as a replacement pattern", () =>
    edited({ "a.txt": "repo_tmpl\n" }, [moduleName(() => "$&$1")], (read) => {
        assert.equal(read("a.txt"), "$&$1\n");
    }));

test("moduleName renames the paths that hold the token, and removes the emptied directories", () =>
    edited(
        {
            "lua/repo_tmpl/init.lua": "return {}\n",
            "lua/repo_tmpl/health.lua": "return {}\n",
            "plugin/repo_tmpl.lua": "-- plugin\n",
            "doc/keep.txt": "keep\n",
        },
        [moduleName((name) => name)],
        (read, dir) => {
            assert.equal(read("lua/derived-repo/init.lua"), "return {}\n");
            assert.equal(read("lua/derived-repo/health.lua"), "return {}\n");
            assert.equal(read("plugin/derived-repo.lua"), "-- plugin\n");
            assert.equal(read("doc/keep.txt"), "keep\n");
            assert.deepEqual(readdirSync(join(dir, "lua")), ["derived-repo"]);
        },
    ));

test("moduleName leaves a path alone when the name is the token", () =>
    edited(
        { "repo_tmpl.txt": "repo_tmpl\n" },
        [moduleName(() => "repo_tmpl")],
        (read) => {
            assert.equal(read("repo_tmpl.txt"), "repo_tmpl\n");
        },
    ));

test("moduleName does not overwrite a file its name lands on", () => {
    assert.throws(
        () =>
            edited(
                { "repo_tmpl.txt": "a\n", "derived-repo.txt": "b\n" },
                [moduleName((name) => name)],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /derived-repo\.txt already exists/.test(error.message),
    );
});

// The module is the name, changed; the guard knows the name's own words, so
// it has to know the module's too.
test("a module name that holds the template's identity is not a leftover", () =>
    edited(
        { "a.txt": "repo_tmpl\n", "lua/repo_tmpl/init.lua": "x\n" },
        [moduleName((name) => name.replaceAll("-", "_"))],
        (read) => {
            assert.equal(read("a.txt"), "my_repo_tmpl\n");
            assert.equal(read("lua/my_repo_tmpl/init.lua"), "x\n");
        },
        { name: "my-repo-tmpl" },
    ));

test("moduleName asks nothing of a repository without the token", () =>
    edited({ "a.txt": "a\n" }, [moduleName((name) => name)], (read) => {
        assert.equal(read("a.txt"), "a\n");
    }));

/** As tombi leaves it: the keys aligned. */
const CARGO_TOML = `[package]
name        = "repo-tmpl"
version     = "0.1.0"
edition     = "2024"
description = "Repository Template"
repository  = "https://github.com/chewygumxx/repo-tmpl"
license     = "GPL-3.0-only"
publish     = false
`;

test("cargoToml names the crate, its description and its repository", () =>
    edited({ "Cargo.toml": CARGO_TOML }, [cargoToml], (read) => {
        assert.equal(
            read("Cargo.toml"),
            `[package]
name        = "derived-repo"
version     = "0.1.0"
edition     = "2024"
description = ${JSON.stringify(IDENTITY.description)}
repository  = "https://github.com/example/derived-repo"
license     = "GPL-3.0-only"
publish     = false
`,
        );
    }));

test("cargoToml writes a description holding TOML's special characters", () =>
    edited(
        { "Cargo.toml": CARGO_TOML },
        [cargoToml],
        (read) => {
            assert.match(
                read("Cargo.toml"),
                /^description = "back\\\\slash \\"quoted\\" # not a comment\\n2nd line"$/m,
            );
        },
        { description: 'back\\slash "quoted" # not a comment\n2nd line' },
    ));

test("cargoToml fails when a key is missing", () => {
    assert.throws(
        () =>
            edited(
                {
                    "Cargo.toml": CARGO_TOML.replace(/^repository.*\n/m, ""),
                },
                [cargoToml],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /repository in Cargo\.toml/.test(error.message),
    );
});

const CARGO_LOCK = `# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "repo-tmpl"
version = "0.1.0"
dependencies = [
 "itoa",
]

[[package]]
name = "itoa"
version = "1.0.15"
`;

test("cargoLock renames the crate's own package only", () =>
    edited({ "Cargo.lock": CARGO_LOCK }, [cargoLock], (read) => {
        assert.equal(
            read("Cargo.lock"),
            CARGO_LOCK.replace('name = "repo-tmpl"', 'name = "derived-repo"'),
        );
    }));

test("cargoLock fails when the crate's package is missing", () => {
    assert.throws(
        () =>
            edited(
                { "Cargo.lock": CARGO_LOCK.replace("repo-tmpl", "other") },
                [cargoLock],
                () => {},
            ),
        (error) =>
            error instanceof TemplateError &&
            /\[\[package\]\] in Cargo\.lock/.test(error.message),
    );
});
