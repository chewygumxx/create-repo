// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/scripts/materialize.js
//
//

// @ts-check

// Writes templates as they are before init, for checks of the templates
// themselves:
//
//   node scripts/materialize.js <template> [--with <features>] <dir>
//   node scripts/materialize.js --all <root>
//       every combination, each in <root>/<template>[+<feature>...]
//   node scripts/materialize.js --list
//       every combination, as a GitHub Actions matrix

import {
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseFeatures, UsageError } from "../lib/args.js";
import { copyTemplate, TemplateError } from "../lib/template.js";
import { checkFeatures, combinations, getTemplate } from "../lib/templates.js";

const USAGE =
    "Usage: node scripts/materialize.js <template> [--with <features>] <dir> | --all <root> | --list";

/** Marks a directory as this script's own output, safe to clear. */
const MARKER = ".materialized";

/**
 * Empties `root` for a new run, but only if it is absent, empty, or an
 * earlier run's output: a mistyped `--all` must not delete a real directory.
 * @param {string} root
 */
function clear(root) {
    if (existsSync(root)) {
        if (!statSync(root).isDirectory()) {
            throw new UsageError(`${root} is not a directory.`);
        }
        if (readdirSync(root).length && !existsSync(join(root, MARKER))) {
            throw new UsageError(
                `${root} is not empty and was not made by this script; refusing to clear it.`,
            );
        }
        rmSync(root, { recursive: true });
    }
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, MARKER), "");
}

/**
 * @param {string} template
 * @param {string[]} features
 */
const nameOf = (template, features) => [template, ...features].join("+");

/**
 * @param {string} dir
 * @param {string} name
 * @param {string[]} features
 */
function materialize(dir, name, features) {
    const template = getTemplate(name);
    const chosen = checkFeatures(name, template, features);
    copyTemplate(dir, template.layers(new Set(chosen)));
}

/** @param {string[]} argv */
function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                with: { type: "string" },
                all: { type: "string" },
                list: { type: "boolean", default: false },
            },
        });
    } catch (error) {
        throw new UsageError(
            error instanceof Error ? error.message : String(error),
        );
    }
    const { values, positionals } = parsed;
    if (values.list) {
        const include = combinations().map(({ template, features }) => ({
            template,
            with: features.join(","),
            name: nameOf(template, features),
        }));
        console.log(JSON.stringify({ include }));
    } else if (values.all !== undefined) {
        if (positionals.length || values.with !== undefined) {
            throw new UsageError(USAGE);
        }
        clear(values.all);
        for (const { template, features } of combinations()) {
            materialize(
                join(values.all, nameOf(template, features)),
                template,
                features,
            );
        }
    } else if (positionals.length === 2) {
        const [template, dir] = positionals;
        materialize(
            dir,
            template,
            values.with === undefined ? [] : parseFeatures(values.with),
        );
    } else {
        throw new UsageError(USAGE);
    }
}

try {
    main(process.argv.slice(2));
} catch (error) {
    if (error instanceof UsageError) {
        console.error(error.message);
        process.exitCode = 2;
    } else if (error instanceof TemplateError) {
        console.error(error.message);
        process.exitCode = 1;
    } else {
        throw error;
    }
}
