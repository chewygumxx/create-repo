# Pending deferred minors

What is known and still open after `d0db902` (`main`, v2.1.1 plus 24 commits,
unreleased), and on `feat/bun`, the unmerged migration to Bun that 3.0.0
would release. Nothing here blocks a release. Each item names where it lives and
what fixing it would take. Remove an item when it is fixed, in the commit that
fixes it.

## Deferred minors

Found by the whole-branch review of `address-deferred-minors`; not fixed
because minors never enter a fix pass.

1. **A `ran` assertion that cannot fail.** The "no owner at all stops before
   the key command" test in `test/bin.test.js` asserts the key command did not
   run. `runBin` sets `METADATA_APP_PRIVATE_KEY`, which `resolveKey` prefers
   over `--metadata-key-command`, so the command never runs either way. The
   status and stderr assertions still catch a reordering. The older gh-login
   test has the same flaw. Fix: have `runBin` leave the variable unset for
   these two tests.
2. **The summary assertion reads the wrong stream.** The "a gh login is the
   owner" test matches `example/x` on stdout, but the summary goes to stderr.
   Stdout holds the dry-run commands, which also name `example/x`, so the
   assertion passes without pinning the summary. Fix: assert on stderr.
3. **No `init` regression test for `Repo-Tmpl`.** `checkName` is tested, but
   nothing runs the real copy and `init` for a module named `Repo-Tmpl` in nvim
   and zsh. The claim that they init cleanly was proved by hand. Fix: a test
   that materialises each template with that module and runs `init`.
4. **Message style.** The zsh runner message uses backticks where every other
   message uses double quotes. `notTemplate` says "init could not tell" where
   the two reworded module messages say "init cannot tell".

## Declined to judge

Behaviours the reviewer set aside and I ruled should stand. Each is a product
choice, not a defect, unless the cost below turns out to matter.

- **Other invisible characters are accepted:** U+2060, U+2061 to U+2064,
  U+00AD, U+061C, U+180E and the U+E0000 tag characters. Refusing them is a
  one-line change to `CONTROL` in `lib/args.js`. The cost of accepting them is
  a description that looks different from what it contains.
- **`Repo_Tmpl` is refused on a case-sensitive filesystem,** where it would
  work, because `repo_tmpl` in any case clashes with the underscore paths on a
  case-insensitive one.
- **`Repo-Tmpl` is accepted under an owner that already has `repo-tmpl`.**
  GitHub names are case-insensitive, so `gh repo create` fails after the local
  commit. This predates the latest branch.
- **Earlier rulings that stand:** Rust keyword binaries and Windows-reserved
  crate names are refused. There is no Dependabot entry for `templates/rust`
  (Dependabot supports `cargo`; this is a choice, not a limit). Dependabot
  support for mise is unverified.
- **History:** the spec change in its own commit (`cfab906`) was not rewritten.
  The cost is one untidy commit boundary.

## Not addressable from this repository

- A real case-insensitive filesystem needs a casefold mount (root).
- The triplicated `package.json` and README text across templates.
- The `commitizen` and `remark-cli` deprecation notices.
- 50-character header enforcement: `committed` 1.1.11 does not do it.
- The upstream commitlint regex lives in `chewygumxx/shared-config`, another
  repository.
- The native commitlint job, and mise 2026.9.0 to 2026.9.16, are unverified on
  GitHub; checking needs a real repository.

## Not done, by instruction

No version bump, tag or publish has happened since v2.1.1. The 24 commits since
the tag are on `origin/main` and not on npm.
