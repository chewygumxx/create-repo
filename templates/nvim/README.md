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
(luafmt, selene, lua-language-server, Biome, rumdl, yamlfmt, yamllint), tests
in headless Neovim (mini.test), GitHub automation (header and repository
metadata sync, Dependabot) and Claude Code settings and hooks, all without npm.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
npm create @chewygumxx/repo my-plugin.nvim -- --template nvim
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

The toolchain is pinned in `mise.toml` and `.config/mise/conf.d/nvim.toml`, and
`mise install` installs it, Neovim included, and wires the git hooks in
`.githooks/`.

- `mise run deps` clones mini.test, at the tag `.config/mise/conf.d/nvim.toml`
  pins, into `.tests/`; `mise run test:nvim` depends on it.
- `mise run check` runs the checks CI runs: luafmt's check and selene,
  lua-language-server with every warning a failure, the tests, Biome's format
  and lint checks, Markdown lint (rumdl), the YAML checks (yamlfmt, then
  yamllint) and a check that rejects em dashes.
- `mise run format` applies luafmt, Biome's formatting, and yamlfmt's to YAML,
  which Biome does not read.
- `mise run commitlint -- <revision>...` lints the commit messages the
  revisions name, as CI does: `origin/main..HEAD`, or `-1 HEAD`.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs committed, which holds each message to Conventional Commits with the types
and scopes in `committed.toml`.

## Layout

The module is named for the repository, without a `.nvim` suffix or an `nvim-`
prefix, so `my-plugin.nvim` and `nvim-my-plugin` both make `my-plugin`. Its name
is the directory under `lua/`, the file in `plugin/` and the help file in
`doc/`.

- `lua/`: the plugin. `init.lua` has `setup(opts)` and the example function,
  and `health.lua` what `:checkhealth` reports.
- `plugin/`: a load guard, so the plugin loads once, and the example user
  command `:Hello`. Rename it with the plugin.
- `doc/`: the help file. Run `:helptags doc` to use it from a checkout.
- `tests/`: mini.test's `test_*.lua` files, `minimal_init.lua`, which gives a
  run a runtimepath of only this plugin, Neovim's runtime and mini.test, and
  `run.lua`, which fails when it collects no test.
