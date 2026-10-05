---
ctime: 2026-10-01
mtime: 2026-10-05
spdx: GPL-3.0-only
title: Address the deferred minors (v2.1.1 follow-up)
description: >-
  Plan addressing the minors deferred by the v2.1.1 review: fix defects, rule on
  choices, report what cannot be done here.
tags:
  - create-repo
  - plan
---

<!--
   -
   - ~chewygumxx/create-repo.git
   - ::: :/docs/plans/2026-10-01-address-remaining-minors.md
   -
   -->

# Address the deferred minors (v2.1.1 follow-up)

## Context

v2.1.1 shipped (`main` at fe6488d, npm `latest` 2.1.1). The final review and
the release left a list of deferred minors, a list the reviewer declined to
judge, and a list of things not fixable here. "Address all" means: fix what is
a defect, make a ledgered ruling for what is a choice, and report what cannot
be done from this repository. No release, version bump, tag or push is part of
this plan; those need a separate instruction. Execution follows the usual
workflow: inline, TDD (RED then GREEN, suite green), one granular commit per
change (single-line header at most 50 characters, scopes `claude`/`template`
or none, `npm run format` first, no em dash, check `git status` after each
commit), sdd ledger, one fresh Opus whole-branch review, one test-first fix
pass for Critical/Important only, then finishing-a-development-branch.

Work on a branch off `main`; the spec
(`docs/specs/2026-09-30-multiple-templates-design.md`) is updated in the same
commit as any behaviour it describes.

## Tasks (each: failing test first, then the change)

1. **Biome warning, `test/templates.test.js:170`.** The `${{ ... }}` literal
   trips `lint/suspicious/noTemplateCurlyInString`. Add a biome-ignore
   comment for that rule, giving "a GitHub expression, not a template" as the
   reason (the repo already does this in `lib/args.js:67`). Verify:
   `npx biome lint test/templates.test.js` reports no warning.
2. **Control-character message** (`lib/args.js:77`). It says TOML cannot hold a
   control character (a tab is legal in a TOML basic string) and shows for npm
   templates. Reword to a neutral, true statement: "contains a control
   character (a tab included), which is not allowed." Extend the existing
   `test/input.test.js` test ("a control character ...") to assert the message
   no longer mentions TOML.
3. **C1 controls and U+2028/U+2029** (declined-to-judge). Widen `CONTROL` to
   `[\u0000-\u001f\u007f-\u009f\u2028\u2029]`; tests for `\u0085`, `\u009f`,
   `\u2028`, `\u2029` in a description and a scope's full name. Keep the
   biome-ignore comment.
4. **Template words in a module, any case** (affix bypass and case-insensitive
   filesystem, two deferred minors in one fix). In `lib/templates.js`, `nvim`'s
   `luaModuleName` refuses a module that matches `/^repo[-_]tmpl$/i`
   (`nvim-repo-tmpl`, `repo-tmpl.nvim`, `Repo_Tmpl.nvim`); the zsh plugin name
   gets the same refusal (`Repo_Tmpl`). Error text says the module is the
   template's own. Why refusing is the fix: init's leftover guard is case
   sensitive and `moduleName` renames file by file, so on a case-insensitive
   filesystem `lua/Repo_Tmpl/` keeps the directory name `repo_tmpl` silently,
   and `repo-tmpl` as a module fails late. Tests in `test/templates.test.js`
   (checkName cases) and an early-refusal case in `test/input.test.js`
   (stops before the key command). Update the spec's refused-names paragraph.
5. **zsh plugin named `test`** (`ZSH_RUNNER` in `lib/templates.js`). Its unload
   function `test_plugin_unload` matches the runner's `test_*` glob and runs as
   a test. Add `test` to the refused names; test in `test/zsh.test.js` or
   `test/templates.test.js`; adjust the error text and the README sentence in
   `templates/zsh/README.md` if it lists the refused words.
6. **Windows-reserved crate names** (declined-to-judge). First verify with the
   installed cargo (`cargo new con`, `cargo new com1`) what it does on this
   platform; the aim is to refuse `con prn aux nul com1-9 lpt1-9` (any case)
   for every Rust crate, since cargo errors on Windows and only warns
   elsewhere and the generated repo's CI may run anywhere. Test in
   `test/templates.test.js`; note in the spec.
7. **Owner from the `gh` login skips the template-word refusal**
   (`bin/create-repo.js:168`). Export `notTemplate` from `lib/args.js` and
   apply it to `options.owner ?? login`; test in `test/bin.test.js` with a
   `gh` stand-in whose login is `repo-tmpl` (a UsageError, nothing created).
8. **Dependabot test checks content, not just existence**
   (`test/dependabot.test.js`). `github-actions` directories must hold at
   least one `.yaml`/`.yml`; `npm` directories must hold a `package.json`.
   RED proof: point the check at an empty temp directory via the helper, or
   temporarily assert against a directory known to be empty, and watch it
   fail.
9. **README** (`README.md` "Development"). `lint:templates` is described as
   Biome only; it also runs `editorconfig-checker` per materialised template,
   and `check` runs `lint:editorconfig` on the repo itself. Reword, 80 columns,
   no em dash. Verify with `npm run lint:md`.
10. **`vimdocTags` prose line ending in a tag** (ruling, no behaviour change).
    Telling a prose line from a right-aligned tag line by shape alone would
    silently stop realigning a mixed-case heading, which is the worse failure.
    Document the limit in the function's doc comment and add a test pinning
    that a prose line with a single space before its tag is untouched (the
    existing 2-space minimum), so the boundary is explicit.
11. **Rust keywords refused for binaries** (ruling, no change). Keep refusing:
    crates.io and `cargo new` refuse keyword names, so a binary named `fn`
    would be unpublishable and unscaffoldable even though it builds. Record
    the ruling and say so in the `RUST_KEYWORDS` comment.

## Not addressable here (report only)

- Triplicated `package.json`/README text (the layer design requires it).
- `commitizen` and `remark-cli` deprecation notices (already latest).
- 50-character header enforcement (`committed` 1.1.11 cannot).
- No Dependabot entry for `templates/rust` (an approved ruling: Dependabot
  does support `cargo`, so this is a choice, not a limit) and none for mise
  (support not verified).
- Shared commitlint ignore regex upstream: belongs to
  `chewygumxx/shared-config`; I will not touch another repository.
- Native commitlint job and mise 2026.9.0 to 2026.9.16 unverified on GitHub:
  verifying needs creating a real repository, which is outward-facing.

## Critical files

`lib/args.js`, `lib/templates.js`, `lib/init.js` (doc comment only),
`bin/create-repo.js`, `README.md`, `templates/zsh/README.md`, the spec, and
tests `test/input.test.js`, `test/templates.test.js`, `test/bin.test.js`,
`test/dependabot.test.js`, `test/zsh.test.js`, `test/identity.test.js`.
Reuse: `UsageError`, `notTemplate`, `runWithKeyCommand` (`test/input.test.js`),
the `runBin` stand-ins (`test/bin.test.js`), `TEMPLATE_WORD`.

## Verification

Per task: the new test RED then GREEN. At the end: `npm run check` (typecheck,
Biome, remark, Prettier/yamllint, em dash, editorconfig, `lint:templates`,
full suite; currently 224/224) with zero Biome warnings. Then the one Opus
whole-branch review, a fix pass for Critical/Important, and the final message
listing every "Ruling:" and any new "Deferred minors" exhaustively.

<!-- vim:set expandtab shiftwidth=2 filetype=markdown foldlevel=3: -->
