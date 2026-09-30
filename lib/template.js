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
// copyTemplate() renames it back.

import {
    cpSync,
    existsSync,
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
 * Copies the template into `dir`, which must not exist.
 * @param {string} dir
 * @param {string} [from]
 * @returns {string[]} the copy's files, relative to `dir`
 */
export function copyTemplate(dir, from = TEMPLATE_DIR) {
    if (existsSync(dir)) throw new TemplateError(`${dir} already exists.`);
    cpSync(from, dir, { recursive: true });
    for (const [stored, name] of Object.entries(RENAMED)) {
        renameSync(join(dir, stored), join(dir, name));
    }
    return listFiles(dir);
}
