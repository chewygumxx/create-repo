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
import { TEMPLATES } from "./templates.js";

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
    for (const tool of ["git", "mise", "npm"]) {
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
    if (
        TEMPLATES[answers.template].family === "native" &&
        answers.dir.includes("[")
    ) {
        throw new UsageError(
            `${answers.dir} contains "[", which mise cannot read the ${answers.template} template's tasks under: choose a --dir without "[" in its path.`,
        );
    }
    if (!remote) return;
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
 * Checks the system tools the chosen template's checks need and mise does
 * not install. They are known only once the template is, after the prompt.
 * @param {Answers} answers
 * @param {Tools} tools
 */
export async function checkTemplateTools(answers, { run }) {
    for (const tool of TEMPLATES[answers.template].tools ?? []) {
        try {
            await run(tool, ["--version"], { capture: true });
        } catch {
            throw new UsageError(
                `${tool} is required to check the ${answers.template} template but is not on PATH: install it with your system's package manager.`,
            );
        }
    }
}
