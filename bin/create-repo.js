#!/usr/bin/env node
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/bin/create-repo.js
//
//

// @ts-check

// `npm create @chewygumxx/repo`: copies the chosen template, rewrites its
// identity, checks and commits locally, and only then creates the GitHub
// repository, sets the metadata App variable and secret, and pushes. See the
// README.

import { existsSync, readFileSync } from "node:fs";
import { text } from "node:stream/consumers";
import { notTemplate, parseOptions, UsageError } from "../lib/args.js";
import { init } from "../lib/init.js";
import { childEnv, loadEnvFile, resolveKey } from "../lib/key.js";
import {
    checkTarget,
    checkTemplateTools,
    checkTools,
    METADATA_REPO,
} from "../lib/preflight.js";
import {
    completeAnswers,
    confirm,
    summary,
    terminalAsk,
} from "../lib/prompt.js";
import { CommandError, run } from "../lib/run.js";
import {
    copyTemplate,
    TargetExistsError,
    TemplateError,
    VERSION,
} from "../lib/template.js";
import {
    checkFeatures,
    checkKnownFeatures,
    DEFAULT_TEMPLATE,
    FAMILIES,
    getTemplate,
    label,
    TEMPLATES,
} from "../lib/templates.js";

const USAGE = `Usage: npm create @chewygumxx/repo -- [name] [flags]

  --description <text>           Repository description
  --topics <a,b>                 GitHub topics
  --scopes <name[:Full Name],…>  Commit scopes
  --template <name>              Default: standard; listed below
  --with <feature,…>             The template's optional features
  --owner <owner>                Default: the account gh is logged in as
  --private                      Default: public
  --dir <path>                   Default: ./<name>
  --env-file <path>              Default: ~/.config/chewygumxx/create-repo.env
  --metadata-key-file <path|->   The metadata App private key; - reads stdin
  --metadata-key-command <cmd>   Prints the key; or CREATE_REPO_METADATA_KEY_COMMAND
  --no-metadata                  Set neither the App variable nor its secret
  --dry-run                      Everything local; print the GitHub commands
  -y, --yes                      Do not ask for confirmation
  -h, --help                     Show this help

The key may also come from METADATA_APP_PRIVATE_KEY or
METADATA_APP_PRIVATE_KEY_FILE.`;

/** USAGE, then each template and its features. */
function usage() {
    const names = Object.keys(TEMPLATES);
    const width = Math.max(...names.map((name) => name.length));
    const rows = Object.entries(TEMPLATES).flatMap(([name, template]) => [
        `  ${name.padEnd(width)}  ${template.description}`,
        ...Object.entries(template.features).map(
            ([feature, description]) =>
                `  ${"".padEnd(width)}  --with ${feature}: ${description}`,
        ),
    ]);
    return `${USAGE}\n\nTemplates:\n${rows.join("\n")}`;
}

/** @param {string} message */
function step(message) {
    console.error(`\n==> ${message}`);
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
async function main(argv) {
    const options = parseOptions(argv);
    if (options.help) {
        console.log(usage());
        return 0;
    }
    const ask = options.metadataKeyFile === "-" ? undefined : terminalAsk();
    // The template and features, once the flags settle them, for what the
    // template refuses of an owner that only gh can name.
    /** @type {{ template: import("../lib/templates.js").Template, chosen: Set<string> } | undefined} */
    let settled;
    // Needs neither gh nor the network, so it comes before the preflight.
    if (options.template !== undefined) {
        const template = getTemplate(options.template);
        if (options.features !== undefined) {
            checkFeatures(options.template, template, options.features);
        }
        // What the template refuses of a name or owner given as flags: the
        // features are known when given, or when none can be asked for.
        const features =
            options.features ??
            (ask && Object.keys(template.features).length ? undefined : []);
        if (features) {
            const chosen = new Set(features);
            settled = { template, chosen };
            if (options.owner !== undefined) {
                template.checkOwner?.(options.owner, chosen);
            }
            if (options.name !== undefined) {
                template.checkName?.(
                    { owner: options.owner ?? "owner", name: options.name },
                    chosen,
                );
            }
        }
    } else if (options.features !== undefined) {
        // Without a terminal the template is the default; with one it is
        // chosen later, so only a feature no template has can be refused now.
        if (ask) checkKnownFeatures(options.features);
        else {
            checkFeatures(
                DEFAULT_TEMPLATE,
                getTemplate(DEFAULT_TEMPLATE),
                options.features,
            );
        }
    }

    const env = { ...process.env };
    loadEnvFile(env, options.envFile);
    const children = childEnv(env);
    // Preflight's children get the filtered environment too, env-file
    // included, so gh checks as the same identity that later creates.
    const tools = {
        run: (
            /** @type {string} */ file,
            /** @type {string[]} */ args,
            /** @type {import("../lib/run.js").RunOptions} */ options = {},
        ) => run(file, args, { env: children, ...options }),
        exists: existsSync,
    };

    if (options.template !== undefined) {
        await checkTemplateTools({ template: options.template }, tools);
    }
    const { login, clientId } = await checkTools(options, tools);
    const owner = options.owner ?? login;
    if (!owner) {
        throw new UsageError(
            "Cannot tell the owner: pass --owner or log in with gh auth login.",
        );
    }
    // A flag is checked as parsed; the login is not.
    if (options.owner === undefined) {
        notTemplate(owner, "owner", "pass another with --owner");
        settled?.template.checkOwner?.(owner, settled.chosen);
    }
    const key = options.metadata
        ? await resolveKey(options, env, {
              readStdin: () => text(process.stdin),
              readFile: (path) => readFileSync(path, "utf8"),
              runCommand: async (command) =>
                  (await run(command, [], { shell: true, capture: true, env }))
                      .stdout,
          })
        : undefined;

    const answers = await completeAnswers(options, { owner, ask });
    await checkTarget(answers, tools, { remote: login !== undefined });
    await checkTemplateTools(answers, tools);

    console.error(
        `\n${summary(answers, { dryRun: options.dryRun, keySource: key?.source })}\n`,
    );
    if (!options.yes) {
        if (!ask) {
            throw new UsageError(
                "Pass --yes to go ahead without confirmation when not running in a terminal.",
            );
        }
        if (!(await confirm(ask))) {
            console.error("Cancelled; nothing was created.");
            return 0;
        }
    }

    const { dir } = answers;
    const template = TEMPLATES[answers.template];
    const family = FAMILIES[template.family];
    const chosen = label(answers.template, answers.features);
    const slug = `${answers.owner}/${answers.name}`;
    const local = { cwd: dir, env: children };

    try {
        step(`Copying the ${chosen} template`);
        const files = copyTemplate(
            dir,
            template.layers(new Set(answers.features)),
        );
        await run(
            "git",
            ["init", "--quiet", "--initial-branch", "main"],
            local,
        );

        step("Installing the toolchain and dependencies");
        await run("mise", ["trust", "--quiet"], local);
        await run("mise", ["install"], local);
        // The template's pinned tools, yamllint and node included, for every
        // later step and its git hooks; the caller's PATH may lack them.
        const pinned = await run("mise", ["env", "--json"], {
            ...local,
            capture: true,
        });
        local.env = childEnv({ ...children, ...JSON.parse(pinned.stdout) });
        for (const command of family.setup) {
            await run(command.file, command.args, local);
        }

        step("Initialising");
        init(dir, answers, files, {
            edits: template.edits,
            features: answers.features,
        });
        // Staged first: the template's format:yaml reads `git ls-files`.
        await run("git", ["add", "--all"], local);
        await run(family.format.file, family.format.args, local);

        step("Checking and committing");
        await run("git", ["add", "--all"], local);
        await run(family.check.file, family.check.args, local);
        await run(
            "git",
            [
                "commit",
                "--quiet",
                "--message",
                "chore: Initialise from template",
                "--message",
                `Generated by @chewygumxx/create-repo ${VERSION} (${chosen}).`,
            ],
            local,
        );
    } catch (error) {
        console.error(
            // A directory that appeared after checkTarget is not this run's.
            !(error instanceof TargetExistsError) && existsSync(dir)
                ? `\nStopped; nothing was created on GitHub. ${dir} is left for inspection.`
                : "\nStopped; nothing was created.",
        );
        throw error;
    }

    /** @type {{ show: string, file: string, args: string[], input?: string }[]} */
    const remote = [
        {
            show: `gh repo create ${slug} --${answers.visibility} --description ${JSON.stringify(answers.description)} --source ${dir} --remote origin`,
            file: "gh",
            args: [
                "repo",
                "create",
                slug,
                `--${answers.visibility}`,
                "--description",
                answers.description,
                "--source",
                dir,
                "--remote",
                "origin",
            ],
        },
    ];
    if (key) {
        const id = clientId ?? `<METADATA_APP_CLIENT_ID of ${METADATA_REPO}>`;
        remote.push(
            {
                show: `gh variable set METADATA_APP_CLIENT_ID --repo ${slug} --body ${id}`,
                file: "gh",
                args: [
                    "variable",
                    "set",
                    "METADATA_APP_CLIENT_ID",
                    "--repo",
                    slug,
                    "--body",
                    id,
                ],
            },
            {
                show: `gh secret set METADATA_APP_PRIVATE_KEY --repo ${slug} < (the key from ${key.source})`,
                file: "gh",
                args: [
                    "secret",
                    "set",
                    "METADATA_APP_PRIVATE_KEY",
                    "--repo",
                    slug,
                ],
                input: key.key,
            },
        );
    }
    remote.push({
        show: `git -C ${dir} push --set-upstream origin main`,
        file: "git",
        args: [
            "-C",
            dir,
            "push",
            "--quiet",
            "--set-upstream",
            "origin",
            "main",
        ],
    });

    if (options.dryRun) {
        step("Dry run; these would create the repository:");
        for (const command of remote) console.log(command.show);
        return 0;
    }

    step(`Creating ${slug}`);
    for (const [index, command] of remote.entries()) {
        try {
            await run(command.file, command.args, {
                env: children,
                input: command.input,
                capture: command.input !== undefined,
            });
        } catch (error) {
            console.error(
                index === 0
                    ? `\nCould not create ${slug}; ${dir} holds the committed repository. Retry with:\n  ${command.show}`
                    : `\n${slug} exists on GitHub, but setup stopped. Finish with:\n${remote
                          .slice(index)
                          .map((rest) => `  ${rest.show}`)
                          .join(
                              "\n",
                          )}\nor remove it with:\n  gh repo delete ${slug} --yes`,
            );
            throw error;
        }
    }

    console.error(
        `\nCreated https://github.com/${slug}\nIts first CI run: https://github.com/${slug}/actions`,
    );
    return 0;
}

main(process.argv.slice(2)).then(
    (code) => {
        process.exitCode = code;
    },
    (error) => {
        if (error instanceof UsageError) {
            console.error(error.message);
            process.exitCode = 2;
        } else if (
            error instanceof CommandError ||
            error instanceof TemplateError
        ) {
            console.error(error.message);
            process.exitCode = 1;
        } else {
            throw error;
        }
    },
);
