// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/args.js
//
//

// @ts-check

import { parseArgs } from "node:util";

/** @typedef {{ name: string, fullName: string }} Scope */

/**
 * The command line, with prompted values left undefined when not given.
 * @typedef {object} Options
 * @property {string} [name]
 * @property {string} [description]
 * @property {string[]} [topics]
 * @property {Scope[]} [scopes]
 * @property {string} [owner]
 * @property {"public" | "private"} visibility
 * @property {string} [dir]
 * @property {string} template
 * @property {string} [envFile]
 * @property {string} [metadataKeyFile]
 * @property {string} [metadataKeyCommand]
 * @property {boolean} metadata
 * @property {boolean} dryRun
 * @property {boolean} yes
 * @property {boolean} help
 */

/** A mistake by the caller, reported without a stack trace. */
export class UsageError extends Error {}

export const DEFAULT_TEMPLATE = "chewygumxx/repo-tmpl";

// Keep in step with repo-tmpl's scripts/init.mjs.
const NAME = /^(?!\.{1,2}$)(?!.*\.(?:git|wiki)$)[A-Za-z0-9._-]{1,100}$/i;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const TOPIC = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,49}$/;
const SCOPE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,14}$/;

/** @param {string} text */
function list(text) {
    return text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

/** @param {string} name */
export function checkName(name) {
    if (!NAME.test(name)) {
        throw new UsageError(
            `Invalid repository name "${name}": use letters, digits, ".", "-" and "_", not ending in ".git" or ".wiki".`,
        );
    }
    return name;
}

/** @param {string} owner */
function checkOwner(owner) {
    if (!OWNER.test(owner)) {
        throw new UsageError(`Invalid owner "${owner}".`);
    }
    return owner;
}

/** @param {string} template */
function checkTemplate(template) {
    const [owner, name, ...rest] = template.split("/");
    if (rest.length || !owner || !name) {
        throw new UsageError(`Invalid template "${template}": use owner/name.`);
    }
    checkOwner(owner);
    checkName(name);
    return template;
}

/** @param {string} text */
export function parseTopics(text) {
    const topics = [...new Set(list(text))];
    if (topics.length > 20) {
        throw new UsageError(
            `Too many topics: ${topics.length}; GitHub allows at most 20.`,
        );
    }
    for (const topic of topics) {
        if (!TOPIC.test(topic)) {
            throw new UsageError(
                `Invalid topic "${topic}": lowercase letters, digits and "-", starting with a letter or digit, at most 50 characters.`,
            );
        }
    }
    return topics;
}

/**
 * @param {string} text `name` or `name:Full Name`, comma separated
 * @returns {Scope[]}
 */
export function parseScopes(text) {
    return list(text).map((item) => {
        const [name, ...rest] = item.split(":");
        if (!SCOPE.test(name)) {
            throw new UsageError(
                `Invalid scope "${name}": lowercase letters, digits and "-".`,
            );
        }
        const fullName =
            rest.join(":").trim() ||
            name.charAt(0).toUpperCase() + name.slice(1);
        return { name, fullName };
    });
}

/** @param {Scope[]} scopes */
export function formatScopes(scopes) {
    return scopes.map((scope) => `${scope.name}:${scope.fullName}`).join(",");
}

/**
 * @param {string[]} argv the arguments after the program name
 * @returns {Options}
 */
export function parseOptions(argv) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                description: { type: "string" },
                topics: { type: "string" },
                scopes: { type: "string" },
                owner: { type: "string" },
                private: { type: "boolean", default: false },
                dir: { type: "string" },
                template: { type: "string", default: DEFAULT_TEMPLATE },
                "env-file": { type: "string" },
                "metadata-key-file": { type: "string" },
                "metadata-key-command": { type: "string" },
                "no-metadata": { type: "boolean", default: false },
                "dry-run": { type: "boolean", default: false },
                yes: { type: "boolean", short: "y", default: false },
                help: { type: "boolean", short: "h", default: false },
            },
        });
    } catch (error) {
        throw new UsageError(
            error instanceof Error ? error.message : String(error),
        );
    }
    const { values, positionals } = parsed;
    if (positionals.length > 1) {
        throw new UsageError(
            `Expected one repository name, got: ${positionals.join(" ")}.`,
        );
    }
    const name = positionals[0];
    /** @type {Options} */
    const options = {
        name: name === undefined ? undefined : checkName(name),
        description: values.description,
        topics:
            values.topics === undefined
                ? undefined
                : parseTopics(values.topics),
        scopes:
            values.scopes === undefined
                ? undefined
                : parseScopes(values.scopes),
        owner:
            values.owner === undefined ? undefined : checkOwner(values.owner),
        visibility: values.private ? "private" : "public",
        dir: values.dir,
        template: checkTemplate(values.template),
        envFile: values["env-file"],
        metadataKeyFile: values["metadata-key-file"],
        metadataKeyCommand: values["metadata-key-command"],
        metadata: !values["no-metadata"],
        dryRun: values["dry-run"],
        yes: values.yes,
        help: values.help,
    };
    if (options.metadataKeyFile === "-") {
        if (!options.name || !options.description) {
            throw new UsageError(
                "With --metadata-key-file -, pass the name and --description too: standard input carries the key, so nothing can be prompted.",
            );
        }
        if (!options.yes) {
            throw new UsageError(
                "With --metadata-key-file -, pass --yes: standard input carries the key, so nothing can be confirmed.",
            );
        }
    }
    return options;
}
