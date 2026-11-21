---
ctime: 2026-09-29
mtime: 2026-11-21
spdx: GPL-3.0-only
title: repo-tmpl
description: "Cloudflare Worker Template"
tags:
  - repo
  - template
  - repository
  - cloudflare
  - workers
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
It adds a Cloudflare Worker in TypeScript, tested in the Workers runtime and
deployed by a workflow once CI passes.

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
- `mise run dev` serves the Worker locally, and `mise run deploy` deploys it.
- `mise run test` runs `test/` in the Workers runtime with Vitest and
  `@cloudflare/vitest-plugin`.
- `mise run types` regenerates `worker-configuration.d.ts` after a change to
  the bindings or vars in `wrangler.jsonc`; `mise run lint` fails while it is
  stale. A Dependabot pull request that bumps only `wrangler` can fail that
  check until `mise run types` is run on its branch.
- `mise run check` runs what CI runs: `lint` and `test`. `mise run lint` runs
  the steps of `@chewygumxx/hk-config` through hk, by `.config/hk.pkl`: the
  typecheck, Biome, Markdown lint (remark and markdownlint), the YAML checks
  (prettier and yamllint), tombi on TOML, ShellCheck and shfmt,
  editorconfig-checker, actionlint, knip, CSpell, secretlint, the header check
  and a check that rejects em dashes, and the Worker types check. Each tool runs
  by its shared `@chewygumxx` configuration; a word of this repository's own
  goes in the `words` of `.config/cspell.json`.
- `mise run format` applies the formatters.
- With no flag a task selects the changed files; `--staged` the staged
  files; `--all` every file. `mise tasks` lists every task.

## Deploying

`.github/workflows/deploy.yaml` deploys the Worker with `wrangler deploy` after
CI passes on `main`, and when run by hand. It stays skipped, which GitHub counts
as passing, until you set these in the repository's settings:

- the variable `CLOUDFLARE_ACCOUNT_ID`, your Cloudflare account ID
- the secret `CLOUDFLARE_API_TOKEN`, an API token that can edit Workers

`create-repo` sets neither.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
