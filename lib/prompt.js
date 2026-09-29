// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/prompt.js
//
//

// @ts-check

import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
    checkDescription,
    checkName,
    parseScopes,
    parseTopics,
    UsageError,
} from "./args.js";

/** @typedef {import("./args.js").Options} Options */
/** @typedef {import("./args.js").Scope} Scope */
/** @typedef {(question: string) => Promise<string>} Ask */

/**
 * Everything needed before anything is created.
 * @typedef {object} Answers
 * @property {string} name
 * @property {string} description
 * @property {string[]} topics
 * @property {Scope[]} scopes
 * @property {string} owner
 * @property {"public" | "private"} visibility
 * @property {string} dir absolute
 * @property {string} template
 */

/**
 * Prompts on the terminal, writing questions to standard error so standard
 * output stays clean. Undefined when standard input is not a terminal.
 * @param {NodeJS.ReadStream} [input]
 * @param {NodeJS.WriteStream} [output]
 * @returns {Ask | undefined}
 */
export function terminalAsk(input = process.stdin, output = process.stderr) {
    if (!input.isTTY) return undefined;
    return async (question) => {
        const lines = createInterface({ input, output });
        try {
            return (await lines.question(question)).trim();
        } finally {
            lines.close();
        }
    };
}

/**
 * Asks until `parse` accepts the reply.
 * @template T
 * @param {Ask} ask
 * @param {string} question
 * @param {(reply: string) => T} parse throws UsageError to ask again
 * @param {(message: string) => void} warn
 * @returns {Promise<T>}
 */
async function askUntil(ask, question, parse, warn) {
    for (;;) {
        try {
            return parse(await ask(question));
        } catch (error) {
            if (!(error instanceof UsageError)) throw error;
            warn(error.message);
        }
    }
}

/**
 * Fills in what the flags left out, prompting when `ask` is given.
 * @param {Options} options
 * @param {{ owner: string, ask?: Ask, warn?: (message: string) => void }} context
 * @returns {Promise<Answers>}
 */
export async function completeAnswers(options, context) {
    const { ask, warn = (message) => console.error(message) } = context;
    /**
     * @template T
     * @param {T | undefined} given
     * @param {string} flag
     * @param {string} question
     * @param {(reply: string) => T} parse
     * @param {T} [fallback] used instead of failing when there is no terminal
     * @returns {Promise<T>}
     */
    const value = async (given, flag, question, parse, fallback) => {
        if (given !== undefined) return given;
        if (ask) return askUntil(ask, question, parse, warn);
        if (fallback !== undefined) return fallback;
        throw new UsageError(
            `Missing ${flag}: pass it as a flag when not running in a terminal.`,
        );
    };
    const name = await value(
        options.name,
        "the repository name",
        "Repository name: ",
        checkName,
    );
    const description = await value(
        options.description,
        "--description",
        "Description: ",
        checkDescription,
    );
    const topics = await value(
        options.topics,
        "--topics",
        "Topics (comma separated, may be empty): ",
        parseTopics,
        /** @type {string[]} */ ([]),
    );
    const scopes = await value(
        options.scopes,
        "--scopes",
        "Commit scopes (name or name:Full Name, comma separated, may be empty): ",
        parseScopes,
        /** @type {Scope[]} */ ([]),
    );
    return {
        name,
        description,
        topics,
        scopes,
        owner: options.owner ?? context.owner,
        visibility: options.visibility,
        dir: resolve(options.dir ?? name),
        template: options.template,
    };
}

/**
 * @param {Answers} answers
 * @param {{ dryRun: boolean, keySource?: string }} flags `keySource` is
 *     undefined with --no-metadata
 */
export function summary(answers, { dryRun, keySource }) {
    const rows = [
        [
            "Repository",
            `${answers.owner}/${answers.name} (${answers.visibility})`,
        ],
        ["Description", answers.description],
        ["Topics", answers.topics.join(", ") || "none"],
        [
            "Scopes",
            answers.scopes
                .map((scope) => `${scope.name} (${scope.fullName})`)
                .join(", ") || "none",
        ],
        ["Directory", answers.dir],
        ["Template", answers.template],
        [
            "Metadata",
            keySource
                ? `App key from ${keySource}`
                : "skipped; the metadata sync fails until METADATA_APP_CLIENT_ID and METADATA_APP_PRIVATE_KEY are set",
        ],
    ];
    if (dryRun) rows.push(["Dry run", "nothing is created on GitHub"]);
    return rows
        .map(([label, text]) => `${label.padEnd(12)} ${text}`)
        .join("\n");
}

/** @param {Ask} ask */
export async function confirm(ask) {
    return /^y(?:es)?$/i.test(await ask("Create it? [y/N] "));
}
