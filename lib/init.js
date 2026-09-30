// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/init.js
//
//

// @ts-check

// Turns a fresh copy of a template into a new repository by rewriting the
// identity in the files that carry it: each template names the edits it
// needs, and a guard then fails if its identity remains anywhere. The caller
// formats the copy after.
//
// Every edit fails when its target is missing, so a template change this
// module does not know about fails its tests rather than being skipped.

import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmdirSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";
import { TemplateError } from "./template.js";

/** @typedef {import("./args.js").Scope} Scope */

/**
 * @typedef {object} Identity
 * @property {string} owner
 * @property {string} name
 * @property {string} description
 * @property {string[]} topics
 * @property {Scope[]} scopes
 */

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
    throw new TemplateError(`init: ${message}`);
}

/**
 * Replaces the first match of `pattern`, failing when there is none.
 * @param {string} text
 * @param {RegExp} pattern
 * @param {(...groups: string[]) => string} replacement
 * @param {string} what names the target in the error
 */
function replace(text, pattern, replacement, what) {
    if (!pattern.test(text)) fail(`${what} not found`);
    return text.replace(pattern, replacement);
}

/**
 * @param {string} path
 * @param {(text: string) => string} change
 */
function editText(path, change) {
    writeFileSync(path, change(readFileSync(path, "utf8")));
}

/**
 * Rewrites a JSON file, keeping its indentation.
 * @param {string} path
 * @param {(data: any) => void} change
 */
function editJson(path, change) {
    const text = readFileSync(path, "utf8");
    const indent = /^[ \t]+/m.exec(text)?.[0] ?? "    ";
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        fail(`${path}: ${error instanceof Error ? error.message : error}`);
    }
    change(data);
    writeFileSync(path, `${JSON.stringify(data, null, indent)}\n`);
}

/**
 * Sets top-level keys of a JSONC file with jsonc-parser, keeping its
 * comments and layout. A value of `undefined` removes the key.
 * @param {string} path
 * @param {string} name names the file in errors
 * @param {[string, unknown][]} changes
 */
function editJsonc(path, name, changes) {
    let text = readFileSync(path, "utf8");
    /** @type {import("jsonc-parser").ParseError[]} */
    const errors = [];
    const data = parse(text, errors);
    if (errors.length) {
        fail(
            `${name}: ${errors.map((e) => printParseErrorCode(e.error)).join(", ")}`,
        );
    }
    for (const [key, value] of changes) {
        if (!(key in data)) fail(`"${key}" in ${name} not found`);
        const edits = modify(text, [key], value, {
            formattingOptions: { insertSpaces: true, tabSize: 4 },
        });
        text = applyEdits(text, edits);
    }
    writeFileSync(path, text);
}

/**
 * Requires top-level keys in parsed JSON.
 * @param {Record<string, unknown>} data
 * @param {string[]} keys
 * @param {string} name
 */
function requireKeys(data, keys, name) {
    for (const key of keys) {
        if (!(key in data)) fail(`"${key}" in ${name} not found`);
    }
}

/**
 * Wraps prose at `width` columns.
 * @param {string} text
 * @param {number} [width]
 */
function wrap(text, width = 80) {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && line.length + 1 + word.length > width) {
            lines.push(line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    if (line) lines.push(line);
    return lines.join("\n");
}

/**
 * Turns bare URLs into links remark accepts, leaving trailing punctuation
 * outside: `<https://…>`, and `[www.…](https://www.…)` since an autolink
 * needs a scheme.
 * @param {string} text
 */
function linkUrls(text) {
    return text.replace(
        /\b(https?:\/\/|www\.)[^\s<>]*[^\s<>.,;:!?'")\]]/g,
        (url, start) =>
            start === "www." ? `[${url}](https://${url})` : `<${url}>`,
    );
}

/**
 * A YAML frontmatter entry: a quoted scalar when it fits in 80 columns,
 * otherwise a `>-` folded scalar wrapped under a two-space indent.
 * @param {string} key
 * @param {string} value
 */
function yamlEntry(key, value) {
    const line = `${key}: ${JSON.stringify(value)}`;
    if (line.length <= 80) return line;
    return `${key}: >-\n${wrap(value, 78).replace(/^/gm, "  ")}`;
}

/**
 * What an edit works on.
 * @typedef {object} EditContext
 * @property {string} dir the copy
 * @property {Identity} identity
 * @property {string[]} files the copy's files, relative to `dir`; an edit
 *     that renames a file updates this list
 * @property {ReadonlySet<string>} features the template's chosen features
 * @property {string} slug the new repository's `owner/name`
 * @property {string} template the template's own slug, from its
 *     .repo-metadata.jsonc
 * @property {string} today YYYY-MM-DD
 * @property {string[]} own words an edit wrote from the identity, such as a
 *     module's name, which the guard does not take for the template's
 */

/** @typedef {(context: EditContext) => void} Edit */

/** A path or text naming the template rather than the new repository. */
const TEMPLATE_IDENTITY = /repo-tmpl|repo_tmpl|is_template|Using this template/;

/** @param {string} text */
const squash = (text) => text.replace(/\s+/g, " ");

/**
 * Tells whether `text` names the template once any of the identity's own
 * words that do so are taken out, so a name or description that happens to
 * contain `repo-tmpl` is not mistaken for a leftover. Only those words are
 * taken out: taking out a name like `repo` would hide a real leftover.
 * Whitespace is squashed on both sides, since the README wraps the
 * description and YAML folds it, and the README's linked form of the
 * description counts as the description too. `written` are the words the
 * edits made from the identity.
 * @param {Identity} identity
 * @param {string[]} written
 * @returns {(text: string) => boolean}
 */
function namesTemplate({ owner, name, description, topics, scopes }, written) {
    const own = [
        ...written,
        owner,
        name,
        description,
        linkUrls(description),
        ...topics,
        ...scopes.flatMap((scope) => [scope.name, scope.fullName]),
    ]
        .flatMap((text) => [text, JSON.stringify(text).slice(1, -1)])
        .map(squash)
        .filter((word) => TEMPLATE_IDENTITY.test(word))
        .sort((a, b) => b.length - a.length);
    return (text) =>
        TEMPLATE_IDENTITY.test(
            own.reduce((rest, word) => rest.replaceAll(word, ""), squash(text)),
        );
}

/**
 * @param {string} dir the copy
 * @param {Identity} identity
 * @param {string[]} files the copy's files, relative to `dir`
 * @param {{ edits: Edit[], features?: string[], today?: string }} options
 *     the template's edits, its chosen features, and `today` as YYYY-MM-DD
 * @throws {TemplateError} for any failure, a missing or unreadable file
 *     included, and when the template's identity remains after the edits
 */
export function init(dir, identity, files, options) {
    try {
        rewrite(dir, identity, files, options);
    } catch (error) {
        if (error instanceof TemplateError) throw error;
        throw new TemplateError(
            `init: ${error instanceof Error ? error.message : error}`,
            { cause: error },
        );
    }
}

/**
 * @param {string} dir
 * @param {Identity} identity
 * @param {string[]} files
 * @param {{ edits: Edit[], features?: string[], today?: string }} options
 */
function rewrite(
    dir,
    identity,
    files,
    { edits, features = [], today = new Date().toISOString().slice(0, 10) },
) {
    const template = parse(
        readFileSync(join(dir, ".repo-metadata.jsonc"), "utf8"),
    )?.slug;
    if (typeof template !== "string") {
        fail(`"slug" in .repo-metadata.jsonc not found`);
    }
    /** @type {EditContext} */
    const context = {
        dir,
        identity,
        files: [...files],
        features: new Set(features),
        slug: `${identity.owner}/${identity.name}`,
        template,
        today,
        own: [],
    };
    for (const edit of edits) edit(context);
    const remaining = namesTemplate(identity, context.own);
    const remains = context.files.filter(
        (file) =>
            remaining(file) || remaining(readFileSync(join(dir, file), "utf8")),
    );
    if (remains.length) {
        fail(`the template's identity remains in ${remains.join(", ")}`);
    }
}

/**
 * File headers name the repository as `~owner/name.git`. CI's header sync
 * would correct them, but its token may not push changes to workflow
 * files, so they are rewritten here.
 * @param {EditContext} context
 */
export function headers({ dir, files, template, slug }) {
    let count = 0;
    for (const file of files) {
        const path = join(dir, file);
        const text = readFileSync(path, "utf8");
        if (!text.includes(`~${template}.git`)) continue;
        writeFileSync(
            path,
            text.replaceAll(`~${template}.git`, `~${slug}.git`),
        );
        count += 1;
    }
    if (count === 0) fail(`no file header naming ~${template}.git found`);
}

/** @param {EditContext} context */
export function repoMetadata({
    dir,
    identity: { owner, name, description, topics },
    slug,
}) {
    editJsonc(join(dir, ".repo-metadata.jsonc"), ".repo-metadata.jsonc", [
        ["name", name],
        ["owner", owner],
        ["slug", slug],
        ["description", description],
        ["topics", topics],
        ["is_template", undefined],
    ]);
}

/**
 * The npm package's name: the repository's, or `@owner/name` when the
 * template publishes it.
 * @param {EditContext} context
 */
const packageName = ({ identity: { owner, name }, features }) =>
    features.has("publish") ? `@${owner}/${name}` : name;

/** @param {EditContext} context */
export function packageJson(context) {
    const {
        dir,
        identity: { description, topics },
        slug,
    } = context;
    editJson(join(dir, "package.json"), (data) => {
        requireKeys(
            data,
            ["name", "description", "keywords", "homepage", "repository"],
            "package.json",
        );
        data.name = packageName(context);
        data.description = description;
        data.keywords = topics;
        data.homepage = `https://github.com/${slug}`;
        data.repository = {
            type: "git",
            url: `git+https://github.com/${slug}.git`,
        };
    });
}

/** @param {EditContext} context */
export function packageLock(context) {
    const name = packageName(context);
    editJson(join(context.dir, "package-lock.json"), (data) => {
        requireKeys(data, ["name", "packages"], "package-lock.json");
        requireKeys(data.packages, [""], "package-lock.json packages");
        data.name = name;
        data.packages[""].name = name;
    });
}

/**
 * The Worker's name, which is the repository's.
 * @param {EditContext} context
 */
export function wranglerName({ dir, identity: { name } }) {
    editJsonc(join(dir, "wrangler.jsonc"), "wrangler.jsonc", [["name", name]]);
}

/**
 * The frontmatter, and the heading, introduction and "Using this template"
 * section, which become the name and the description.
 * @param {EditContext} context
 */
export function readme({
    dir,
    identity: { name, description, topics },
    today,
}) {
    editText(join(dir, "README.md"), (text) => {
        const tags = topics.length
            ? `tags:\n${topics.map((topic) => `  - ${topic}\n`).join("")}`
            : "tags: []\n";
        // An entry is its key line plus any more-indented continuation
        // lines, so a folded scalar is replaced whole.
        const entry = (/** @type {string} */ key) =>
            new RegExp(`^${key}:.*(?:\\n {2}.*)*$`, "m");
        text = replace(text, /^ctime: .*$/m, () => `ctime: ${today}`, "ctime");
        text = replace(
            text,
            entry("title"),
            () => yamlEntry("title", name),
            "title",
        );
        text = replace(
            text,
            entry("description"),
            () => yamlEntry("description", description),
            "description",
        );
        text = replace(text, /^tags:\n(?: {2}- .*\n)+/m, () => tags, "tags");
        return replace(
            text,
            /^# repo-tmpl\n\n[\s\S]*?\n## Using this template\n[\s\S]*?\n(?=## )/m,
            () => `# ${name}\n\n${wrap(linkUrls(description))}\n\n`,
            'the heading, intro and "Using this template" in README.md',
        );
    });
}

/**
 * The scopes asked for, after the template's own.
 * @param {EditContext} context
 */
export function commitlintScopes({ dir, identity: { scopes } }) {
    if (!scopes.length) return;
    editText(join(dir, ".commitlintrc.mts"), (text) =>
        replace(
            text,
            /\n {4}\],\n\}\);\n$/,
            () =>
                `${scopes
                    .map(
                        (scope) =>
                            `\n        {\n` +
                            `            name: ${JSON.stringify(scope.name)},\n` +
                            `            fullName: ${JSON.stringify(scope.fullName)},\n` +
                            `            description: ${JSON.stringify(scope.fullName)},\n` +
                            `        },`,
                    )
                    .join("")}\n    ],\n});\n`,
            "the end of the scopes in .commitlintrc.mts",
        ),
    );
}

/**
 * The scopes asked for, after the template's own, each with its full name
 * as a comment above it. tombi accepts the comments in a multi-line array,
 * so the result stays formatted.
 * @param {EditContext} context
 */
export function committedScopes({ dir, identity: { scopes } }) {
    if (!scopes.length) return;
    editText(join(dir, "committed.toml"), (text) =>
        replace(
            text,
            /^(allowed_scopes\s*=\s*\[\n(?: {4}.*\n)*)\]$/m,
            (_match, list) =>
                `${list}${scopes
                    .map(
                        (scope) =>
                            `    # ${squash(scope.fullName)}\n` +
                            `    ${JSON.stringify(scope.name)},\n`,
                    )
                    .join("")}]`,
            "the end of allowed_scopes in committed.toml",
        ),
    );
}

/**
 * Removes `path`, relative to `dir`, and each of its parents up to `dir`,
 * for as long as they are empty.
 * @param {string} dir
 * @param {string} path
 */
function pruneEmpty(dir, path) {
    for (let at = path; at !== "."; at = dirname(at)) {
        if (readdirSync(join(dir, at)).length) return;
        rmdirSync(join(dir, at));
    }
}

/**
 * Whether `target` exists and is not the file at `source`. A case-only
 * rename names the same file on a case-insensitive filesystem, where it
 * would otherwise look like a file the rename overwrites.
 * @param {string} source
 * @param {string} target
 */
export function collides(source, target) {
    if (!existsSync(target)) return false;
    const a = statSync(source);
    const b = statSync(target);
    return a.dev !== b.dev || a.ino !== b.ino;
}

/**
 * Keeps a vimdoc's right-aligned tags at the width the template lays them
 * out in, which `repo_tmpl` being nine characters sets: the gap before each
 * tag that holds the token takes up the module's extra or missing length.
 * The token itself is left for `moduleName`. A gap of dots (a contents
 * line) keeps a space before them, and no gap shrinks below one space, or
 * three characters of dots.
 * @param {(name: string) => string} rename the module's name for the
 *     repository's
 * @returns {Edit}
 */
export function vimdocTags(rename) {
    return ({ dir, files, identity: { name } }) => {
        const delta = rename(name).length - "repo_tmpl".length;
        for (const file of files.filter((f) => /^doc\/[^/]+\.txt$/.test(f))) {
            editText(join(dir, file), (text) =>
                text
                    .split("\n")
                    .map((line) => {
                        const match =
                            /^(.*?)([ .]{2,})([*|][^\s*|]*repo_tmpl[^\s*|]*[*|])$/.exec(
                                line,
                            );
                        if (!match) return line;
                        const [, head, gap, tag] = match;
                        const count = tag.split("repo_tmpl").length - 1;
                        const dots = gap.includes(".");
                        const length = Math.max(
                            dots ? 3 : 1,
                            gap.length - delta * count,
                        );
                        const lead = dots ? " " : "";
                        return `${head}${lead}${(dots ? "." : " ").repeat(length - lead.length)}${tag}`;
                    })
                    .join("\n"),
            );
        }
    };
}

/**
 * The template's `repo_tmpl` token, an identifier where `repo-tmpl` is a
 * slug, in every file that holds it, and in every path. A repository with
 * none is left alone, since a layer such as `rust-bin` has no module to name.
 * A path that would land on an existing file is an error, not an overwrite.
 * @param {(name: string) => string} rename the module's name for the
 *     repository's
 * @returns {Edit}
 */
export function moduleName(rename) {
    return (context) => {
        const {
            dir,
            identity: { name },
        } = context;
        const value = rename(name);
        context.own.push(value);
        for (const file of context.files) {
            const path = join(dir, file);
            const text = readFileSync(path, "utf8");
            if (!text.includes("repo_tmpl")) continue;
            // A function, so `$&` and `$1` in the name are not patterns.
            writeFileSync(
                path,
                text.replaceAll("repo_tmpl", () => value),
            );
        }
        context.files = context.files.map((file) => {
            const renamed = file.replaceAll("repo_tmpl", () => value);
            if (renamed === file) return file;
            const target = join(dir, renamed);
            if (collides(join(dir, file), target)) {
                fail(
                    `${renamed} already exists: the module name would overwrite it`,
                );
            }
            mkdirSync(dirname(target), { recursive: true });
            renameSync(join(dir, file), target);
            pruneEmpty(dir, dirname(file));
            return renamed;
        });
    };
}

/**
 * The crate's name, description and repository, in `[package]`. tombi aligns
 * a table's `=`, so each key is matched with any spacing; a value is written
 * as a JSON string, which is a TOML basic string.
 * @param {EditContext} context
 */
export function cargoToml({ dir, identity: { name, description }, slug }) {
    editText(join(dir, "Cargo.toml"), (text) => {
        for (const [key, value] of [
            ["name", name],
            ["description", description],
            ["repository", `https://github.com/${slug}`],
        ]) {
            text = replace(
                text,
                new RegExp(`^(${key}\\s*=\\s*)"[^"\\n]*"$`, "m"),
                (_match, head) => `${head}${JSON.stringify(value)}`,
                `${key} in Cargo.toml`,
            );
        }
        return text;
    });
}

/**
 * The crate's own entry in `Cargo.lock`, which `cargo --locked` requires to
 * agree with `Cargo.toml`.
 * @param {EditContext} context
 */
export function cargoLock({ dir, identity: { name } }) {
    editText(join(dir, "Cargo.lock"), (text) =>
        replace(
            text,
            /^(\[\[package\]\]\nname = )"repo-tmpl"$/m,
            (_match, head) => `${head}${JSON.stringify(name)}`,
            "the crate's [[package]] in Cargo.lock",
        ),
    );
}
