---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/repo-tmpl.git
  # ::: :/README.md
  #
  #

ctime: 2026-09-29
title: repo-tmpl
description: "Repository Template"
tags:
  - repo
  - template
  - repository
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.

## Using this template

Create a repository from this template with
[`npm create @chewygumxx/repo`](https://github.com/chewygumxx/shared-config/tree/main/packages/create-repo):

```sh
npm create @chewygumxx/repo my-thing
```

It asks for the description, topics and commit scopes, then creates the
GitHub repository, sets its metadata App variable and secret, and pushes a
first commit whose CI passes. Its README lists the flags and where it reads
the App's private key.

To do the same by hand:

1. Copy the template without its history, and install the toolchain and
   dependencies. This also wires the husky git hooks.

   ```sh
   git clone --depth 1 https://github.com/chewygumxx/repo-tmpl.git my-thing
   cd my-thing && rm -rf .git && git init -b main
   mise install
   npm ci
   ```

2. Rewrite the identity in `.repo-metadata.jsonc`, `package.json`, the
   lockfile, this README and `.commitlintrc.mts`. The script deletes itself
   and the template's own test workflow.

   ```sh
   node scripts/init.mjs --owner <owner> --name my-thing \
       --description "…" --topics a,b --scopes api,"cli:Command Line"
   ```

3. Commit, then create the repository without pushing.

   ```sh
   git add --all && npm run check
   git commit -m "chore: Initialise from template"
   gh repo create <owner>/my-thing --public --description "…" \
       --source . --remote origin
   ```

4. Store the metadata GitHub App's client ID as the `METADATA_APP_CLIENT_ID`
   variable and its private key as the `METADATA_APP_PRIVATE_KEY` secret. The
   App needs repository permission "Administration: Read and write" and must
   be installed on the repository; see the comment in
   [`sync-repo-metadata.yaml`](https://github.com/chewygumxx/.github/blob/main/.github/workflows/sync-repo-metadata.yaml).
   A repository without the App passes `metadata-sync: false` to the standard
   workflow instead.

5. Push: `git push -u origin main`. The first CI run applies
   `.repo-metadata.jsonc` to the repository settings.

File headers (`~owner/repo.git` and the `::: :/path` line) are kept current by
the header sync in CI and do not need editing by hand.

## CI

`.github/workflows/ci.yaml` calls the shared
[standard workflow](https://github.com/chewygumxx/.github#standard-workflow):
commitlint, the header sync, generic lint and format checks for workflows,
shell and zsh scripts, TOML, YAML and `.editorconfig`, and the metadata sync.
This repository's own `npm run check` follows, against the commit the header
sync pushed.

## Development

- `npm run commit` composes a commit interactively.
- `npm run check` runs the typecheck, format check, lint, Markdown lint and YAML
  checks (prettier, then yamllint with `@chewygumxx/yamllint-config`) that CI
  runs.
- `npm run format` applies Biome formatting, and prettier's to YAML, which Biome
  does not read.

The pre-commit hook runs the same checks on staged files, and rejects em dashes.
The commit-msg hook runs commitlint.
