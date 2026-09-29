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

1. Edit `.repo-metadata.jsonc` before anything else: `name`, `slug`,
   `description`, `topics`, and remove `is_template`. The CI workflow applies
   this file to the GitHub repository settings on every push to `main`, so any
   stale value here overwrites the new repository's settings.
2. Update the identity in `package.json` (`name`, `description`, `keywords`,
   `homepage`, `repository`) and in this README's frontmatter and body.
3. Register a GitHub App with repository permission "Administration: Read and
   write", install it on the new repository, and store its client ID as the
   `METADATA_APP_CLIENT_ID` variable and its private key as the
   `METADATA_APP_PRIVATE_KEY` secret. See the comment in
   [`sync-repo-metadata.yaml`](https://github.com/chewygumxx/.github/blob/main/.github/workflows/sync-repo-metadata.yaml).
   Until both are set, the metadata sync fails on every push to `main`; once
   they are, re-run the CI workflow by dispatch. A repository without the App
   passes `metadata-sync: false` to the standard workflow instead.
4. Add the new repository's commit scopes to `scopes.enum` in
   `.commitlintrc.mts`.
5. Install the toolchain and dependencies. This also wires the husky git hooks.

   ```sh
   mise install
   npm ci
   ```

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
