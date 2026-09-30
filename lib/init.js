// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/init.js
//
//

// @ts-check

// Turns a fresh copy of the template into a new repository by rewriting the
// identity in the files that carry it. The caller formats the copy after.
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
    const data = JSON.parse(text);
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
 * @param {string} dir the copy
 * @param {Identity} identity
 * @param {string[]} files the copy's files, relative to `dir`
 * @param {{ today?: string }} [options] `today` as YYYY-MM-DD
 */
export function init(
    dir,
    { owner, name, description, topics, scopes },
    files,
    { today = new Date().toISOString().slice(0, 10) } = {},
) {
    const slug = `${owner}/${name}`;
    const at = (/** @type {string} */ file) => join(dir, file);

    // File headers name the repository as `~owner/name.git`. CI's header
    // sync would correct them, but its token may not push changes to
    // workflow files, so they are rewritten here.
    const template = parse(
        readFileSync(at(".repo-metadata.jsonc"), "utf8"),
    )?.slug;
    if (typeof template !== "string") {
        fail(`"slug" in .repo-metadata.jsonc not found`);
    }
    let headers = 0;
    for (const file of files) {
        const text = readFileSync(at(file), "utf8");
        if (!text.includes(`~${template}.git`)) continue;
        writeFileSync(
            at(file),
            text.replaceAll(`~${template}.git`, `~${slug}.git`),
        );
        headers += 1;
    }
    if (headers === 0) fail(`no file header naming ~${template}.git found`);

    editJsonc(at(".repo-metadata.jsonc"), ".repo-metadata.jsonc", [
        ["name", name],
        ["owner", owner],
        ["slug", slug],
        ["description", description],
        ["topics", topics],
        ["is_template", undefined],
    ]);

    editJson(at("package.json"), (data) => {
        requireKeys(
            data,
            ["name", "description", "keywords", "homepage", "repository"],
            "package.json",
        );
        data.name = name;
        data.description = description;
        data.keywords = topics;
        data.homepage = `https://github.com/${slug}`;
        data.repository = `github:${slug}`;
    });

    editJson(at("package-lock.json"), (data) => {
        requireKeys(data, ["name", "packages"], "package-lock.json");
        requireKeys(data.packages, [""], "package-lock.json packages");
        data.name = name;
        data.packages[""].name = name;
    });

    editText(at("README.md"), (text) => {
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

    if (scopes.length) {
        editText(at(".commitlintrc.mts"), (text) =>
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
}
