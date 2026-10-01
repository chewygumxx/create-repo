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
description: "Cloudflare Worker Template"
tags:
  - repo
  - template
  - repository
  - cloudflare
  - workers
---

# repo-tmpl

This repository exists as a template for the creation of other repositories. It
provides Conventional Commits enforcement (commitlint, commitizen, husky),
formatting and linting (Biome, remark, TypeScript), GitHub automation (header
and repository metadata sync, Dependabot) and Claude Code settings and hooks.
It adds a Cloudflare Worker in TypeScript, tested in the Workers runtime and
deployed by a workflow once CI passes.

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
- `npm run dev` serves the Worker locally, and `npm run deploy` deploys it.
- `npm test` runs `test/` in the Workers runtime with Vitest and
  `@cloudflare/vitest-pool-workers`.
- `npm run types` regenerates `worker-configuration.d.ts` after a change to the
  bindings or vars in `wrangler.jsonc`; `npm run check` fails when it is stale.
- `npm run check` runs the checks CI runs: the typecheck, the types check, the
  tests, Biome's format and lint checks, Markdown lint, the YAML checks
  (prettier, then yamllint with `@chewygumxx/yamllint-config`) and a check
  that rejects em dashes.
  A Dependabot pull request that bumps only `wrangler` can fail that check
  until `npm run types` is run on its branch.
- `npm run format` applies Biome formatting, and prettier's to YAML, which Biome
  does not read.

The pre-commit hook runs the same checks on staged files. The commit-msg hook
runs commitlint.

## Deploying

`.github/workflows/deploy.yaml` deploys the Worker with `wrangler deploy` after
CI passes on `main`, and when run by hand. It stays skipped, which GitHub counts
as passing, until you set these in the repository's settings:

- the variable `CLOUDFLARE_ACCOUNT_ID`, your Cloudflare account ID
- the secret `CLOUDFLARE_API_TOKEN`, an API token that can edit Workers

`create-repo` sets neither.
