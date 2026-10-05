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
description: "TypeScript Package Template"
tags:
  - repo
  - template
  - repository
  - typescript
  - npm
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.
Its source is TypeScript in `src/`, which Bun runs as it is, and it publishes
to npm as a compiled package.

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
- `bun test` runs `src/**/*.test.ts`. Bun runs TypeScript itself, so `tsc`
  only checks the types, with `bun run typecheck`.
- `bun run check` runs the checks CI runs: the typecheck, the build, the tests,
  Biome's format and lint checks, Markdown lint (remark, then markdownlint), the
  YAML checks (prettier, then yamllint with `@chewygumxx/yamllint-config`),
  tombi's TOML format and lint checks, ShellCheck and shfmt on the shell
  scripts, editorconfig-checker, actionlint on the workflows, the package checks
  (sort-package-json's key order, then publint and attw on the packed package),
  knip's check for unused dependencies and files, CSpell, secretlint and a check
  that rejects em dashes. Each tool runs by its shared `@chewygumxx`
  configuration; a word of this repository's own goes in `cspell.words` in
  `package.json`.
- `bun run format` applies Biome formatting, prettier's to YAML, tombi's to
  TOML, which Biome does not read, and shfmt's to the shell scripts.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs commitlint.

## Publishing

`bun run build` compiles `src/` to `dist/` with its declarations, and
`prepack` runs it, so a tarball always holds a fresh build.

To release, bump `version` in `package.json`, commit, and push a matching
`v*` tag. `.github/workflows/publish.yaml` runs the check, compares the tag
with `version`, then stages the version with `npm stage publish`, run with
Node fetched for that step: Bun cannot stage a publish. Approve it on
npmjs.com to publish it.

Before the first release, add a Trusted Publisher in the package's npm
settings that names this repository and the `publish.yaml` workflow with the
stage publish permission. No `NPM_TOKEN` secret exists or is needed.
