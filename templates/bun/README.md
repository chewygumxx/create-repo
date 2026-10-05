---
ctime: 2026-09-29
mtime: 2026-10-05
spdx: GPL-3.0-only
title: repo-tmpl
description: "Repository Template"
tags:
  - repo
  - template
  - repository
---

<!--
   -
   - ~chewygumxx/repo-tmpl.git
   - ::: :/README.md
   -
   -->

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.

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
commitlint, the header sync, generic lint and format checks for workflows,
shell and zsh scripts, TOML, YAML and `.editorconfig`, and the metadata sync.
This repository's own `bun run check` follows, against the commit the header
sync pushed.

## Development

- `bun run commit` composes a commit interactively.
- `bun run check` runs the checks CI runs: the typecheck, Biome's format and
  lint checks, Markdown lint (remark, then markdownlint), the YAML checks
  (prettier with `@chewygumxx/prettier-config`, then yamllint with
  `@chewygumxx/yamllint-config`), tombi's TOML format and lint checks,
  ShellCheck and shfmt on the shell scripts, editorconfig-checker, actionlint on
  the workflows, sort-package-json's key order check, knip's check for unused
  dependencies and files, CSpell, secretlint and a check that rejects em dashes.
  Each tool runs by its shared `@chewygumxx` configuration; a word of this
  repository's own goes in `cspell.words` in `package.json`.
- `bun run format` applies Biome formatting, prettier's to YAML, tombi's to
  TOML, which Biome does not read, and shfmt's to the shell scripts.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs commitlint.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
