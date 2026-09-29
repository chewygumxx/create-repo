#!/usr/bin/env bash
# vim:set expandtab shiftwidth=4 filetype=bash:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/scripts/test-init.sh
#
#

# Runs scripts/init.mjs on a copy of this repository, as
# `npm create @chewygumxx/repo` does, then stages, checks, commits and
# asserts the result. The copy is removed when everything passes, unless
# KEEP is set, and kept for inspection otherwise. Template-only: init deletes
# this script.
#
# The description has quotes, a colon, a bare URL and more than 80
# characters, so the README frontmatter's folded scalar, the body's links and
# its wrapping are exercised.

set -euo pipefail

src=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
tmp=$(mktemp -d)
derived=$tmp/derived

# shellcheck disable=SC2329 # Invoked by the trap below.
cleanup() {
    local rc=$?
    if ((rc == 0)) && [[ -z ${KEEP:-} ]]; then
        rm -rf -- "$tmp"
    else
        printf 'kept: %s\n' "$derived" >&2
    fi
}
trap cleanup EXIT

mkdir -- "$derived"

# Tracked and untracked files, not ignored ones, so a script not yet
# committed is tested too. node_modules and .husky/_ are ignored.
(
    cd -- "$src"
    git ls-files -z --cached --others --exclude-standard |
        xargs -0r cp -P --parents -t "$derived"
)

cd -- "$derived"
git init -q -b main

# Trust only this throwaway path, without touching mise's state directory,
# and put its pinned tools on PATH for everything below, git hooks included.
export MISE_TRUSTED_CONFIG_PATHS=$derived
eval "$(mise env --shell bash)"

npm ci --silent

node scripts/init.mjs \
    --owner example \
    --name derived-repo \
    --description 'Tests "init": a description with quotes, a colon, a link to https://example.com/docs, and enough words to wrap past eighty columns.' \
    --topics alpha,beta \
    --scopes 'api,cli:Command Line'

# Staged first: lint:md and lint:yaml read `git ls-files`.
git add --all
npm run check
git -c user.name="Template Test" \
    -c user.email=template-test@users.noreply.github.com \
    commit -q \
    -m "chore: Initialise from template" \
    -m "Generated from https://github.com/chewygumxx/repo-tmpl."

status=0
fail() {
    printf 'test-init: %s\n' "$1" >&2
    status=1
}

# File headers included: CI's header sync cannot rewrite workflow files.
if git grep -n -e repo-tmpl -e is_template -e 'Using this template'; then
    fail "template identity remains"
fi
grep -q '~example/derived-repo.git' .github/workflows/ci.yaml ||
    fail "ci.yaml header"
for path in scripts .github/workflows/template.yaml; do
    [[ ! -e $path ]] || fail "$path was not deleted"
done
[[ ! -e node_modules/jsonc-parser ]] || fail "jsonc-parser is still installed"
grep -q '"slug": "example/derived-repo"' .repo-metadata.jsonc ||
    fail ".repo-metadata.jsonc slug"
node -e '
    const p = require("./package.json");
    const ok = p.name === "derived-repo" &&
        p.repository === "github:example/derived-repo" &&
        p.keywords.join() === "alpha,beta" &&
        !("jsonc-parser" in (p.devDependencies ?? {}));
    process.exit(ok ? 0 : 1);
' || fail "package.json identity"
grep -qx 'description: >-' README.md || fail "README description scalar"
grep -qx '# derived-repo' README.md || fail "README heading"
grep -q 'fullName: "Command Line"' .commitlintrc.mts ||
    fail ".commitlintrc.mts scopes"

printf 'test-init: %s\n' "$( ((status == 0)) && echo passed || echo failed)"
exit "$status"
