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
(shuck, Biome, rumdl, tombi, yamlfmt, yamllint), a plugin that follows the Zsh
Plugin Standard with its tests, GitHub automation (header and repository
metadata sync, Dependabot) and Claude Code settings and hooks, all without Bun.

## Using this template

This is the template bundled in
[`@chewygumxx/create-repo`](https://github.com/chewygumxx/create-repo).
Create a repository from it with:

```sh
bun create @chewygumxx/repo my-plugin --template zsh
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

zsh is a system package, which `mise install` does not provide: install it with
your package manager. The rest of the toolchain is pinned in `mise.toml` and
`.config/mise/conf.d/zsh.toml`, and `mise install` installs it, shuck included,
and wires the git hooks in `.githooks/`.

- `mise run check` runs the checks CI runs: `zsh -n` on each zsh file, shuck's
  lint and format check, the tests, Biome's format and lint checks, Markdown
  lint (rumdl), the YAML checks (yamlfmt, then yamllint), tombi's TOML format
  and lint checks and a check that rejects em dashes.
- `mise run test:zsh` runs the tests alone.
- `mise run format` applies shuck's formatting, Biome's, yamlfmt's to YAML and
  tombi's to TOML, which Biome does not read.
- `mise run commitlint -- <revision>...` lints the commit messages the
  revisions name, as CI does: `origin/main..HEAD`, or `-1 HEAD`.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs committed, which holds each message to Conventional Commits with the types
and scopes in `committed.toml`.

## Layout

The plugin is named for the repository, which names its plugin file, its
function and the test file.

- `<name>.plugin.zsh`: the plugin file, following the Zsh Plugin Standard. It
  puts `functions/` on `fpath` once, autoloads the function and defines
  `<name>_plugin_unload`, which undoes both.
- `functions/`: one autoloaded function per file. The example greets its
  arguments.
- `tests/`: `test_*.zsh` files, in any subdirectory, whose `test_*` functions
  `run.zsh` runs, each in a subshell of its own, after sourcing the plugin. It
  runs under `zsh -f`, so the machine's own configuration cannot change the
  result, and fails when it collects no test or cannot source a test file.
  `assert_equal` and `plugin_root` are available to the tests. A test passes
  or fails by the status of its last command, so use `assert_equal`, which
  ends the test on a mismatch, for a comparison.
- `.shuck.toml`: maps the scripts to the zsh dialect, which shuck would
  otherwise read as sh, and sets the format.
