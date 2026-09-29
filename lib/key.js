// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/key.js
//
//

// @ts-check

// The metadata App's private key: where it comes from, what it must look
// like, and keeping it out of every child process that does not need it.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { UsageError } from "./args.js";

/** @typedef {import("./args.js").Options} Options */

/**
 * @typedef {object} KeySources
 * @property {() => Promise<string>} readStdin
 * @property {(path: string) => string} readFile
 * @property {(command: string) => Promise<string>} runCommand
 */

export const DEFAULT_ENV_FILE = join(
    homedir(),
    ".config",
    "chewygumxx",
    "create-repo.env",
);

/** Variables that carry the key or lead to it; never passed to children. */
export const KEY_VARIABLES = [
    "METADATA_APP_PRIVATE_KEY",
    "METADATA_APP_PRIVATE_KEY_FILE",
    "CREATE_REPO_METADATA_KEY_COMMAND",
];

const PEM =
    /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/;

/**
 * Loads `KEY=value` lines into `env`, leaving variables already set alone.
 * The default file is optional; a named one must exist.
 * @param {NodeJS.ProcessEnv} env
 * @param {string | undefined} path `--env-file`, or undefined for the default
 * @param {(path: string) => string} [read]
 */
export function loadEnvFile(env, path, read = (p) => readFileSync(p, "utf8")) {
    const file = path ?? DEFAULT_ENV_FILE;
    let text;
    try {
        text = read(file);
    } catch (error) {
        if (
            path === undefined &&
            /** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT"
        ) {
            return;
        }
        throw new UsageError(
            `Cannot read env-file ${file}: ${/** @type {Error} */ (error).message}`,
        );
    }
    for (const [name, value] of Object.entries(parseEnv(text))) {
        if (env[name] === undefined) env[name] = value;
    }
}

/**
 * @param {string} key
 * @param {string} source where the key came from, for the error only
 */
export function checkPem(key, source) {
    if (!PEM.test(key)) {
        throw new UsageError(
            `The metadata App private key from ${source} is not a PEM private key.`,
        );
    }
}

/**
 * @param {KeySources} sources
 * @param {string} path
 */
function readKeyFile(sources, path) {
    try {
        return sources.readFile(path);
    } catch (error) {
        throw new UsageError(
            `Cannot read the metadata App private key from ${path}: ${/** @type {Error} */ (error).message}`,
        );
    }
}

/**
 * Finds the key: `--metadata-key-file`, then `METADATA_APP_PRIVATE_KEY`, then
 * `METADATA_APP_PRIVATE_KEY_FILE`, then the key command.
 * @param {Options} options
 * @param {NodeJS.ProcessEnv} env
 * @param {KeySources} sources
 * @returns {Promise<{ key: string, source: string }>}
 */
export async function resolveKey(options, env, sources) {
    /** @type {{ key: string, source: string } | undefined} */
    let found;
    const command =
        options.metadataKeyCommand ?? env.CREATE_REPO_METADATA_KEY_COMMAND;
    if (options.metadataKeyFile === "-") {
        found = { key: await sources.readStdin(), source: "standard input" };
    } else if (options.metadataKeyFile !== undefined) {
        found = {
            key: readKeyFile(sources, options.metadataKeyFile),
            source: options.metadataKeyFile,
        };
    } else if (env.METADATA_APP_PRIVATE_KEY) {
        found = {
            key: env.METADATA_APP_PRIVATE_KEY,
            source: "METADATA_APP_PRIVATE_KEY",
        };
    } else if (env.METADATA_APP_PRIVATE_KEY_FILE) {
        found = {
            key: readKeyFile(sources, env.METADATA_APP_PRIVATE_KEY_FILE),
            source: env.METADATA_APP_PRIVATE_KEY_FILE,
        };
    } else if (command) {
        found = {
            key: await sources.runCommand(command),
            source: `the command "${command}"`,
        };
    }
    if (!found) {
        throw new UsageError(
            "No metadata App private key. Pass --metadata-key-file, or set METADATA_APP_PRIVATE_KEY, METADATA_APP_PRIVATE_KEY_FILE or CREATE_REPO_METADATA_KEY_COMMAND (an env-file may set them), or pass --no-metadata.",
        );
    }
    checkPem(found.key, found.source);
    return found;
}

/**
 * A copy of `env` without the key variables, for child processes.
 * @param {NodeJS.ProcessEnv} env
 */
export function childEnv(env) {
    const copy = { ...env };
    for (const name of KEY_VARIABLES) delete copy[name];
    return copy;
}
