---
ctime: 2026-09-30
mtime: 2026-10-05
spdx: GPL-3.0-only
title: CLAUDE.md
description: >-
  Claude Code's guide to create-repo: how to commit, and why the templates'
  repo-tmpl identity is left for lib/init.js to rewrite.
tags:
  - claude
  - llm
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/.claude/CLAUDE.md
   -
   -->

# CLAUDE.md

Continuously granularly commit as you work. Compose single-line commit messages
whenever appropriate. If the granular commit does indeed warrant further
context, include such within the commit message body.

When appropriate and worthwhile to compact, append the following
newline-delimited items to your response:

- A `/compact <summary>`
- Appraisal rating scaled 1-100
- Risk assessment rating scaled 1-100
- Terse single-sentence justification.

## Repository Information

`templates/` holds the templates this package copies into every new
repository, as layer directories that `lib/templates.js` composes. Their
`.claude/`, `README.md` and configuration describe those repositories, not
this one.

Leave the templates' `chewygumxx/repo-tmpl` identity in their file headers
and `.repo-metadata.jsonc` as it is: `lib/init.js` finds and rewrites it in
each new repository, and fails if `repo-tmpl` or `repo_tmpl` remains
anywhere. Each layer's `_gitignore` is renamed to `.gitignore` on copy.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
