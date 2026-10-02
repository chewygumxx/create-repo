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
provides Conventional Commits enforcement (committed), formatting and linting
(Biome, rumdl, tombi, yamlfmt, yamllint), GitHub automation (header and
repository metadata sync, Dependabot) and Claude Code settings and hooks, all
without Bun.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
bun create @chewygumxx/repo my-thing
```

## CI

`.github/workflows/ci.yaml` calls the shared
[standard workflow](https://github.com/chewygumxx/.github#standard-workflow):
the header sync, generic lint and format checks for workflows, shell and zsh
scripts, TOML and `.editorconfig`, and the metadata sync. Its own jobs follow:
`commitlint`, which lints the pushed or pull request commit messages with
committed, and `check`, which runs `mise run check` against the commit the
header sync pushed. Packages listed in `.github/apt-packages.txt`, one per
line, are installed first when the file exists.

## Development

The toolchain is pinned in `mise.toml`, and `mise install` installs it and
wires the git hooks in `.githooks/`.

- `mise run check` runs the checks CI runs: Biome's format and lint checks,
  Markdown lint (rumdl), the YAML checks (yamlfmt, then yamllint), tombi's TOML
  format and lint checks and a check that rejects em dashes.
- `mise run format` applies Biome formatting, yamlfmt's to YAML and tombi's to
  TOML, which Biome does not read.
- `mise run commitlint -- <revision>...` lints the commit messages the
  revisions name, as CI does: `origin/main..HEAD`, or `-1 HEAD`.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs committed, which holds each message to Conventional Commits with the types
and scopes in `committed.toml`.
