---
ctime: 2026-09-29
mtime: 2026-11-21
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
provides Conventional Commits enforcement (commitlint, commitizen, hk's git
hooks), formatting and linting through mise and hk by the shared
`@chewygumxx` configurations, GitHub automation (header and repository
metadata sync, Dependabot) and agent instructions in `AGENTS.md`.

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
shell scripts, TOML and `.editorconfig`, and the metadata sync once the
`METADATA_APP_CLIENT_ID` variable is set. This repository's own
`bun run check`, which is `mise run check --all`, follows against the commit
the header sync pushed.

A repository created with `--no-metadata` has the sync switched off in
`ci.yaml`. To turn it on, set the `METADATA_APP_CLIENT_ID` variable and the
`METADATA_APP_PRIVATE_KEY` secret, then set `metadata-sync` back to
`${{ vars.METADATA_APP_CLIENT_ID != '' }}`.

## Development

`mise install` installs the tools, the packages, and hk's git hooks: the
pre-commit hook runs `mise run check --staged`, and the commit-msg hook
runs commitlint.

- `mise run commit` composes a commit interactively.
- `mise run test` passes until the first test exists; give it one.
- `mise run check` runs what CI runs: `lint` and `test`. `mise run lint` runs
  the steps of `@chewygumxx/hk-config` through hk, by `.config/hk.pkl`: the
  typecheck, Biome, Markdown lint (remark and markdownlint), the YAML checks
  (prettier and yamllint), tombi on TOML, ShellCheck and shfmt,
  editorconfig-checker, actionlint, knip, CSpell, secretlint, the header check
  and a check that rejects em dashes. Each tool runs by its shared `@chewygumxx`
  configuration; a word of this repository's own goes in the `words` of
  `.config/cspell.json`.
- `mise run format` applies the formatters.
- `mise run skills` relinks the agent skills the devDependencies provide,
  which every install also does. A Dependabot bump of a skill package
  fails CI until `mise run skills` has updated `skills-lock.json` on its
  branch.
- With no flag a task selects the changed files; `--staged` the staged
  files; `--all` every file. `mise tasks` lists every task.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
