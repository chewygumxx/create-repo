// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/args.js
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
 * @property {string} [template]
 * @property {string[]} [features]
 * @property {string} [owner]
 * @property {"public" | "private"} visibility
 * @property {string} [dir]
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

// GitHub's rules for names, owners and topics; commitlint's for scopes.
const NAME = /^(?!\.{1,2}$)(?!.*\.(?:git|wiki)$)[A-Za-z0-9._-]{1,100}$/i;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const TOPIC = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,49}$/;
const SCOPE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,14}$/;

// A bundled template's name or feature; lib/templates.js has the list.
const TEMPLATE = /^[a-z][a-z0-9-]*$/;

/** A word that is the template's own, which init's guard cannot tell from a leftover. */
const TEMPLATE_WORD =
    /^(?:repo-tmpl|repo_tmpl|is_template|Using this template)$/;

/**
 * @param {string} value
 * @param {string} what
 * @param {string} [fix] what to do about it, when "choose another" is not it
 */
export function notTemplate(value, what, fix = "choose another") {
    if (TEMPLATE_WORD.test(value)) {
        throw new UsageError(
            `The ${what} "${value}" is the template's own, which init could not tell from a leftover: ${fix}.`,
        );
    }
    return value;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/**
 * @param {string} value
 * @param {string} what
 */
function noControl(value, what) {
    if (CONTROL.test(value)) {
        throw new UsageError(
            `The ${what} contains a control character (a tab included), which is not allowed.`,
        );
    }
    return value;
}

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
    return notTemplate(name, "repository name");
}

/**
 * Trims a description and refuses what would fail the first commit: nothing
 * at all, an em dash (the git hooks reject them), or a line break.
 * @param {string} text
 */
export function checkDescription(text) {
    const description = text.trim();
    if (!description) throw new UsageError("A description is required.");
    if (description.includes("\u2014")) {
        throw new UsageError(
            "The description contains an em dash, which the template's git hooks refuse.",
        );
    }
    if (/[\r\n]/.test(description)) {
        throw new UsageError("The description must be one line.");
    }
    noControl(description, "description");
    return notTemplate(description, "description");
}

/** @param {string} owner */
function checkOwner(owner) {
    if (!OWNER.test(owner)) {
        throw new UsageError(`Invalid owner "${owner}".`);
    }
    return notTemplate(owner, "owner");
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
        notTemplate(topic, "topic");
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
        notTemplate(name, "scope");
        const fullName =
            rest.join(":").trim() ||
            name.charAt(0).toUpperCase() + name.slice(1);
        noControl(fullName, "scope's full name");
        notTemplate(fullName, "scope's full name");
        return { name, fullName };
    });
}

/** @param {string} name */
function checkTemplateName(name) {
    if (!TEMPLATE.test(name)) {
        throw new UsageError(
            `Invalid template "${name}": name one bundled with this package; --help lists them.`,
        );
    }
    return name;
}

/** @param {string} text comma separated */
export function parseFeatures(text) {
    const features = [...new Set(list(text))];
    for (const feature of features) {
        if (!TEMPLATE.test(feature)) {
            throw new UsageError(
                `Invalid feature "${feature}": --help lists each template's.`,
            );
        }
    }
    return features;
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
                template: { type: "string" },
                with: { type: "string" },
                owner: { type: "string" },
                private: { type: "boolean", default: false },
                dir: { type: "string" },
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
        description:
            values.description === undefined
                ? undefined
                : checkDescription(values.description),
        topics:
            values.topics === undefined
                ? undefined
                : parseTopics(values.topics),
        scopes:
            values.scopes === undefined
                ? undefined
                : parseScopes(values.scopes),
        template:
            values.template === undefined
                ? undefined
                : checkTemplateName(values.template),
        features:
            values.with === undefined ? undefined : parseFeatures(values.with),
        owner:
            values.owner === undefined ? undefined : checkOwner(values.owner),
        visibility: values.private ? "private" : "public",
        dir: values.dir,
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
