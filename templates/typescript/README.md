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
description: "TypeScript Repository Template"
tags:
  - repo
  - template
  - repository
  - typescript
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.
Its source is TypeScript in `src/`, which Node runs as it is, with no build.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
npm create @chewygumxx/repo my-thing
```

## CI

`.github/workflows/ci.yaml` calls the shared
[standard workflow](https://github.com/chewygumxx/.github#standard-workflow):
commitlint, the header sync, generic lint and format checks for workflows,
shell and zsh scripts, TOML, YAML and `.editorconfig`, and the metadata sync.
This repository's own `npm run check` follows, against the commit the header
sync pushed.

## Development

- `npm run commit` composes a commit interactively.
- `npm test` runs `src/**/*.test.ts` with `node --test`. Node 24 strips the
  types itself, so `tsc` only typechecks, with `npm run typecheck`.
- `npm run check` runs the checks CI runs: the typecheck, the tests, Biome's
  format and lint checks, Markdown lint, the YAML checks (prettier, then
  yamllint with `@chewygumxx/yamllint-config`) and a check that rejects em
  dashes.
- `npm run format` applies Biome formatting, and prettier's to YAML, which Biome
  does not read.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs commitlint.
