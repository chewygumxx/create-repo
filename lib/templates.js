// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/lib/templates.js
//
//

// @ts-check

// The templates this package bundles: for each, the layers it is composed
// of, its optional features, the family that installs, formats and checks
// it, the identity edits init makes, and any rule its name must meet.

import { UsageError } from "./args.js";
import {
    commitlintScopes,
    headers,
    packageJson,
    packageLock,
    readme,
    repoMetadata,
} from "./init.js";

/** @typedef {import("./init.js").Edit} Edit */
/** @typedef {{ file: string, args: string[] }} Command */

/**
 * How a family's templates are installed, formatted and checked, once mise
 * has installed their toolchain.
 * @typedef {object} Family
 * @property {Command[]} setup
 * @property {Command} format
 * @property {Command} check
 */

/** @type {Record<string, Family>} */
export const FAMILIES = {
    npm: {
        setup: [{ file: "npm", args: ["ci", "--no-fund", "--no-audit"] }],
        format: { file: "npm", args: ["run", "--silent", "format"] },
        check: { file: "npm", args: ["run", "check"] },
    },
};

/**
 * @typedef {object} Template
 * @property {string} description one line, for --help and the prompt
 * @property {string} family a key of FAMILIES
 * @property {Record<string, string>} features each optional feature's name
 *     and one-line description
 * @property {string[]} [defaultFeatures] the features an empty reply to the
 *     features prompt takes; the flags and a missing terminal choose none
 * @property {(features: ReadonlySet<string>) => string[]} layers
 * @property {Edit[]} edits
 * @property {(owner: string, features: ReadonlySet<string>) => void} [checkOwner]
 *     throws UsageError when the template cannot use the owner with the
 *     features; the owner cannot be re-entered, so a prompt asks for the
 *     features again
 * @property {(identity: { owner: string, name: string }, features: ReadonlySet<string>) => void} [checkName]
 *     throws UsageError when the template cannot use the name
 */

export const DEFAULT_TEMPLATE = "standard";

/**
 * The owner names the npm scope of a published package, which must be
 * lowercase. It comes from --owner or the gh login, so the message says so.
 * @type {NonNullable<Template["checkOwner"]>}
 */
function publishedScope(owner, features) {
    if (!features.has("publish") || owner === owner.toLowerCase()) return;
    throw new UsageError(
        `The owner "${owner}" (--owner, or your gh login) names the npm scope, which must be lowercase: pass --owner in lowercase, or choose no publish.`,
    );
}

/**
 * A published package's name is lowercase and does not start with `.` or
 * `_`. GitHub allows more, so the name is refused, not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function publishedName({ owner, name }, features) {
    if (!features.has("publish") || /^[a-z0-9-][a-z0-9._-]*$/.test(name)) {
        return;
    }
    throw new UsageError(
        `The published package @${owner}/${name} is not a valid npm name: the name must be lowercase, and must not start with "." or "_".`,
    );
}

/** The identity edits every npm template makes. */
const NPM_EDITS = [
    headers,
    repoMetadata,
    packageJson,
    packageLock,
    readme,
    commitlintScopes,
];

/** @type {Record<string, Template>} */
export const TEMPLATES = {
    standard: {
        description:
            "Any repository: commit rules, lint and format checks, CI and Claude Code settings",
        family: "npm",
        features: {},
        layers: () => ["common", "npm"],
        edits: NPM_EDITS,
    },
    typescript: {
        description: "A Node library or CLI in TypeScript, run without a build",
        family: "npm",
        features: {
            publish: "Publish to npm as @owner/name, compiled to dist/",
        },
        defaultFeatures: ["publish"],
        layers: (features) => [
            "common",
            "npm",
            "typescript",
            ...(features.has("publish") ? ["typescript-publish"] : []),
        ],
        edits: NPM_EDITS,
        checkOwner: publishedScope,
        checkName: publishedName,
    },
};

/**
 * @param {string} name
 * @param {Record<string, Template>} [templates]
 */
export function getTemplate(name, templates = TEMPLATES) {
    if (!Object.hasOwn(templates, name)) {
        throw new UsageError(
            `Unknown template "${name}": choose one of ${Object.keys(templates).join(", ")}.`,
        );
    }
    return templates[name];
}

/**
 * Checks features against the template's, returning them in its order
 * without duplicates.
 * @param {string} name the template's
 * @param {Template} template
 * @param {string[]} features
 */
export function checkFeatures(name, template, features) {
    const known = Object.keys(template.features);
    for (const feature of features) {
        if (known.includes(feature)) continue;
        throw new UsageError(
            known.length
                ? `The ${name} template has no feature "${feature}": choose from ${known.join(", ")}.`
                : `The ${name} template has no features; leave out --with.`,
        );
    }
    return known.filter((feature) => features.includes(feature));
}

/**
 * The template and its features, for the summary and the first commit:
 * `standard`, or `rust, with lib`.
 * @param {string} name
 * @param {string[]} features
 */
export function label(name, features) {
    return features.length ? `${name}, with ${features.join(", ")}` : name;
}

/**
 * Every template with every combination of its features.
 * @param {Record<string, Template>} [templates]
 * @returns {{ template: string, features: string[] }[]}
 */
export function combinations(templates = TEMPLATES) {
    return Object.entries(templates).flatMap(([template, { features }]) => {
        /** @type {string[][]} */
        const subsets = [[]];
        for (const feature of Object.keys(features)) {
            for (const subset of [...subsets])
                subsets.push([...subset, feature]);
        }
        return subsets.map((chosen) => ({ template, features: chosen }));
    });
}
