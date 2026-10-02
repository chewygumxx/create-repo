---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/create-repo.git
  # ::: :/docs/specs/2026-10-02-bun-design.md
  #
  #

ctime: 2026-10-02
title: >-
  Specification: Bun
description: ""
tags: []
---

# Specification: Bun

Bun replaces npm as the package manager and Node as the runtime, in
`create-repo` itself, in the templates of the npm family (renamed the bun
family), and in the shared workflows of `chewygumxx/.github` that run a
caller's package scripts. npm stays for one thing only: publishing, which
Bun cannot stage.

Released as 3.0.0: the CLI needs Bun, and is invoked as
`bun create @chewygumxx/repo`.

## Decisions

- **Bun is the runtime, not only the package manager.** Most CLIs a
  repository runs (tsc's wrapper, prettier, remark, commitlint) carry a
  `#!/usr/bin/env node` shebang, which plain `bun run` honours, starting
  whatever Node is on `PATH`; GitHub's runners always have one. Every bun
  family repository, and this one, carries a `bunfig.toml` with
  `[run] bun = true`, under which `bun run` puts a `node` that is Bun first
  on `PATH`, nested `bun run` calls included.
- **Node stays only where npm must.** `bun publish` stages nothing and has
  no trusted publishing or provenance, so publishing stays
  `npm stage publish`. A published template's workflow fetches Node for that
  step alone with `mise exec node@24 --`. This repository keeps
  `node = "24"` in `mise.toml`, documented as npm's: `test/pack.test.js`
  checks what `npm pack` would publish, and `bun pm pack` lists a different
  set of files.
- **The lock is `bun.lock`**, Bun's text lock, replacing every
  `package-lock.json`. Regenerate one with `bun install --lockfile-only`.
  Bun runs no dependency's install scripts unless it is trusted; nothing in
  the bun family needs one (the cloudflare template's workerd and esbuild
  install without theirs).
- **Tests.** This repository's suite stays on `node:test`, run by
  `bun test`, which runs it unchanged. The typescript template's example
  test uses `bun:test`, the face of a Bun project.
- **The shared workflows choose by lockfile**, so the repositories still on
  npm keep working on `v1` and can migrate one at a time.

## Toolchain

In every bun family `mise.toml`, `bun = "1.4"` replaces `node = "24"`.
`package.json` declares `"engines": { "bun": ">=1.4" }`; `@types/bun`, which
includes Node's types, replaces `@types/node`, and each `tsconfig.json`'s
`types` follows.

## The CLI

- `bin/create-repo.js` runs under `#!/usr/bin/env bun`. The README, usage
  and package description lead with `bun create @chewygumxx/repo`.
- The preflight requires `git`, `mise` and `bun`.
- `FAMILIES.npm` becomes `FAMILIES.bun`:

  | Setup                           | Format                    | Check           |
  | ------------------------------- | ------------------------- | --------------- |
  | `bun install --frozen-lockfile` | `bun run --silent format` | `bun run check` |

  Each bun family template's `family` is `"bun"`.

- The `packageLock` edit becomes `bunLock`: it sets `workspaces[""].name` in
  `bun.lock` through `jsonc-parser`, since the lock has trailing commas. The
  root `name` and `packages[""].name` of a `package-lock.json` have no
  counterpart. `init` still fails when `repo-tmpl` or `repo_tmpl` remains.
- Scripts call `bun run` and `bun test`; husky's hooks call
  `bunx --no-install`; `.claude/hooks/install-deps.sh` runs
  `bun install --frozen-lockfile` when `bun` is on `PATH`.
- `test/bin.test.js`'s logging stand-ins are for bun in place of npm.

## Templates

- `templates/npm` becomes `templates/bun`. Every bun family layer holding a
  `package.json` holds a `bun.lock`; the `bun` layer adds `bunfig.toml`.
- **typescript.** `bun test` runs `src/**/*.test.ts`; Bun runs TypeScript
  itself, so `tsc` only typechecks. The README no longer explains Node's type
  stripping.
- **typescript-publish.** `tsc` still compiles `src/` to `dist/` with its
  declarations, from `prepack: bun run build`. The publish workflow installs
  with Bun, then runs `mise exec node@24 -- npm stage publish`.
- **cloudflare.** Vitest runs under Bun, with the Workers pool; the deploy
  workflow installs with Bun and runs `bunx wrangler deploy`.
- **native, rust, nvim, zsh.** Only their prose changes: "without npm"
  becomes "without Bun".

## CI and Dependabot

- This repository's and the templates' workflows install with
  `bun install --frozen-lockfile` where they ran `npm ci`, and run scripts
  with `bun run`.
- Dependabot watches each layer holding a `bun.lock` with
  `package-ecosystem: bun`, the root likewise. The `@types/node` major
  ignores go; `@types/bun` follows Bun's own version.
- `test/dependabot.test.js` requires a `bun` entry for each layer holding a
  `bun.lock`, and no `npm` entry anywhere.

## chewygumxx/.github

`lint.yaml` and `commitlint.yaml` detect the caller's lockfile:

| Lockfile            | Install                         | Run                | Commitlint                  | Cache                  |
| ------------------- | ------------------------------- | ------------------ | --------------------------- | ---------------------- |
| `bun.lock`          | `bun install --frozen-lockfile` | `bun run <script>` | `bunx --no-install`         | `~/.bun/install/cache` |
| `package-lock.json` | `npm ci`                        | `npm run <script>` | `npx --no --`               | `~/.npm`               |

A caller with neither lockfile fails with an error naming both. The README
describes both. The
change is committed, pushed and `v1` moved to it before this repository's
CI switches; moving the tag is confirmed with the maintainer first.

## Testing

Test-first, as in earlier phases: the unit tests change before the code
they pin. Then `bun run check` in this repository, `bun run check` with no
Node on `PATH` beyond Bun's, and the dry run of every template combination.

## Out of scope

- Migrating the six other repositories that call the shared workflows
  (dorothy, learn-node, pd-upload, repo-tmpl, shared-config,
  sync-header-metadata).
- The release itself: the version bump to 3.0.0 and npm staging happen
  when the maintainer asks.
