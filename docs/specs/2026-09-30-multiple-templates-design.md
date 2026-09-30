---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/create-repo.git
  # ::: :/docs/specs/2026-09-30-multiple-templates-design.md
  #
  #

ctime: 2026-09-30
title: >-
  Specification: multiple templates
description: ""
tags: []
---

# Specification: multiple templates

`create-repo` bundles one template. It will bundle six, chosen with
`--template`, each guaranteeing what the single template guarantees today: a
repository created from it commits only after its own check passes, and its
first CI run passes.

| Template     | Family | Features  | For                                    |
| ------------ | ------ | --------- | -------------------------------------- |
| `standard`   | npm    |           | Any repository; today's template       |
| `typescript` | npm    | `publish` | A Node library or CLI, no build step   |
| `cloudflare` | npm    |           | A Cloudflare Worker with a deploy flow |
| `rust`       | native | `lib`     | A Rust binary crate, or a library      |
| `nvim`       | native |           | A Neovim plugin                        |
| `zsh`        | native |           | A zsh plugin                           |

## Decisions

- **Two families.** The npm family keeps today's hygiene layer: commitlint,
  commitizen, husky, Biome, remark, prettier and yamllint with the shared
  `@chewygumxx/*` configurations, run by `npm run check`. The native family
  carries no `package.json`: the same hygiene from non-npm tools pinned in
  mise, run by `mise run check`. Rust, nvim and zsh repositories are native,
  since npm would be there only for hygiene.
- **Shared configurations are inlined in the native family for now.** The
  `@chewygumxx/*` configurations reach a repository through `node_modules`.
  Native templates carry copies instead; distributing them without npm is
  deferred work (see [Deferred](#deferred)).
- **Layers, not copies.** A template is an ordered list of layer directories
  under `templates/`, so a file shared by several templates exists once.
- **Reject, never derive.** A repository name the chosen template cannot use
  (a crate name with a `.`, a Worker name with a capital) is refused with the
  rule, not silently transformed.
- **`standard` is today's template.** Its output is unchanged, `--template`
  defaults to it, and the release is a minor version, 2.1.0.

## Layout and composition

`template/` becomes `templates/`, in `package.json` `files` too. Each
subdirectory is a layer:

| Layer                | Holds                                                    |
| -------------------- | -------------------------------------------------------- |
| `common`             | `LICENSE`, `.editorconfig`, `.gitattributes`,            |
|                      | `.worktreeinclude`, `.repo-metadata.jsonc`, `.claude/`   |
|                      | but its `install-deps.sh`, the pull request template     |
| `npm`                | The npm hygiene layer: `package.json`, its lock,         |
|                      | `_gitignore`, `mise.toml`, `.husky/`,                    |
|                      | `.commitlintrc.mts`, `.biome.json`, `.yamllint.yaml`,    |
|                      | `tsconfig.json`,                                         |
|                      | `README.md`, `install-deps.sh`, CI and Dependabot        |
| `typescript`         | Replaces `package.json`, its lock, `tsconfig.json` and   |
|                      | `README.md`; adds `src/`                                 |
| `typescript-publish` | Replaces `package.json`, its lock, `_gitignore` and      |
|                      | `README.md`; adds `tsconfig.build.json` and the publish  |
|                      | workflow                                                 |
| `cloudflare`         | Replaces `package.json`, its lock, `tsconfig.json`,      |
|                      | `.biome.json`, `.editorconfig`, `_gitignore` and         |
|                      | `README.md`; adds `wrangler.jsonc`,                      |
|                      | `worker-configuration.d.ts`, `vitest.config.ts`,         |
|                      | `src/`, `test/` and the deploy workflow                  |
| `native`             | The native hygiene layer (see [Native](#native-family))  |
| `rust`               | `Cargo.toml`, `Cargo.lock`, `rustfmt.toml`, its mise     |
|                      | tasks; replaces `_gitignore`, `README.md`, Dependabot    |
| `rust-bin`           | `src/main.rs`                                            |
| `rust-lib`           | `src/lib.rs`                                             |
| `nvim`               | The plugin, its tests, tool configurations and mise      |
|                      | tasks; replaces `_gitignore` and `README.md`             |
| `zsh`                | The plugin, its tests, `.github/apt-packages.txt` and    |
|                      | its mise tasks; replaces `README.md`                     |

`copyTemplate(dir, layers)` copies each layer in order; a file in a later
layer replaces the same path from an earlier one. No layer deletes: shapes
that exclude each other, such as `rust-bin` and `rust-lib`, are separate
layers. Every layer is filtered by the composed `_gitignore`, the last
layer's, which is then renamed to `.gitignore`. A missing layer directory is
a `TemplateError`.

## The catalogue

`lib/templates.js` exports one typed entry per template:

```js
rust: {
    description: "A Rust crate, without npm",
    family: "native",
    features: { lib: "A library crate instead of a binary" },
    layers: ({ lib }) => ["common", "native", "rust", lib ? "rust-lib" : "rust-bin"],
    edits: [headers, repoMetadata, readme, cargoToml, cargoLock, committedScopes, module],
    checkName: crateName,
}
```

`layers` is a function of the chosen features. `checkName` receives the name,
owner and features and throws `UsageError` with the rule. A family supplies
the commands:

| Family | Setup                           | Format                    | Check               |
| ------ | ------------------------------- | ------------------------- | ------------------- |
| npm    | `npm ci --no-fund --no-audit`   | `npm run --silent format` | `npm run check`     |
| native | none beyond `mise install`      | `mise run format`         | `mise run check`    |

Whether `mise trust` must name `.config/mise/conf.d/*.toml` as well as the
directory is verified during implementation; the command trusts whatever
`mise run check` then reads.

## The command line

- `--template <name>`, default `standard`. An unknown name is a `UsageError`
  listing the templates.
- `--with <feature,...>`. A feature the template lacks is a `UsageError`.
- In a terminal, whichever of the template and its features was not given as
  a flag is prompted, as numbered choices, and the summary shows both; a
  template without features asks nothing more. Without a terminal, `standard`
  and no features are the defaults, so existing non-interactive callers are
  unaffected.
- A template may name `defaultFeatures`, which an empty reply to the features
  prompt takes; `none` takes no feature. The flags, `--with ""` included, and
  a missing terminal never take them. `typescript` names `publish`, so its
  prompt offers the publishable package unless told otherwise.
- The name is checked against the template's `checkName` wherever it is
  checked today; a prompt asks again.
- The first commit's body records the choice: `Generated by
  @chewygumxx/create-repo 2.1.0 (rust, with lib).`

The run is today's with the template-specific steps drawn from the catalogue:

```text
copyTemplate(dir, layers) → git init → mise trust, install → family setup
→ init(dir, answers, files, edits) → git add → family format → git add
→ family check → commit
```

## Identity edits

`lib/init.js` becomes named edits. Each fails when its target is missing, as
today.

| Edit               | Target                                                 | Templates  |
| ------------------ | ------------------------------------------------------ | ---------- |
| `headers`          | `~chewygumxx/repo-tmpl.git` in every file              | all        |
| `repoMetadata`     | `.repo-metadata.jsonc`                                 | all        |
| `readme`           | Frontmatter, `# repo-tmpl`, "Using this template"      | all        |
| `packageJson`      | `package.json`; `@owner/name` with `publish`           | npm        |
| `packageLock`      | `package-lock.json`                                    | npm        |
| `commitlintScopes` | `.commitlintrc.mts`                                    | npm        |
| `wranglerName`     | `name` in `wrangler.jsonc`, with jsonc-parser          | cloudflare |
| `committedScopes`  | `allowed_scopes` in `committed.toml`; full names as    | native     |
|                    | comments                                               |            |
| `cargoToml`        | `name`, `description`, `repository` in `[package]`     | rust       |
| `cargoLock`        | The crate's own `[[package]]` name                     | rust       |
| `module`           | The `repo_tmpl` token in declared files and paths      | rust with  |
|                    |                                                        | `lib`,     |
|                    |                                                        | nvim, zsh  |

The TOML edits are anchored regular expressions, adding no dependency.
Every layer's `README.md` keeps the heading, introduction and "Using this
template" section that `readme` replaces.

`module` uses a second sentinel, `repo_tmpl`, an identifier where
`repo-tmpl` is a slug, so it is independent of the order of `headers`. Its
value per template:

| Template   | `repo_tmpl` becomes                                           |
| ---------- | ------------------------------------------------------------- |
| rust `lib` | The crate name with `-` as `_`, as Rust code names the crate  |
| nvim       | The name without a `.nvim` suffix or `nvim-` prefix           |
| zsh        | The name                                                      |

After every edit, `init` fails if any path or content of the copy still
holds `repo-tmpl` or `repo_tmpl`. This is the dry run's grep, made part of
`init`.

## Name rules

| Template             | Name used as             | Rule                                     |
| -------------------- | ------------------------ | ---------------------------------------- |
| `typescript publish` | npm package `@owner/name` | Owner and name lowercase                |
| `cloudflare`         | Worker name              | `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$` |
| `rust`               | Crate name               | `^[A-Za-z][A-Za-z0-9_-]{0,63}$`          |
| `nvim`               | Lua module               | `^[A-Za-z_][A-Za-z0-9_-]*$` once affixes |
|                      |                          | are removed                              |
| `zsh`                | Plugin and function      | `^[A-Za-z0-9_-]+$`                       |

## npm family

### standard

`common` and `npm`: today's `template/`, split in two, byte for byte.

### typescript

`common`, `npm`, `typescript`. Node 24 runs `src/*.ts` by type stripping;
TypeScript only typechecks.

- `src/index.ts` exports a small function; `src/index.test.ts` tests it with
  `node:test`.
- `package.json` adds `"type": "module"`, `engines.node >=24`, `test: node
  --test 'src/**/*.test.ts'`, and `check` runs `test`. It stays `private`.
- `tsconfig.json`: `strict`, `noEmit`, `module` and `moduleResolution`
  `nodenext`, `erasableSyntaxOnly`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions`; includes `src/` and `.commitlintrc.mts`.

With `publish`, `typescript-publish` adds:

- `package.json` without `private`, named `@owner/name`, with `exports` and
  `types` in `dist/`, `files: ["dist"]`, `build: tsc -p tsconfig.build.json`,
  `prepack: npm run build`, and `publishConfig` `access: public` and
  `provenance: true`.
- `tsconfig.build.json`, extending `tsconfig.json` with emit on, `outDir:
  dist`, `declaration` and `rewriteRelativeImportExtensions`, excluding tests.
- `dist/` in `_gitignore`.
- `.github/workflows/publish.yaml`, this repository's own: on a `v*` tag, the
  check, a tag and `version` comparison, then `npm stage publish` by trusted
  publishing.

### cloudflare

`common`, `npm`, `cloudflare`. The `typescript` layer is left out: the
`cloudflare` layer replaces all of it, and its `src/index.test.ts` would fail
against the Worker's `src/index.ts`, since no layer deletes.

- `wrangler.jsonc`: `name` is the Worker name, `main` is `src/index.ts`,
  `compatibility_date` is pinned by hand to no later than the newest date the
  workerd of `@cloudflare/vitest-pool-workers` supports, and
  `observability.enabled` is `true`.
- `src/index.ts` is a typed `fetch` handler. `worker-configuration.d.ts` is
  generated by `wrangler types --include-runtime=false` and committed; the
  runtime types come from `@cloudflare/workers-types`, since the full file is
  600 KB with em dashes in its comments.
- `test/index.test.ts` runs in the Workers runtime through `vitest` (4, the
  range the pool peers on) and `@cloudflare/vitest-pool-workers`.
- `package.json` adds `dev`, `deploy`, `types` and `types:check`; `check` runs
  `wrangler types --check` (`types:check`) so it fails when
  `worker-configuration.d.ts` is stale, then `vitest run`.
- `.biome.json` ignores `worker-configuration.d.ts`, and `.editorconfig`
  allows its tabs, which CI's editorconfig-checker would otherwise refuse;
  `_gitignore` adds `.wrangler/` and `.dev.vars*`.
- `.github/workflows/deploy.yaml` runs on `workflow_run` of CI completing on
  `main`, and on `workflow_dispatch`. Its job requires a `push` CI run that
  succeeded (or a manual run) and `vars.CLOUDFLARE_ACCOUNT_ID != ''`, so until
  that variable and the `CLOUDFLARE_API_TOKEN` secret are set by hand it is
  skipped, which GitHub counts as passing. It runs mise, `npm ci`, then
  `npx wrangler deploy`, so the lock pins Wrangler. The README explains the
  variable and secret; `create-repo` sets neither.

## Native family

### The native layer

`mise.toml` pins, exactly: jq, uv, yamllint, Biome, rumdl, yamlfmt and
committed. Its `[hooks]` `postinstall` runs `git config core.hooksPath
.githooks`, so `mise install`, locally and in `jdx/mise-action`, wires the
git hooks as npm's `prepare` does for husky.

Its tasks are aggregates that language layers extend by adding
`.config/mise/conf.d/<language>.toml`, never by replacing `mise.toml`:

| Task         | Depends on     | This layer's                                          |
| ------------ | -------------- | ----------------------------------------------------- |
| `check`      | `lint:*`,      | `lint:biome` (`biome ci .`), `lint:md` (`rumdl       |
|              | `test:*`       | check`), `lint:yaml` (`yamlfmt -lint`, then          |
|              |                | `yamllint --strict`), `lint:emdash`                   |
| `format`     | `format:*`     | `format:biome`, `format:yaml`                         |
| `pre-commit` | `pre-commit:*` | The same checks on staged files                       |

`commitlint` runs committed over a range and skips a commit whose header is
`build|ci: bump` and which carries Dependabot's `Signed-off-by` trailer, as
the shared commitlint configuration's `ignores` does.

`.githooks/pre-commit` runs `mise run pre-commit`; `.githooks/commit-msg`
runs `mise exec -- committed --commit-file "$1"`. Both use mise's pinned
tools, not the contributor's `PATH`.

Configurations, inlined:

- `committed.toml`: `style = "conventional"`, `subject_length = 50`,
  `line_length = 72`, the shared configuration's twelve types,
  `allowed_scopes = ["claude"]`, `subject_not_punctuated = true`;
  `imperative_subject`, `subject_capitalized`, `no_fixup` and `no_wip` off,
  as commitlint does not reject what they would.
- `.biome.json`: `@chewygumxx/biome-config`, copied, without `extends`.
- `.yamllint.yaml`: `@chewygumxx/yamllint-config`, copied.
- `.rumdl.toml`: `@chewygumxx/remark-preset` as nearly as rumdl allows: 80
  columns, `-` bullets, frontmatter, GitHub alert references allowed.
- `.yamlfmt.yaml`: prettier's YAML output as nearly as yamlfmt allows.

Also: `_gitignore` without `node_modules/`; `install-deps.sh` running `mise
install` in remote sessions; Dependabot for `github-actions`; a README for
`mise run check`, `mise run format`, the hooks and the commit rules.

`ci.yaml` calls `standard.yaml` with `commitlint: false` and `yaml: false`,
then two jobs of its own: `commitlint`, running `mise run commitlint` over
the same push, pull request and dispatch ranges as the shared job; and
`check`, at `needs.standard.outputs.sha`, running `mise run check`. Before
mise, a step installs `.github/apt-packages.txt`'s packages with `apt-get`
when that file exists.

### rust

`common`, `native`, `rust`, then `rust-bin`, or `rust-lib` with `lib`.

- `rust = { version = "<pinned>", components = "clippy,rustfmt" }`.
- Tasks: `lint:fmt` (`cargo fmt --check`), `lint:clippy` (`cargo clippy
  --all-targets --locked -- -D warnings`), `test:cargo` (`cargo test
  --locked`), `format:rust` (`cargo fmt`), `pre-commit:rust` (`cargo fmt
  --check`).
- `Cargo.toml`: `edition = "2024"`, `license = "GPL-3.0-only"`,
  `publish = false`, `[lints.clippy]` `pedantic = "warn"`. `Cargo.lock` is
  committed. `rustfmt.toml` names edition 2024.
- `_gitignore` adds `/target/`; Dependabot adds `cargo`.
- `rust-bin`: `src/main.rs`, a small function and its unit test.
- `rust-lib`: `src/lib.rs`, a unit test and a doc test naming `repo_tmpl`.

### nvim

`common`, `native`, `nvim`, following `chewygumxx/nvim-config`.

- Tools: `github:neovim/neovim` (a pinned stable release),
  `aqua:LuaLS/lua-language-server`, `aqua:Kampfkarren/selene`, and `luafmt`
  through `tool_alias` and `matching` as in `nvim-config`.
- `lua/repo_tmpl/init.lua` (`setup(opts)` over defaults with
  `vim.tbl_deep_extend`), `lua/repo_tmpl/health.lua`, `plugin/repo_tmpl.lua`
  (a load guard and one user command), `doc/repo_tmpl.txt`,
  `tests/test_repo_tmpl.lua`, `tests/minimal_init.lua`, `tests/run.lua`.
- `.luarc.json` (LuaJIT, the `vim` global), `selene.toml` with `vim.yml`
  (`std = "lua51+vim"`), `.luafmt.toml` as in `nvim-config`.
- Tasks: `deps` clones mini.test at a pinned tag into `.tests/`; `lint:lua`
  (selene, `luafmt --check`); `lint:types` (lua-language-server `--check`,
  failing at warnings); `test:nvim` (depends on `deps`; `nvim --headless -u
  tests/minimal_init.lua -l tests/run.lua`); `format:lua`; `pre-commit:lua`.
- `tests/run.lua` fails when it collects no test.
- `_gitignore` adds `/.tests/`.

### zsh

`common`, `native`, `zsh`, following the Zsh Plugin Standard as `zsh-als`
does.

- `repo_tmpl.plugin.zsh`: the standard's `$0` handling, `functions/` on
  `fpath` once, `autoload -Uz repo_tmpl`, and `repo_tmpl_plugin_unload`.
- `functions/repo_tmpl`, an example function; `tests/test_repo_tmpl.zsh` and
  `tests/run.zsh`, which sources the plugin, runs every `test_*` function
  and fails when there are none.
- Tools: `github:ewhauser/shuck`.
- Tasks: `lint:zsh` (`zsh -n` on each tracked zsh file, then shuck),
  `test:zsh` (`zsh tests/run.zsh`), `pre-commit:zsh` (`zsh -n` on staged
  files).
- zsh is a system prerequisite, named in the README;
  `.github/apt-packages.txt` lists `zsh` for CI.

## Testing

`npm test`, with nothing installed:

- `test/templates.test.js`: for every template and feature combination,
  materialise it, check its files, run `init` with a sample identity, check
  each edit, and check no sentinel remains; the catalogue's shape (every
  layer exists, every edit is known); every name rule, accepted and refused.
- `args.test.js`: `--template` and `--with`, and their errors.
- `prompt.test.js`: the template and feature choices and the summary.
- `template.test.js`: copying layers, a later layer's file winning.
- `init.test.js`: split by edit.
- `pack.test.js`: the package holds `templates/**` and every layer's
  `_gitignore`.

The Create Repo workflow runs a matrix: `standard`, `typescript`,
`typescript` with `publish`, `cloudflare`, `rust`, `rust` with `lib`,
`nvim`, `zsh`. Each materialises the pristine template with
`scripts/materialize.js`, installs it and runs its family's format check,
replacing `npm run lint:template`; then runs the dry run with `--template`
and `--with`, and the sentinel grep. Publish needs the whole matrix.

## Development

- `scripts/materialize.js <template> [--with <features>] <dir>` serves CI and
  `npm run templates:lock`, which regenerates each layer's `package-lock.json`
  or `Cargo.lock` in a materialised copy and writes it back to its layer.
- `.gitattributes` excludes `/templates/**` from the header sync; the root
  `.biome.json` excludes `templates/`.
- Dependabot watches each layer holding a lock, `npm` for the npm layers and
  `cargo` for `/templates/rust`, with the `build(template)` and
  `ci(template)` prefixes.
- `.claude/CLAUDE.md` and the README move to `templates/`, name both
  sentinels, and the README tabulates the templates and their features.

## Phases

Each phase ships on its own, with its matrix entry and tests.

1. The engine: layers, the catalogue, `--template` and `--with`, named
   edits, the sentinel guard, the matrix, `standard` only.
2. `typescript` and `publish`.
3. `cloudflare`.
4. The native layer and `rust` with `lib`.
5. `nvim`.
6. `zsh`.

## Deferred

The native family's analogues of the npm configuration packages, and what
they would close:

1. Commit linting: `a/b` multiple scopes, a subject case warning (committed
   only errors, so it is off), and the interactive prompt `npm run commit`
   gives.
2. Distributing the Biome, yamllint and remark (rumdl) configurations
   without npm, so native templates stop carrying copies that can drift.
3. Reusable `mise` check and committed workflows in `chewygumxx/.github`,
   replacing the native `ci.yaml`'s own jobs.

## Further templates

Conjectured, most fitting first:

| Template           | Family           | Shape                                      |
| ------------------ | ---------------- | ------------------------------------------ |
| `shell`            | native           | sh or bash CLI: shellcheck, shfmt, bats    |
| `claude-plugin`    | npm              | `plugin.json`, skills, agents, hooks, a    |
|                    |                  | marketplace manifest, schema validation    |
| `github-action`    | npm, typescript  | `action.yml`, bundled `dist/`, tags        |
| `python`           | native           | uv, ruff, ty, pytest                       |
| `go`               | native           | gofumpt, golangci-lint, `go test`          |
| `cloudflare-rust`  | native           | workers-rs with the cloudflare deploy flow |
| `workspaces`       | npm              | npm workspaces with changesets             |
| `schema`           | npm              | JSON Schema with ajv fixtures              |
| `site`             | npm              | Astro or Vite, to Pages                    |
| `dotfiles`         | standard         | chezmoi source state and its checks        |
