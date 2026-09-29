#!/usr/bin/env node
// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/bin/create-repo.js
//
//

// @ts-check

// `npm create @chewygumxx/repo`: copies the template, runs its init script,
// checks and commits locally, and only then creates the GitHub repository,
// sets the metadata App variable and secret, and pushes. See the README.

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { formatScopes, parseOptions, UsageError } from "../lib/args.js";
import { childEnv, loadEnvFile, resolveKey } from "../lib/key.js";
import { checkTarget, checkTools } from "../lib/preflight.js";
import {
    completeAnswers,
    confirm,
    summary,
    terminalAsk,
} from "../lib/prompt.js";
import { CommandError, run } from "../lib/run.js";

const USAGE = `Usage: npm create @chewygumxx/repo -- [name] [flags]

  --description <text>           Repository description
  --topics <a,b>                 GitHub topics
  --scopes <name[:Full Name],…>  Commit scopes
  --owner <owner>                Default: the account gh is logged in as
  --private                      Default: public
  --dir <path>                   Default: ./<name>
  --template <owner/name>        Default: chewygumxx/repo-tmpl
  --env-file <path>              Default: ~/.config/chewygumxx/create-repo.env
  --metadata-key-file <path|->   The metadata App private key; - reads stdin
  --metadata-key-command <cmd>   Prints the key; or CREATE_REPO_METADATA_KEY_COMMAND
  --no-metadata                  Set neither the App variable nor its secret
  --dry-run                      Everything local; print the GitHub commands
  -y, --yes                      Do not ask for confirmation
  -h, --help                     Show this help

The key may also come from METADATA_APP_PRIVATE_KEY or
METADATA_APP_PRIVATE_KEY_FILE.`;

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
        console.log(USAGE);
        return 0;
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

    const { login, clientId } = await checkTools(options, tools);
    const key = options.metadata
        ? await resolveKey(options, env, {
              readStdin: () => text(process.stdin),
              readFile: (path) => readFileSync(path, "utf8"),
              runCommand: async (command) =>
                  (await run(command, [], { shell: true, capture: true, env }))
                      .stdout,
          })
        : undefined;

    const ask = options.metadataKeyFile === "-" ? undefined : terminalAsk();
    const owner = options.owner ?? login;
    if (!owner) {
        throw new UsageError(
            "Cannot tell the owner: pass --owner or log in with gh auth login.",
        );
    }
    const answers = await completeAnswers(options, { owner, ask });
    await checkTarget(answers, tools, { remote: login !== undefined });

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

    const { dir, template } = answers;
    const slug = `${answers.owner}/${answers.name}`;
    const local = { cwd: dir, env: children };

    try {
        step(`Copying ${template}`);
        await run(
            "git",
            [
                "clone",
                "--quiet",
                "--depth",
                "1",
                `https://github.com/${template}.git`,
                dir,
            ],
            { env: children },
        );
        rmSync(join(dir, ".git"), { recursive: true, force: true });
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
        await run("npm", ["ci", "--no-fund", "--no-audit"], local);

        step("Initialising");
        await run(
            "node",
            [
                "scripts/init.mjs",
                "--owner",
                answers.owner,
                "--name",
                answers.name,
                "--description",
                answers.description,
                "--topics",
                answers.topics.join(","),
                "--scopes",
                formatScopes(answers.scopes),
            ],
            local,
        );

        step("Checking and committing");
        await run("git", ["add", "--all"], local);
        await run("npm", ["run", "check"], local);
        await run(
            "git",
            [
                "commit",
                "--quiet",
                "--message",
                "chore: Initialise from template",
                "--message",
                `Generated from https://github.com/${template}.`,
            ],
            local,
        );
    } catch (error) {
        console.error(
            `\nStopped; nothing was created on GitHub. ${dir} is left for inspection.`,
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
        const id = clientId ?? `<METADATA_APP_CLIENT_ID of ${template}>`;
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
        } else if (error instanceof CommandError) {
            console.error(error.message);
            process.exitCode = 1;
        } else {
            throw error;
        }
    },
);
