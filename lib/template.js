// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/template.js
//
//

// @ts-check

// The bundled template, template/ in this package. npm drops any file named
// .gitignore from a package, so the template stores it as _gitignore and
// copyTemplate() renames it back. A checkout's template/ may also hold files
// its _gitignore ignores, such as node_modules or .env.local; neither
// templateFiles() nor copyTemplate() includes them.

import {
    cpSync,
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    renameSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATE_DIR = fileURLToPath(
    new URL("../template", import.meta.url),
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
 * One `.gitignore` rule as a test of a path relative to the template, a
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
 * Tells whether a path relative to the template `from` is ignored by the
 * template's own _gitignore.
 * @param {string} from
 * @returns {(path: string) => boolean}
 */
function ignoredBy(from) {
    const rules = readFileSync(join(from, "_gitignore"), "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map(ignoreRule);
    return (path) => rules.some((rule) => rule.test(path));
}

/**
 * The template's files, relative to it, sorted, without ignored ones.
 * @param {string} [from]
 */
export function templateFiles(from = TEMPLATE_DIR) {
    const ignored = ignoredBy(from);
    return listFiles(from).filter((file) => !ignored(file));
}

/**
 * Copies the template into `dir`, which must not exist.
 * @param {string} dir
 * @param {string} [from]
 * @returns {string[]} the copy's files, relative to `dir`
 */
export function copyTemplate(dir, from = TEMPLATE_DIR) {
    if (existsSync(dir)) throw new TargetExistsError(`${dir} already exists.`);
    try {
        return copy(dir, from);
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
 * @param {string} from
 */
function copy(dir, from) {
    const ignored = ignoredBy(from);
    cpSync(from, dir, {
        recursive: true,
        filter: (source) => {
            const path = relative(from, source);
            if (!path) return true;
            return !ignored(
                lstatSync(source).isDirectory() ? `${path}/` : path,
            );
        },
    });
    for (const [stored, name] of Object.entries(RENAMED)) {
        renameSync(join(dir, stored), join(dir, name));
    }
    return listFiles(dir);
}
