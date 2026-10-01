# Address the remaining deferred minors (follow-up to the merge)

## Context

`address-remaining-minors` is merged into local `main` (1c0f64c, 14 commits
ahead of `origin/main`, nothing pushed, npm `latest` still 2.1.1). Its final
review left 10 deferred minors, one imprecise claim of mine, and several
behaviours the reviewer declined to judge. "Address aforementioned" is read as
those lists. It is not read as a request to push, bump, tag or publish: those
stay outside this plan and need a separate instruction.

Execution is the standing workflow: new branch off `main`
(`address-deferred-minors`), this plan committed to `docs/plans/`, inline TDD
(RED then GREEN, suite green), one granular commit per change (single-line
header at most 50 characters, scopes `claude`/`template` or none,
`npm run format` first, no em dash, `git status` after each commit), sdd
ledger, one fresh Opus whole-branch review, one test-first fix pass for
Critical/Important only, then the 3-option finish menu. A spec change is
committed with the behaviour it describes.

## Tasks (failing test first, then the change)

1. **Minor 2: owner message from a gh login.** `notTemplate(value, what, fix =
   "choose another")` in `lib/args.js` takes the remedy; `bin/create-repo.js`
   passes `pass --owner` for a login (the flag path keeps "choose another").
   Test in `test/bin.test.js`: login `repo-tmpl` stops with `/pass --owner/`.
2. **Minor 3 and the invisible characters: the control message.** The message
   shows the offender, `contains an invisible or control character (U+2028),
   which is not allowed.`, built from the matched code point (replaces
   "(a tab included)", which reads oddly for U+2028). `CONTROL` also gains the
   bidirectional overrides and isolates (U+202A-202E, U+2066-2069), which can
   reorder what a commit title or README shows, and U+FEFF. Test in
   `test/input.test.js`: each is refused in a description and a scope's full
   name, the message names its code point, and U+200B/200C/200D/200E/200F stay
   accepted. Spec wording updated in the same commit.
3. **Minor 4: `TEMPLATE_MODULE` over-refuses.** Tighten to
   `/^(?:repo-tmpl|[Rr][Ee][Pp][Oo]_[Tt][Mm][Pp][Ll])$/`: `repo-tmpl` only
   lowercase (it is what init's case-sensitive guard looks for and what
   `moduleName` would blind), `repo_tmpl` in any case (the case-insensitive
   filesystem clash with the underscore paths). Every path uses the
   underscore, so `Repo-Tmpl` and `REPO-TMPL` clash with nothing and are
   accepted. Message reworded to be true for both: `is the template's own, or
   differs from it only in case, which init cannot tell from a leftover`.
   Tests in `test/templates.test.js`: move `REPO-TMPL` to accepted and add
   `Repo-Tmpl`, `nvim-Repo-TMPL` (accepted); the existing refused names stay
   refused. Before committing, materialise nvim and zsh with module `Repo-Tmpl`
   in a temp directory and run init to prove the claim; ledger the result.
   Spec updated in the same commit.
4. **Minor 5: zsh `test` message.** A branch before the generic one for
   `ZSH_RUNNER` names and `test_*`: `is a name the template's test runner
   defines or runs`. Test in `test/templates.test.js`: `test`, `test_x`,
   `assert_equal`, `on_fpath` give that message.
5. **Minor 6: owner ordering and summary.** `test/bin.test.js`: a dry run with
   no `--owner` and no gh login, plus a key command, stops with `Cannot tell
   the owner` and the key command does not run; the "a gh login is the owner"
   test also asserts the summary shows `example/x`. Both pin existing
   behaviour, so no RED step, ledgered as such (a temporary mutation of the
   reorder proves the first one catches it).
6. **Minor 7: Dependabot test with no else.** An ecosystem with no rule fails
   (`no content rule for ecosystem X`). RED by a temporary
   `.github/dependabot.yml` entry for `cargo`, reverted with `git checkout`.
7. **Minor 8: `vimdocTags` test.** Add a prose line with a wide gap before a
   trailing tag and assert it is realigned, so the doc comment is exercised.
   Characterization: no RED step by design.
8. **Minor 9, Minor 11: documents.** Spec: join "A zsh plugin" to its sentence,
   and say the case-insensitive clash is the nvim `lua/repo_tmpl` directory or
   the zsh `repo_tmpl.plugin.zsh` and `functions/repo_tmpl` files, not a zsh
   directory. `docs/plans/2026-10-01-address-remaining-minors.md`: correct the
   claim that Dependabot has no cargo support (it has; the rust template has no
   entry by the earlier approved ruling).

## Rulings to ledger (no code)

- **Minor 10 (spec change in its own commit):** history is not rewritten. The
  commits are unpushed but rewriting is not worth the risk; this plan's spec
  edits go with their behaviour. Cost if wrong: one commit boundary is untidy.
- **Invisible characters:** bidi overrides/isolates and U+FEFF refused;
  U+200B, U+200C, U+200D (emoji sequences, Persian), U+200E and U+200F (RTL
  text) kept legal. Cost if wrong: a description with a BOM or a bidi
  override is refused; or one with ZWSP is accepted.
- **Rust keywords for binaries, Windows-reserved crate names, mixed-case
  `Repo_Tmpl` as a Rust binary, Dependabot support for mise:** earlier rulings
  stand, unchanged (the first two are product choices the reviewer declined to
  judge).

## Not addressable here (reported only)

Real case-insensitive filesystem (needs a casefold mount, root); triplicated
`package.json`/README text; `commitizen`/`remark-cli` deprecation notices;
50-character header enforcement by `committed` 1.1.11; the upstream commitlint
regex in `chewygumxx/shared-config` (another repository); the native
commitlint job and mise 2026.9.0 to 2026.9.16 on GitHub (needs a real
repository, which is outward-facing); push, version bump, tag, publish.

## Critical files

`lib/args.js`, `lib/templates.js`, `bin/create-repo.js`, the spec
(`docs/specs/2026-09-30-multiple-templates-design.md`), the old plan, and tests
`test/bin.test.js`, `test/input.test.js`, `test/templates.test.js`,
`test/dependabot.test.js`, `test/identity.test.js`. Reuse: `UsageError`,
`notTemplate`, `runWithKeyCommand`, the `runBin` stand-ins.

## Verification

Per task: the new test RED then GREEN where the task changes behaviour. At the
end: `npm run check` (currently 230/230, no Biome warnings), then one Opus
whole-branch review and one fix pass. The final message lists "Rulings I made"
and "Deferred minors" exhaustively, then the 3-option menu.
