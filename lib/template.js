// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/template.js
//
//

// @ts-check

// The bundled templates, templates/ in this package. Each subdirectory is a
// layer, and a template is an ordered list of layers, a later layer's file
// replacing the same path from an earlier one. npm drops any file named
// .gitignore from a package, so layers store it as _gitignore and
// copyTemplate() renames it back. The last layer's _gitignore applies to
// every layer: a checkout's layers may hold files it ignores, such as
// node_modules or .env.local, which neither templateFiles() nor
// copyTemplate() includes.

import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATES_DIR = fileURLToPath(
    new URL("../templates", import.meta.url),
);

/** @type {Record<string, string>} Stored name to real name. */
export const RENAMED = { _gitignore: ".gitignore" };

/** @type {string} This package's version, recorded in the first commit. */
export const VERSION = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

/** The template and the edits init makes to it disagree. */
export class TemplateError extends Error {}

/** The copy's target exists already; nothing was copied into it. */
export class TargetExistsError extends TemplateError {}

/**
 * The files under `dir`, relative to it, sorted.
 * @param {string} dir
 */
export function listFiles(dir) {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
        .sort();
}

/**
 * One `.gitignore` rule as a test of a path relative to a layer, a
 * directory's with a trailing slash. Only `*`, `?`, a leading `/` and a
 * trailing `/` are understood; anything else fails loudly.
 * @param {string} pattern
 */
function ignoreRule(pattern) {
    if (/^!|\*\*|\[|\\/.test(pattern)) {
        throw new TemplateError(
            `Unsupported rule "${pattern}" in the template's .gitignore.`,
        );
    }
    const dirOnly = pattern.endsWith("/");
    const body = dirOnly ? pattern.slice(0, -1) : pattern;
    const anchored = body.includes("/");
    const source = body
        .replace(/^\//, "")
        .replace(/[.+^${}()|\]]/g, "\\$&")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]");
    return new RegExp(
        `${anchored ? "^" : "(^|/)"}${source}${dirOnly ? "/" : "(/|$)"}`,
    );
}

/**
 * Tells whether a path relative to a layer is ignored by `gitignore`.
 * @param {string} gitignore the composed _gitignore's path
 * @returns {(path: string) => boolean}
 */
function ignoredBy(gitignore) {
    const rules = readFileSync(gitignore, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map(ignoreRule);
    return (path) => rules.some((rule) => rule.test(path));
}

/**
 * A layer's files, relative to it, without what `ignored` matches and
 * without descending into an ignored directory.
 * @param {string} root the layer
 * @param {(path: string) => boolean} ignored
 * @param {string} [dir] relative to `root`
 * @returns {string[]}
 */
function walk(root, ignored, dir = "") {
    /** @type {string[]} */
    const files = [];
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (!ignored(`${path}/`)) files.push(...walk(root, ignored, path));
        } else if (entry.isFile() && !ignored(path)) {
            files.push(path);
        }
    }
    return files;
}

/**
 * The template `layers` compose: each file, relative to the template and as
 * stored, to the layer file it comes from, sorted.
 * @param {string[]} layers
 * @param {string} [root]
 * @returns {Map<string, string>}
 */
export function compose(layers, root = TEMPLATES_DIR) {
    const dirs = layers.map((layer) => {
        const dir = join(root, layer);
        if (!existsSync(dir)) {
            throw new TemplateError(`No layer "${layer}" in ${root}.`);
        }
        return dir;
    });
    const gitignore = dirs
        .map((dir) => join(dir, "_gitignore"))
        .findLast((path) => existsSync(path));
    if (!gitignore) {
        throw new TemplateError(
            `None of the layers ${layers.join(", ")} has a _gitignore.`,
        );
    }
    const ignored = ignoredBy(gitignore);
    /** @type {Map<string, string>} */
    const files = new Map();
    for (const dir of dirs) {
        for (const file of walk(dir, ignored)) files.set(file, join(dir, file));
    }
    return new Map([...files].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * The files of the template `layers` compose, relative to it, sorted, as
 * stored.
 * @param {string[]} layers
 * @param {string} [root]
 */
export function templateFiles(layers, root = TEMPLATES_DIR) {
    return [...compose(layers, root).keys()];
}

/**
 * Copies the template `layers` compose into `dir`, which must not exist.
 * @param {string} dir
 * @param {string[]} layers
 * @param {string} [root]
 * @returns {string[]} the copy's files, relative to `dir`
 */
export function copyTemplate(dir, layers, root = TEMPLATES_DIR) {
    if (existsSync(dir)) throw new TargetExistsError(`${dir} already exists.`);
    try {
        return copy(dir, layers, root);
    } catch (error) {
        if (error instanceof TemplateError) throw error;
        throw new TemplateError(
            `Cannot copy the template to ${dir}: ${error instanceof Error ? error.message : error}`,
            { cause: error },
        );
    }
}

/**
 * @param {string} dir
 * @param {string[]} layers
 * @param {string} root
 */
function copy(dir, layers, root) {
    for (const [file, source] of compose(layers, root)) {
        const target = join(dir, RENAMED[file] ?? file);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(source, target);
    }
    return listFiles(dir);
}
