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
// of, its optional features, the identity edits init makes, and any rule
// its name must meet; and the commands that install, format and check every
// one of them.

import { UsageError } from "./args.js";
import {
    bunLock,
    commitlintScopes,
    headers,
    packageJson,
    readme,
    repoMetadata,
    wranglerName,
} from "./init.js";

/** @typedef {import("./init.js").Edit} Edit */
/** @typedef {{ file: string, args: string[] }} Command */

/**
 * How every template is installed, formatted and checked, once mise has
 * installed its toolchain.
 * @typedef {object} Steps
 * @property {Command[]} setup
 * @property {Command} format
 * @property {Command} check
 * @property {Command} words lists, one per line, the words a spell check of
 *     the tracked files, named on its stdin, does not know, without failing
 *     on them
 */

/**
 * The first install comes from `mise install`'s postinstall hook, which
 * also installs the git hooks, outside CI; under CI the hook skips both,
 * so setup installs from the lock, a no-op where the hook already did.
 * @type {Steps}
 */
export const STEPS = {
    setup: [{ file: "bun", args: ["install", "--frozen-lockfile"] }],
    format: { file: "mise", args: ["run", "format", "--all"] },
    check: { file: "mise", args: ["run", "check", "--all"] },
    words: {
        file: "bun",
        args: [
            "run",
            "cspell",
            "lint",
            "--file-list",
            "stdin",
            "--words-only",
            "--unique",
            "--no-progress",
            "--no-summary",
            "--no-must-find-files",
            "--no-exit-code",
        ],
    },
};

/**
 * @typedef {object} Template
 * @property {string} description one line, for --help and the prompt
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

/**
 * A Worker's name is the repository's, and a Worker's name is a lowercase DNS
 * label: 1 to 63 characters of letters, digits and hyphens, not starting or
 * ending with a hyphen. GitHub allows more, so the name is refused, not
 * changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function workerName({ name }) {
    if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) return;
    throw new UsageError(
        `The Worker name "${name}" is not valid: use 1 to 63 lowercase letters, digits and hyphens, not starting or ending with a hyphen.`,
    );
}

/** The identity edits every bun template makes. */
const BUN_EDITS = [
    headers,
    repoMetadata,
    packageJson,
    bunLock,
    readme,
    commitlintScopes,
];

/** @type {Record<string, Template>} */
export const TEMPLATES = {
    standard: {
        description:
            "Any repository: commit rules, lint and format checks through mise and hk, CI and agent instructions",
        features: {},
        layers: () => ["common", "bun"],
        edits: BUN_EDITS,
    },
    typescript: {
        description: "A Bun library or CLI in TypeScript, run without a build",
        features: {
            publish: "Publish to npm as @owner/name, compiled to dist/",
        },
        defaultFeatures: ["publish"],
        layers: (features) => [
            "common",
            "bun",
            "typescript",
            ...(features.has("publish") ? ["typescript-publish"] : []),
        ],
        edits: BUN_EDITS,
        checkOwner: publishedScope,
        checkName: publishedName,
    },
    cloudflare: {
        description:
            "A Cloudflare Worker in TypeScript, tested in the Workers runtime, with a deploy workflow",
        features: {},
        layers: () => ["common", "bun", "cloudflare"],
        edits: [...BUN_EDITS, wranglerName],
        checkName: workerName,
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
 * Refuses a feature that no template offers. The template may still be
 * chosen at a prompt, so this is all that can be known before it is.
 * @param {string[]} features
 * @param {Record<string, Template>} [templates]
 */
export function checkKnownFeatures(features, templates = TEMPLATES) {
    const offered = [
        ...new Set(
            Object.values(templates).flatMap((t) => Object.keys(t.features)),
        ),
    ];
    for (const feature of features) {
        if (offered.includes(feature)) continue;
        throw new UsageError(
            `No template has the feature "${feature}": choose from ${offered.join(", ")}.`,
        );
    }
}

/**
 * The template and its features, for the summary and the first commit:
 * `standard`, or `typescript, with publish`.
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
