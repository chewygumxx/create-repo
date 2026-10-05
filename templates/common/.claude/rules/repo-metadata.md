---
ctime: 2026-09-27
mtime: 2026-10-05
spdx: GPL-3.0-only
title: Repository metadata
description: >-
  Why GitHub settings are edited in .repo-metadata.jsonc, which CI applies on
  every push to main, and not on GitHub.
paths:
  - ".repo-metadata.jsonc"
tags:
  - llm
  - claude
---

<!--
   -
   - ~chewygumxx/repo-tmpl.git
   - ::: :/.claude/rules/repo-metadata.md
   -
   -->

# `.repo-metadata.jsonc` is the GitHub settings page

This file holds the GitHub repository's own description, topics and licence. CI
applies it on every push to `main`, so those settings are edited here and not in
the web interface.

Editing them in the web interface is the failure worth naming: nothing rejects
it, and the next push silently reverts it.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
