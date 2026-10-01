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
    cargoLock,
    cargoToml,
    commitlintScopes,
    committedScopes,
    headers,
    moduleName,
    packageJson,
    packageLock,
    readme,
    repoMetadata,
    vimdocTags,
    wranglerName,
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
        setup: [
            {
                file: "npm",
                args: ["ci", "--no-fund", "--no-audit", "--loglevel=error"],
            },
        ],
        format: { file: "npm", args: ["run", "--silent", "format"] },
        check: { file: "npm", args: ["run", "check"] },
    },
    native: {
        setup: [],
        format: { file: "mise", args: ["run", "format"] },
        check: { file: "mise", args: ["run", "check"] },
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
 * @property {string[]} [tools] system tools the template's checks need that
 *     mise does not install, each run as `<tool> --version` by the preflight
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

/**
 * Cargo refuses a package named for a keyword, or for `test`: `cargo new`
 * errors with "invalid package name" for a binary too, and crates.io would,
 * so a binary is refused as well as a library.
 */
const RUST_KEYWORDS = new Set([
    "abstract",
    "as",
    "async",
    "await",
    "become",
    "box",
    "break",
    "const",
    "continue",
    "crate",
    "do",
    "dyn",
    "else",
    "enum",
    "extern",
    "false",
    "final",
    "fn",
    "for",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "macro",
    "match",
    "mod",
    "move",
    "mut",
    "override",
    "priv",
    "pub",
    "ref",
    "return",
    "self",
    "Self",
    "static",
    "struct",
    "super",
    "test",
    "trait",
    "true",
    "try",
    "type",
    "typeof",
    "unsafe",
    "unsized",
    "use",
    "virtual",
    "where",
    "while",
    "yield",
]);

/**
 * Names Cargo accepts that still break a library's tests: `std` shadows the
 * standard library, and `gen` is a keyword from edition 2024.
 */
const RUST_LIB_NAMES = new Set(["gen", "std"]);

/** Names Cargo keeps for its build directory, which a binary would collide with. */
const CARGO_DIRS = new Set(["build", "deps", "examples", "incremental"]);

/**
 * Filenames Windows reserves, which Cargo warns "will not work on Windows
 * platforms" for a package of the same name (the target directory holds one).
 */
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * A crate's name is the repository's. Cargo takes letters, digits, `-` and
 * `_`, starting with a letter, up to 64 of them. A library's name is also a
 * Rust identifier, which the template's Clippy check (`-D warnings`) requires
 * to be snake case, so a library's is lowercase, with no two separators in a
 * row (`my--tool` becomes `my__tool`). GitHub allows more, so the name is
 * refused, not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function crateName({ name }, features) {
    if (WINDOWS_RESERVED.test(name)) {
        throw new UsageError(
            `The crate name "${name}" is not valid: Windows reserves it as a filename, and Cargo warns that the package will not work on Windows.`,
        );
    }
    const lib = features.has("lib");
    const rule = lib
        ? /^(?!.*[-_]{2})[a-z][a-z0-9_-]{0,63}$/
        : /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
    if (
        rule.test(name) &&
        !RUST_KEYWORDS.has(name) &&
        !(lib ? RUST_LIB_NAMES : CARGO_DIRS).has(name)
    ) {
        return;
    }
    throw new UsageError(
        `The crate name "${name}" is not valid: use 1 to 64 ${lib ? "lowercase letters" : "letters"}, digits, "-" and "_", starting with a letter${lib ? " (a library's name is a Rust identifier, which must be snake case, so no two separators in a row)" : ""}, and not a Rust keyword${lib ? ', "std" or "gen"' : " or one of Cargo's build directories"}.`,
    );
}

/**
 * The module a repository's name gives a plugin: the name without a `.nvim`
 * suffix or an `nvim-` prefix.
 * @param {string} name
 */
const nvimModule = (name) => name.replace(/^nvim-/, "").replace(/\.nvim$/, "");

/**
 * The template's own module name, in any case: init's leftover check is case
 * sensitive and cannot tell it from one, and a case-insensitive filesystem
 * would keep a directory named `repo_tmpl` for a module named `Repo_Tmpl`.
 */
const TEMPLATE_MODULE = /^repo[-_]tmpl$/i;

/**
 * A plugin's module is the directory under `lua/`, the file in `plugin/` and
 * `doc/`, and the string `require` takes: letters, digits, `-` and `_`, not
 * starting with a digit or `-`. GitHub allows more, so the name is refused,
 * not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function luaModuleName({ name }) {
    const lua = nvimModule(name);
    if (TEMPLATE_MODULE.test(lua)) {
        throw new UsageError(
            `The plugin's module "${lua}" is the template's own, which init could not tell from a leftover: choose another name.`,
        );
    }
    if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(lua)) return;
    throw new UsageError(
        `The plugin's module "${lua}" (the repository name without a ".nvim" suffix or an "nvim-" prefix) is not valid: use letters, digits, "-" and "_", starting with a letter or "_".`,
    );
}

/**
 * The words zsh reads as syntax (its `reswords`), which no function can be
 * named or which a function shadows, and the builtins the layer's own code
 * calls, which a function of the same name would replace: `exit` then turns a
 * failed assertion into a pass.
 */
const ZSH_RESERVED = new Set([
    "autoload",
    "case",
    "coproc",
    "declare",
    "do",
    "done",
    "elif",
    "else",
    "emulate",
    "end",
    "esac",
    "exit",
    "export",
    "fi",
    "float",
    "for",
    "foreach",
    "function",
    "if",
    "integer",
    "local",
    "nocorrect",
    "print",
    "readonly",
    "repeat",
    "return",
    "select",
    "source",
    "then",
    "time",
    "typeset",
    "unfunction",
    "unset",
    "until",
    "while",
]);

/**
 * Functions the test runner and the layer's tests define, which a plugin of
 * the same name would replace: `test_*` are the tests themselves, and so is
 * the unload function of a plugin named `test`, `test_plugin_unload`.
 */
const ZSH_RUNNER = new Set(["assert_equal", "on_fpath", "test"]);

/**
 * A plugin's name is its file, its autoloaded function and the start of its
 * unload function's: letters, digits, `-` and `_`, not leading with `-`, which
 * `autoload` reads as an option, and not a word the function cannot be named
 * (the tests fail, and `until` and `while` wait on the parser). GitHub allows
 * more, so the name is refused, not changed.
 * @type {NonNullable<Template["checkName"]>}
 */
function zshPluginName({ name }) {
    if (TEMPLATE_MODULE.test(name)) {
        throw new UsageError(
            `The plugin name "${name}" is the template's own, which init could not tell from a leftover: choose another.`,
        );
    }
    if (
        /^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name) &&
        !ZSH_RESERVED.has(name) &&
        !ZSH_RUNNER.has(name) &&
        !/^test_/.test(name)
    ) {
        return;
    }
    throw new UsageError(
        `The plugin name "${name}" is not valid: use letters, digits, "-" and "_", not starting with "-", and not a word zsh reads as syntax or a builtin the template calls, such as "if", "while", "local", "print" or "test_x".`,
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
    cloudflare: {
        description:
            "A Cloudflare Worker in TypeScript, tested in the Workers runtime, with a deploy workflow",
        family: "npm",
        features: {},
        layers: () => ["common", "npm", "cloudflare"],
        edits: [...NPM_EDITS, wranglerName],
        checkName: workerName,
    },
    rust: {
        description: "A Rust crate, binary or library, without npm",
        family: "native",
        features: { lib: "A library crate instead of a binary" },
        layers: (features) => [
            "common",
            "native",
            "rust",
            features.has("lib") ? "rust-lib" : "rust-bin",
        ],
        edits: [
            // First, so no later edit writes text it would then rewrite.
            moduleName((name) => name.replaceAll("-", "_")),
            headers,
            repoMetadata,
            readme,
            committedScopes,
            cargoToml,
            cargoLock,
        ],
        checkName: crateName,
    },
    nvim: {
        description:
            "A Neovim plugin in Lua, tested in headless Neovim with mini.test, without npm",
        family: "native",
        features: {},
        layers: () => ["common", "native", "nvim"],
        edits: [
            // First, so no later edit writes text it would then rewrite.
            // The tags are laid out before their token is renamed.
            vimdocTags(nvimModule),
            moduleName(nvimModule),
            headers,
            repoMetadata,
            readme,
            committedScopes,
        ],
        checkName: luaModuleName,
    },
    zsh: {
        description:
            "A zsh plugin, tested with zsh and linted with shuck, without npm",
        family: "native",
        features: {},
        tools: ["zsh"],
        layers: () => ["common", "native", "zsh"],
        edits: [
            // First, so no later edit writes text it would then rewrite.
            moduleName((name) => name),
            headers,
            repoMetadata,
            readme,
            committedScopes,
        ],
        checkName: zshPluginName,
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
