---
ctime: 2026-10-01
mtime: 2026-11-21
spdx: GPL-3.0-only
title: Pending deferred minors
description: >-
  Known minors still open, each with where it lives and what fixing it would
  take.
tags:
  - create-repo
  - todo
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/docs/pending-deferred-minors.md
   -
   -->

# Pending deferred minors

What is known and still open as of 4.0.0, which dropped the native templates
and moved every template to mise and hk. Nothing here blocks a release. Each
item names where it lives and what fixing it would take. Remove an item when
it is fixed, in the commit that fixes it.

## Declined to judge

Behaviours the reviewer set aside and I ruled should stand. Each is a product
choice, not a defect, unless the cost below turns out to matter.

- **Other invisible characters are accepted:** U+2060, U+2061 to U+2064,
  U+00AD, U+061C, U+180E and the U+E0000 tag characters. Refusing them is a
  one-line change to `CONTROL` in `lib/args.js`. The cost of accepting them is
  a description that looks different from what it contains.
- **`Repo-Tmpl` is accepted under an owner that already has `repo-tmpl`.**
  GitHub names are case-insensitive, so `gh repo create` fails after the local
  commit. This predates the latest branch.
- **Dependabot support for mise is unverified,** so the tool pins in each
  `.config/mise/config.toml` are bumped by hand.
- **History:** the spec change in its own commit (`cfab906`) was not rewritten.
  The cost is one untidy commit boundary.

## Not addressable from this repository

- The repeated `package.json`, `.knip.jsonc`, `hk.pkl` and README text
  across the template layers.
- The `commitizen` and `remark-cli` deprecation notices.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
