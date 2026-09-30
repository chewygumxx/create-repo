// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/prompt.js
//
//

// @ts-check

import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
    checkDescription,
    checkName,
    parseFeatures,
    parseScopes,
    parseTopics,
    UsageError,
} from "./args.js";
import {
    checkFeatures,
    DEFAULT_TEMPLATE,
    getTemplate,
    label,
    TEMPLATES,
} from "./templates.js";

/** @typedef {import("./args.js").Options} Options */
/** @typedef {import("./args.js").Scope} Scope */
/** @typedef {(question: string) => Promise<string>} Ask */
/** @typedef {import("./templates.js").Template} Template */

/**
 * Everything needed before anything is created.
 * @typedef {object} Answers
 * @property {string} name
 * @property {string} description
 * @property {string[]} topics
 * @property {Scope[]} scopes
 * @property {string} template
 * @property {string[]} features
 * @property {string} owner
 * @property {"public" | "private"} visibility
 * @property {string} dir absolute
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
 * The numbered list of templates, then the question.
 * @param {Record<string, Template>} templates
 * @param {string} fallback
 */
function templateQuestion(templates, fallback) {
    const names = Object.keys(templates);
    const width = Math.max(...names.map((name) => name.length));
    const rows = names.map(
        (name, index) =>
            `  ${index + 1}. ${name.padEnd(width)}  ${templates[name].description}`,
    );
    return `Templates:\n${rows.join("\n")}\nTemplate [${fallback}]: `;
}

/**
 * A template by number or name; an empty reply is the fallback.
 * @param {string} reply
 * @param {Record<string, Template>} templates
 * @param {string} fallback
 */
function pickTemplate(reply, templates, fallback) {
    if (!reply) return fallback;
    const names = Object.keys(templates);
    if (/^\d+$/.test(reply)) {
        const name = names[Number(reply) - 1];
        if (name === undefined) {
            throw new UsageError(`Choose 1 to ${names.length}.`);
        }
        return name;
    }
    getTemplate(reply, templates);
    return reply;
}

/**
 * The template's features, then the question, which shows what an empty
 * reply takes.
 * @param {string} name
 * @param {Template} template
 */
function featureQuestion(name, template) {
    const entries = Object.entries(template.features);
    const width = Math.max(...entries.map(([feature]) => feature.length));
    const rows = entries.map(
        ([feature, description]) =>
            `  ${feature.padEnd(width)}  ${description}`,
    );
    const taken = template.defaultFeatures?.join(",") || "none";
    return `Features of ${name}:\n${rows.join("\n")}\nFeatures (comma separated, or none) [${taken}]: `;
}

/**
 * The features a reply chooses: an empty reply takes the template's
 * defaults, and `none` takes no feature.
 * @param {string} reply
 * @param {string} name
 * @param {Template} template
 */
function pickFeatures(reply, name, template) {
    if (reply === "none") return [];
    const chosen = reply
        ? parseFeatures(reply)
        : (template.defaultFeatures ?? []);
    return checkFeatures(name, template, chosen);
}

/**
 * Fills in what the flags left out, prompting when `ask` is given.
 * @param {Options} options
 * @param {{ owner: string, ask?: Ask, warn?: (message: string) => void, templates?: Record<string, Template> }} context
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
    const templates = context.templates ?? TEMPLATES;
    const owner = options.owner ?? context.owner;
    const names = Object.keys(templates);
    const fallback = names.includes(DEFAULT_TEMPLATE)
        ? DEFAULT_TEMPLATE
        : names[0];
    /** @type {string} */
    let templateName;
    if (options.template !== undefined) {
        getTemplate(options.template, templates);
        templateName = options.template;
    } else if (ask && names.length > 1) {
        templateName = await askUntil(
            ask,
            templateQuestion(templates, fallback),
            (reply) => pickTemplate(reply, templates, fallback),
            warn,
        );
    } else {
        templateName = fallback;
    }
    const template = templates[templateName];
    const flagName =
        options.name === undefined ? undefined : checkName(options.name);
    /**
     * The features, refused when the template cannot use the owner, or a
     * name given as a flag, with them. Neither can be re-entered at the name
     * prompt, so at the features prompt this asks for the features again.
     * @param {string[]} features
     * @param {string} [hint]
     */
    const usable = (features, hint) => {
        const chosen = new Set(features);
        try {
            template.checkOwner?.(owner, chosen);
            if (flagName !== undefined) {
                template.checkName?.({ owner, name: flagName }, chosen);
            }
        } catch (error) {
            if (hint && error instanceof UsageError) {
                throw new UsageError(`${error.message} ${hint}`);
            }
            throw error;
        }
        return features;
    };
    const features =
        options.features !== undefined
            ? usable(checkFeatures(templateName, template, options.features))
            : ask && Object.keys(template.features).length
              ? await askUntil(
                    ask,
                    featureQuestion(templateName, template),
                    (reply) =>
                        usable(
                            pickFeatures(reply, templateName, template),
                            "Choose other features, or none.",
                        ),
                    warn,
                )
              : [];
    const chosen = new Set(features);
    /** @param {string} reply */
    const nameFor = (reply) => {
        const name = checkName(reply);
        template.checkName?.({ owner, name }, chosen);
        return name;
    };
    const name = await value(
        flagName === undefined ? undefined : nameFor(flagName),
        "the repository name",
        "Repository name: ",
        nameFor,
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
        template: templateName,
        features,
        owner,
        visibility: options.visibility,
        dir: resolve(options.dir ?? name),
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
        ["Template", label(answers.template, answers.features)],
        ["Description", answers.description],
        ["Topics", answers.topics.join(", ") || "none"],
        [
            "Scopes",
            answers.scopes
                .map((scope) => `${scope.name} (${scope.fullName})`)
                .join(", ") || "none",
        ],
        ["Directory", answers.dir],
        [
            "Metadata",
            keySource
                ? `App key from ${keySource}`
                : "skipped; the metadata sync fails until METADATA_APP_CLIENT_ID and METADATA_APP_PRIVATE_KEY are set",
        ],
    ];
    if (dryRun) rows.push(["Dry run", "nothing is created on GitHub"]);
    return rows.map(([name, text]) => `${name.padEnd(12)} ${text}`).join("\n");
}

/** @param {Ask} ask */
export async function confirm(ask) {
    return /^y(?:es)?$/i.test(await ask("Create it? [y/N] "));
}
