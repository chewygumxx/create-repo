---
title: Repository Agent Instructions
description: Repository agent instructions
---

<!--
   -
   - ~chewygumxx/repo-tmpl.git
   - ::: :/AGENTS.md
   -
   -->

# Repository Agent Instructions

## Continuous Granular Commits

Continuously granularly commit as you work. Compose single-line commit messages
whenever appropriate. If the granular commit does indeed warrant further
context, include such within the commit message body.

Commit messages are Conventional Commits, checked by commitlint against
`.commitlintrc.mts`, which lists the scopes this repository allows.

## Tasks and Hooks

mise runs every task: `mise run check` runs what CI runs, `mise run format`
applies the formatters, and `mise tasks` lists the rest. The tasks extend the
templates of `@chewygumxx/mise-tasks-config`, and lint and format run the
steps of `@chewygumxx/hk-config` through hk, by `.config/hk.pkl`. With no
flag a task selects the changed files; `--staged` the staged files; `--all`
every file.

`mise install` installs the tools, the packages and the git hooks. The
pre-commit hook runs `mise run check --staged`, and the commit-msg hook runs
commitlint. Fix what they report; never skip them.

## Skills

`.agents/skills/` and `.claude/skills/` link the agent skills that
`package.json`'s devDependencies provide, such as
`@chewygumxx/skill-creating-bun-repositories`, which explains this
repository's setup. Every install relinks them, and `skills-lock.json`
records them: add a skill as an exact devDependency, then run `mise run
skills`, and commit the lock it updates.

## Repository Metadata

`.repo-metadata.jsonc` holds the GitHub repository's description, topics and
licence. CI applies it on every push to `main`, so edit those settings there,
never in GitHub's web interface: nothing rejects a web edit, and the next push
silently reverts it.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
