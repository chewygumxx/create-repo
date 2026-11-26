---
ctime: 2026-09-29
mtime: 2026-11-21
spdx: GPL-3.0-only
title: "@chewygumxx/create-repo"
description: >-
  Creates a GitHub repository from one of the templates bundled in this package,
  whose first CI run passes, including the repository metadata sync.
tags:
  - bun
  - create
  - template
  - github
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/README.md
   -
   -->

# @chewygumxx/create-repo

> Development and releases have moved to [shared-config][new-home].
> Use `bun create @chewygumxx/repo` to create a repository.

[new-home]: https://github.com/chewygumxx/shared-config/tree/main/packages/create-repo

Creates a GitHub repository from one of the templates bundled in this
package, whose first CI run passes, including the repository metadata sync.

```sh
bun create @chewygumxx/repo my-thing
```

It asks for anything not given as a flag, shows a summary, and on
confirmation copies the chosen template and runs `mise install` in it, which
installs the tools, the packages and the git hooks. It then rewrites the
template's identity, records the new repository's own words for the spell
check, runs `mise run format --all`, and commits once `mise run check --all`
passes. Only then does it create the repository, set the metadata App's
`METADATA_APP_CLIENT_ID` variable and `METADATA_APP_PRIVATE_KEY` secret, and
push. A failure before that leaves nothing on GitHub.

It needs Bun 1.4 or later, `git`, `mise`, and `gh` logged in with
`gh auth login`. It runs `mise trust` on the directory it creates.

Run with `npm create` instead, it still needs Bun: the CLI runs on it.

## The templates

| Template     | For                                                       |
| ------------ | --------------------------------------------------------- |
| `standard`   | Any repository: commit rules, lint and format checks      |
|              | through mise and hk, CI and agent instructions            |
| `typescript` | A Bun library or CLI in TypeScript, run without a build;  |
|              | `--with publish` compiles it and publishes it to npm as   |
|              | `@owner/name` by trusted publishing                       |
| `cloudflare` | A Cloudflare Worker in TypeScript, tested in the Workers  |
|              | runtime, with a workflow that deploys it                  |

## What a new repository holds

Every template sets a repository up as
[shared-config](https://github.com/chewygumxx/shared-config) and
[agentic-library](https://github.com/chewygumxx/agentic-library) are:

- **mise** is the switchboard. `.config/mise/config.toml` pins Bun, hk and
  the linters that are not npm packages, and its `postinstall` hook runs
  `bun ci && hk install --mise` outside CI. The tasks in
  `.config/mise/tasks/` extend the `cgxx:` templates of
  `@chewygumxx/mise-tasks-config`, linked as
  `.config/mise/conf.d/50-cgxx.toml`: `mise run check` runs `lint` and
  `test`, `mise run format` the formatters, and `mise run commit` composes a
  commit.
- **hk** runs the steps of `@chewygumxx/hk-config`, by `.config/hk.pkl`:
  `lint` and `format` are its `check` and `fix` hooks, and its git hooks run
  `mise run check --staged` before a commit and commitlint on its message.
  With no flag a task selects the changed files; `--staged` the staged
  files; `--all` every file.
- The configurations the steps read: the shared `@chewygumxx` packages,
  `.config/cspell.json`, `.config/prettierrc.json`, `.config/remarkrc.json`,
  `.config/tombi.toml`, `.biome.json`, `.markdownlint-cli2.jsonc`,
  `.secretlintrc.json` and `.knip.jsonc`.
- `package.json` holds no script but `check`, which is
  `mise run check --all`, and lifecycle scripts.
- CI calls the shared workflows of
  [chewygumxx/.github](https://github.com/chewygumxx/.github) at `v1`, then
  `bun run check`. Dependabot groups the `@chewygumxx` bumps.
- `AGENTS.md` holds the guidance for agents, and the
  `creating-bun-repositories` skill, an exact devDependency, explains
  the setup to them: the `skills` CLI links it into `.agents/skills/` and
  `.claude/skills/` on every install, and `skills-lock.json` records it.

`@chewygumxx/hk-config` and `@chewygumxx/mise-tasks-config` are pinned
exactly, as is Biome, which hk-config names: below 1.0.0, every functional
change to either is breaking. The other shared configurations take caret
ranges.

`--template` chooses one, `standard` by default, and `--with` turns on its
optional features; `--help` lists both. A package version always creates
the same repository, and the first commit names the version and template
that made it.

At the prompt, `typescript` takes `publish` unless the reply chooses other
features or `none`. `--with`, and a run without a terminal, choose only what
they name.

Each template is an ordered list of layers under `templates/`, declared in
`lib/templates.js`: a later layer's file replaces the same file from an
earlier one. `common` holds what every repository carries, `bun` the mise
and hk setup, `typescript` its sources, `typescript-publish` what
`--with publish` replaces and adds, and `cloudflare` the Worker. A layer
that holds a `package.json` holds its `bun.lock`; regenerate it with
`bun install --lockfile-only` in the layer's directory, and delete the
`node_modules` that leaves, if any.

The templates' identity stays `chewygumxx/repo-tmpl`:
`~chewygumxx/repo-tmpl.git` in every file header and the slug in
`.repo-metadata.jsonc` are what `lib/init.js` finds and rewrites for each
new repository. They look stale but are not, so `.gitattributes` keeps the
header sync out of `templates/`. After its edits, init fails if
`repo-tmpl`, or the identifier form `repo_tmpl`, remains anywhere.

A layer stores `.gitignore` as `_gitignore`, since npm drops nested
`.gitignore` files from the package, and it is renamed back on copy. The
last layer's applies to all of them. npm drops symlinks too, so a layer holds
only regular files, and the copy itself makes the
`.config/mise/conf.d/50-cgxx.toml` link.

## Development

This repository is set up as the templates' repositories are: `mise install`
installs the tools, the packages and hk's git hooks, and `mise run check`
runs what CI runs. Its hk steps add one of its own, `templates`, which
materialises every template and combination of features under `.templates/`
and checks each by its own Biome rules and `.editorconfig`.

The Create Repo workflow packs the package as npm would, runs `--dry-run`
from the tarball on every template and combination of features, then checks
a fresh clone of each commit it made as that repository's own CI would. It
catches a template drifting from `lib/init.js` or failing its own checks.

`mise run templates:materialize` writes every template as it is before init,
and `bun scripts/materialize.js <template> [--with <features>] <dir>` one.
`mise run act` runs CI locally with
[act](https://github.com/chewygumxx/.github#readme).

## Releasing

[Release Please](https://github.com/googleapis/release-please) keeps one
pull request open that bumps the version from the conventional commits since
the last release. Squash-merge it with its title as the subject and an empty
body; Release Please then publishes a `v<version>` GitHub release, and the
Publish workflow lints and dry-runs that commit and publishes it to npm by
trusted publishing, with provenance.

## Flags

```sh
bun create @chewygumxx/repo \
    my-thing \
    --template standard \
    --description "…" \
    --topics a,b \
    --scopes api,"cli:Command Line" \
    --yes
```

Run with `--help` for every flag. Without a terminal, the name and
`--description` are required, topics and scopes default to none, and `--yes`
is required. `--dry-run` does everything locally and prints the GitHub
commands instead of running them. `--no-metadata` skips the App variable and
secret, and switches the metadata sync off in the new repository's
`ci.yaml`.

## The metadata App private key

The client ID is read from the `chewygumxx/create-repo` repository's
variable. The private key comes from the first of:

1. `--metadata-key-file <path>`, or `-` for standard input
2. `METADATA_APP_PRIVATE_KEY`, the key itself
3. `METADATA_APP_PRIVATE_KEY_FILE`, a path
4. The output of `--metadata-key-command` or
   `CREATE_REPO_METADATA_KEY_COMMAND`, such as `pass show github/metadata-app`

Variables may be set in an env-file, `~/.config/chewygumxx/create-repo.env` by
default or `--env-file`. Setting the command there once is enough:

```sh
CREATE_REPO_METADATA_KEY_COMMAND="pass show github/metadata-app"
```

The key is only ever written to the standard input of `gh secret set`. It is
not printed or stored, and the variables above are removed from the
environment of every other command it runs, including `bun install`.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
