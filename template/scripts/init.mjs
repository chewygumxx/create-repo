#!/usr/bin/env node
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/scripts/init.mjs
//
//

// @ts-check

// Turns a fresh copy of this template into a new repository: rewrites the
// identity in the files that carry it, uninstalls jsonc-parser, formats, then
// deletes itself, scripts/test-init.sh and the template-only workflow that
// runs it. `npm create @chewygumxx/repo` runs it after `npm ci`; the README
// shows how to run it by hand.
//
// Every edit fails when its target is missing, so a template change this
// script does not know about fails the Template workflow rather than being
// skipped.

import { execFileSync } from "node:child_process";
import {
    readdirSync,
    readFileSync,
    rmdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";

/** @typedef {{ name: string, fullName: string }} Scope */

const NAME = /^(?!\.{1,2}$)(?!.*\.(?:git|wiki)$)[A-Za-z0-9._-]{1,100}$/i;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const TOPIC = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,49}$/;
const SCOPE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,14}$/;

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
    console.error(`init: ${message}`);
    process.exit(1);
}

/** @param {string} text */
function list(text) {
    return text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * @param {string} text `name` or `name:Full Name`, comma separated
 * @returns {Scope[]}
 */
function parseScopes(text) {
    return list(text).map((item) => {
        const [name, ...rest] = item.split(":");
        if (!SCOPE.test(name)) fail(`invalid scope "${name}"`);
        const fullName =
            rest.join(":").trim() ||
            name.charAt(0).toUpperCase() + name.slice(1);
        return { name, fullName };
    });
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
 * @param {[string, unknown][]} changes
 */
function editJsonc(path, changes) {
    let text = readFileSync(path, "utf8");
    /** @type {import("jsonc-parser").ParseError[]} */
    const errors = [];
    const data = parse(text, errors);
    if (errors.length) {
        fail(
            `${path}: ${errors.map((e) => printParseErrorCode(e.error)).join(", ")}`,
        );
    }
    for (const [key, value] of changes) {
        if (!(key in data)) fail(`"${key}" in ${path} not found`);
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
 * @param {string} path
 */
function requireKeys(data, keys, path) {
    for (const key of keys) {
        if (!(key in data)) fail(`"${key}" in ${path} not found`);
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

const { values } = parseArgs({
    options: {
        owner: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        topics: { type: "string", default: "" },
        scopes: { type: "string", default: "" },
    },
});

const { owner, name, description } = values;
if (!owner || !name || !description?.trim()) {
    fail("--owner, --name and --description are required");
}
if (!NAME.test(name)) fail(`invalid repository name "${name}"`);
if (!OWNER.test(owner)) fail(`invalid owner "${owner}"`);
const topics = list(values.topics);
for (const topic of topics) {
    if (!TOPIC.test(topic)) fail(`invalid topic "${topic}"`);
}
const scopes = parseScopes(values.scopes);
const slug = `${owner}/${name}`;

process.chdir(fileURLToPath(new URL("..", import.meta.url)));

editJsonc(".repo-metadata.jsonc", [
    ["name", name],
    ["owner", owner],
    ["slug", slug],
    ["description", description],
    ["topics", topics],
    ["is_template", undefined],
]);

editJson("package.json", (data) => {
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

editJson("package-lock.json", (data) => {
    requireKeys(data, ["name", "packages"], "package-lock.json");
    requireKeys(data.packages, [""], "package-lock.json packages");
    data.name = name;
    data.packages[""].name = name;
});

editText("README.md", (text) => {
    const today = new Date().toISOString().slice(0, 10);
    const tags = topics.length
        ? `tags:\n${topics.map((topic) => `  - ${topic}\n`).join("")}`
        : "tags: []\n";
    // An entry is its key line plus any more-indented continuation lines,
    // so a folded scalar is replaced whole.
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
        () => `# ${name}\n\n${wrap(description)}\n\n`,
        'the heading, intro and "Using this template" in README.md',
    );
});

if (scopes.length) {
    editText(".commitlintrc.mts", (text) =>
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

// jsonc-parser is already loaded, so it can go before the script ends.
execFileSync("npm", ["uninstall", "--silent", "jsonc-parser"], {
    stdio: "inherit",
});
execFileSync("npm", ["run", "--silent", "format"], { stdio: "inherit" });

rmSync("scripts/init.mjs");
rmSync("scripts/test-init.sh");
rmSync(".github/workflows/template.yaml");
if (readdirSync("scripts").length === 0) rmdirSync("scripts");
