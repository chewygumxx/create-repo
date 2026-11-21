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

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
 * Sets keys of a JSONC file with jsonc-parser, keeping its comments, its
 * trailing commas and its layout. A key is a top-level key or a path to a
 * nested one; a value of `undefined` removes it.
 * @param {string} path
 * @param {string} name names the file in errors
 * @param {[string | string[], unknown][]} changes
 */
function editJsonc(path, name, changes) {
    let text = readFileSync(path, "utf8");
    /** @type {import("jsonc-parser").ParseError[]} */
    const errors = [];
    const data = parse(text, errors, { allowTrailingComma: true });
    if (errors.length) {
        fail(
            `${name}: ${errors.map((e) => printParseErrorCode(e.error)).join(", ")}`,
        );
    }
    for (const [key, value] of changes) {
        const keys = typeof key === "string" ? [key] : key;
        /** @type {any} */
        let node = data;
        for (const part of keys) {
            if (node === null || typeof node !== "object" || !(part in node)) {
                fail(
                    `"${keys.map((k) => k || '""').join(".")}" in ${name} not found`,
                );
            }
            node = node[part];
        }
        const edits = modify(text, keys, value, {
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
 * Wraps prose at `width` columns, passing the word that starts each line
 * through `start`.
 * @param {string} text
 * @param {number} [width]
 * @param {(word: string) => string} [start]
 */
function wrap(text, width = 80, start = (word) => word) {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && line.length + 1 + word.length > width) {
            lines.push(line);
            line = start(word);
        } else {
            line = line ? `${line} ${word}` : start(word);
        }
    }
    if (line) lines.push(line);
    return lines.join("\n");
}

/**
 * The description as a README paragraph, wrapped at 80 columns, that renders
 * as typed and that remark accepts. Bare addresses become autolinks, leaving
 * trailing punctuation outside: `<https://…>`, `<user@host>`, and
 * `[www.…](https://www.…)` since an autolink needs a scheme. Elsewhere the
 * characters that open inline syntax are escaped, and so is a word that
 * would open a block (a heading, list, quote, table, fence or setext
 * underline) where it starts a line.
 * @param {string} text
 */
function paragraph(text) {
    const inline = text.replace(
        /\b(https?:\/\/|www\.)[^\s<>]*[^\s<>.,;:!?'")\]]|([\w.+-]+@(?:[\w-]+\.)+[\w-]*[A-Za-z\d])|[\\`*_[\]<]/g,
        (match, start, email) => {
            if (start === "www.") return `[${match}](https://${match})`;
            if (start || email) return `<${match}>`;
            return `\\${match}`;
        },
    );
    return wrap(inline, 80, (word) =>
        word.replace(/^(?:\d+(?=[.)])|(?=[#>+=|~-]))/, "$&\\"),
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
 * @property {string[]} files the copy's files, relative to `dir`
 * @property {ReadonlySet<string>} features the template's chosen features
 * @property {string} slug the new repository's `owner/name`
 * @property {string} template the template's own slug, from its
 *     .repo-metadata.jsonc
 * @property {string} today YYYY-MM-DD
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
 * description and YAML folds it, and the README's Markdown form of the
 * description counts as the description too.
 * @param {Identity} identity
 * @returns {(text: string) => boolean}
 */
function namesTemplate({ owner, name, description, topics, scopes }) {
    const own = [
        owner,
        name,
        description,
        paragraph(description),
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
    };
    for (const edit of edits) edit(context);
    const remaining = namesTemplate(identity);
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

/**
 * Adds the words a spell check of the new repository did not know to the
 * `words` of its `.config/cspell.json`. The templates' own text is spelled
 * to the shared word list, so these come from the identity: the name,
 * owner, description, topics and scopes, which are the repository's own to
 * choose.
 * @param {string} dir the copy
 * @param {string} output the check's unknown words, one per line
 */
export function recordWords(dir, output) {
    const words = output
        .split("\n")
        .map((word) => word.trim())
        .filter(Boolean);
    if (!words.length) return;
    editJson(join(dir, ".config/cspell.json"), (data) => {
        data.words = [...new Set([...(data.words ?? []), ...words])].sort(
            (a, b) => a.localeCompare(b, "en", { sensitivity: "base" }),
        );
    });
}

/** The generated CI's metadata sync switch, on once its variable is set. */
const METADATA_SYNC =
    /^( {12}metadata-sync: )\$\{\{ vars\.METADATA_APP_CLIENT_ID != '' \}\}$/m;

/**
 * Turns the metadata sync off in the copy's CI, for --no-metadata: a
 * METADATA_APP_CLIENT_ID an organisation shares with its repositories
 * would otherwise turn it on, with no key to match.
 * @param {string} dir the copy
 */
export function disableMetadataSync(dir) {
    try {
        editText(join(dir, ".github/workflows/ci.yaml"), (text) =>
            replace(
                text,
                METADATA_SYNC,
                (_match, head) =>
                    `${head}false # create-repo --no-metadata; see the README`,
                "the metadata-sync switch in .github/workflows/ci.yaml",
            ),
        );
    } catch (error) {
        if (error instanceof TemplateError) throw error;
        throw new TemplateError(
            `init: ${error instanceof Error ? error.message : error}`,
            { cause: error },
        );
    }
}

/**
 * The lock's root workspace, the one place bun.lock names the package.
 * @param {EditContext} context
 */
export function bunLock(context) {
    editJsonc(join(context.dir, "bun.lock"), "bun.lock", [
        [["workspaces", "", "name"], packageName(context)],
    ]);
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
        text = replace(text, /^mtime: .*$/m, () => `mtime: ${today}`, "mtime");
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
            () => `# ${name}\n\n${paragraph(description)}\n\n`,
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
