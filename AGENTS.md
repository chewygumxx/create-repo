---
title: Repository Agent Instructions
description: Repository agent instructions
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/AGENTS.md
   -
   -->

# Repository Agent Instructions

## Continuous Granular Commits

Continuously granularly commit as you work. Compose single-line commit messages
whenever appropriate. If the granular commit does indeed warrant further
context, include such within the commit message body.

## Repository Layout

- `bin/create-repo.js` is the CLI, and `lib/` its modules: `templates.js`
  declares each template's layers, features and identity edits, and the
  commands every template is installed, formatted and checked with.
- `templates/` holds the layers the templates are composed of. Their
  `AGENTS.md`, `README.md` and configuration describe the repositories they
  create, not this one.
- `test/` holds the tests, which `mise run test` runs with `bun test`.
  `test/paradigm.test.js` holds this repository and every template to the
  layout shared-config and agentic-library share.

## Tasks and Hooks

mise runs every task: `mise run check` runs what CI runs, `mise run format`
applies the formatters, and `mise tasks` lists the rest. The tasks extend the
`cgxx:` templates of `@chewygumxx/mise-tasks-config`, and lint and format run
the steps of `@chewygumxx/hk-config` through hk, by `.config/hk.pkl`.
`mise install` installs the tools, the packages and the git hooks, which run
`mise run check --staged` and commitlint. Fix what they report; never skip
them. The hooks are a mise hook, not an npm script: this package is
installed from the registry, where it must run no install script.

## The Templates' Identity

Leave the templates' `chewygumxx/repo-tmpl` identity in their file headers
and `.repo-metadata.jsonc` as it is: `lib/init.js` finds and rewrites it in
each new repository, and fails if `repo-tmpl` or `repo_tmpl` remains
anywhere. Each layer's `_gitignore` is renamed to `.gitignore` on copy, and a
layer holds only regular files: npm drops symlinks, so the copy makes the
`.config/mise/conf.d/` link itself.

After changing a layer's `package.json`, regenerate its `bun.lock` with
`bun install --lockfile-only` in the layer's directory.

## Releases

Release Please reads the conventional commits since the last release: `fix`
releases a patch, `feat` a minor, and a `!` or a `BREAKING CHANGE:` footer a
major. Type a change to a template by what it does for the repositories it
creates. Squash-merge the release pull request with its title as the
subject and an empty body.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
