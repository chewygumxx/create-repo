---
__cgxx: |
  # vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3:
  # SPDX-License-Identifier: GPL-3.0-only

  #
  #
  # ~chewygumxx/create-repo.git
  # ::: :/.claude/CLAUDE.md
  #
  #

ctime: 2026-09-30
title: CLAUDE.md
description: "Repository instructions"
tags:
  - claude
  - llm
---

# CLAUDE.md

Continuously granularly commit as you work. Compose single-line commit messages
whenever appropriate. If the granular commit does indeed warrant further
context, include such within the commit message body.

## Repository Information

`templates/` holds the templates this package copies into every new
repository, as layer directories that `lib/templates.js` composes. Their
`.claude/`, `README.md` and configuration describe those repositories, not
this one.

Leave the templates' `chewygumxx/repo-tmpl` identity in their file headers
and `.repo-metadata.jsonc` as it is: `lib/init.js` finds and rewrites it in
each new repository, and fails if `repo-tmpl` or `repo_tmpl` remains
anywhere. Each layer's `_gitignore` is renamed to `.gitignore` on copy.
