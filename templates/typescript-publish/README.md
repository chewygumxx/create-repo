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
Its source is TypeScript in `src/`, which Node runs as it is, and it publishes
to npm as a compiled package.

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

## Publishing

`npm run build` compiles `src/` to `dist/` with its declarations, and
`prepack` runs it, so a tarball always holds a fresh build.

To release, bump `version` in `package.json` and `package-lock.json`, commit,
and push a matching `v*` tag. `.github/workflows/publish.yaml` runs the check,
compares the tag with `version`, then stages the version with
`npm stage publish`; approve it on npmjs.com to publish it.

Before the first release, add a Trusted Publisher in the package's npm
settings that names this repository and the `publish.yaml` workflow with the
stage publish permission. No `NPM_TOKEN` secret exists or is needed.
