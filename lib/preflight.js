// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/preflight.js
//
//

// @ts-check

// Checks made before anything is created, so a mistake costs nothing.

import { UsageError } from "./args.js";
import { CommandError } from "./run.js";

/** @typedef {import("./args.js").Options} Options */
/** @typedef {import("./prompt.js").Answers} Answers */
/** @typedef {import("./run.js").RunOptions} RunOptions */

/** Its METADATA_APP_CLIENT_ID variable is copied to new repositories. */
export const METADATA_REPO = "chewygumxx/create-repo";

/**
 * @typedef {object} Tools
 * @property {(file: string, args: string[], options?: RunOptions) => Promise<{ stdout: string, stderr: string }>} run
 * @property {(path: string) => boolean} exists
 */

/**
 * Checks the tools and the gh login, and reads the client ID. A dry run
 * needs no login; without one it reads nothing from GitHub.
 * @param {Options} options
 * @param {Tools} tools
 * @returns {Promise<{ login?: string, clientId?: string }>}
 */
export async function checkTools(options, { run }) {
    for (const tool of ["git", "mise", "bun"]) {
        try {
            await run(tool, ["--version"], { capture: true });
        } catch {
            throw new UsageError(`${tool} is required but is not on PATH.`);
        }
    }
    /** @type {string | undefined} */
    let login;
    try {
        login = (
            await run("gh", ["api", "user", "--jq", ".login"], {
                capture: true,
            })
        ).stdout.trim();
    } catch {
        if (!options.dryRun) {
            throw new UsageError(
                "gh is not installed or not logged in: run gh auth login.",
            );
        }
    }
    /** @type {string | undefined} */
    let clientId;
    if (options.metadata && login) {
        try {
            clientId = (
                await run(
                    "gh",
                    [
                        "variable",
                        "get",
                        "METADATA_APP_CLIENT_ID",
                        "--repo",
                        METADATA_REPO,
                    ],
                    { capture: true },
                )
            ).stdout.trim();
        } catch (error) {
            throw new UsageError(
                `Cannot read METADATA_APP_CLIENT_ID from ${METADATA_REPO}: ${error instanceof CommandError ? error.stderr.trim() : String(error)}`,
            );
        }
        // An empty variable would leave the new repository's sync skipped,
        // which asking for metadata must not do silently.
        if (!clientId) {
            throw new UsageError(
                `METADATA_APP_CLIENT_ID of ${METADATA_REPO} is empty: set it, or pass --no-metadata.`,
            );
        }
    }
    return { login, clientId };
}

/**
 * Checks that neither the directory nor, with remote access, the repository
 * exists yet.
 * @param {Answers} answers
 * @param {Tools} tools
 * @param {{ remote: boolean }} flags
 */
export async function checkTarget(answers, { run, exists }, { remote }) {
    if (exists(answers.dir)) {
        throw new UsageError(`${answers.dir} already exists.`);
    }
    // mise skips .config/mise/conf.d in a path holding "[" and then reports
    // no tasks, after the copy and install and before anything on GitHub.
    if (answers.dir.includes("[")) {
        throw new UsageError(
            `${answers.dir} contains "[", which mise cannot read a template's tasks under: choose a --dir without "[" in its path.`,
        );
    }
    if (!remote) return;
    await checkOwnerSpelling(answers.owner, run);
    const slug = `${answers.owner}/${answers.name}`;
    try {
        await run("gh", ["api", `repos/${slug}`], { capture: true });
    } catch (error) {
        if (
            error instanceof CommandError &&
            /HTTP 404|Not Found/.test(error.stderr)
        ) {
            return;
        }
        throw new UsageError(
            `Cannot check whether ${slug} exists: ${error instanceof CommandError ? error.stderr.trim() : String(error)}`,
        );
    }
    throw new UsageError(`${slug} already exists on GitHub.`);
}

/**
 * Refuses an owner spelt otherwise than GitHub spells it. GitHub takes
 * either, but CI's header check compares the repository it is told with
 * the headers, which init writes with the owner as given, case and all.
 * An owner GitHub cannot find is left for gh repo create to report.
 * @param {string} owner
 * @param {Tools["run"]} run
 */
async function checkOwnerSpelling(owner, run) {
    let login;
    try {
        login = (
            await run("gh", ["api", `users/${owner}`, "--jq", ".login"], {
                capture: true,
            })
        ).stdout.trim();
    } catch {
        return;
    }
    if (login && login !== owner) {
        throw new UsageError(
            `GitHub spells the owner "${login}", not "${owner}": pass --owner ${login}.`,
        );
    }
}
