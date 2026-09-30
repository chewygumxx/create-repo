#!/bin/false
# vim:set expandtab shiftwidth=4 filetype=zsh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/tests/run.zsh
#
#

# Sources the plugin and every `test_*.zsh` under `tests/`, nested directories
# included, then runs each `test_*` function in a subshell of its own, so one
# test's changes reach no other. A test file that cannot be sourced fails the
# run, and so does a run that finds no test, which has nothing to fail.
#
#     zsh -f tests/run.zsh
#
# `-f` skips the startup files, so the machine's own configuration cannot
# change the result.

emulate -L zsh

# The plugin's directory, for the tests.
typeset -g plugin_root=${0:A:h:h}

# When the two differ, prints what was expected and ends the test, which runs in
# a subshell: a test's status is its last command's, so it would otherwise pass
# with an assertion failed before its end.
assert_equal() {
    [[ $1 == "$2" ]] && return
    print -rl -- "    expected: $1" "    actual:   $2" >&2
    exit 1
}

local -i failed=0
local file
for file in "$plugin_root"/tests/**/test_*.zsh(N); do
    source $file || {
        print -r -- "could not load $file" >&2
        ((failed++))
    }
done
source $plugin_root/repo_tmpl.plugin.zsh

local -a tests=(${(ok)functions[(I)test_*]})
if ((!$#tests)) {
    print -r -- "collected no tests under $plugin_root/tests" >&2
    return 1
}

local name
for name in $tests; do
    if ($name); then
        print -r -- "ok   $name"
    else
        print -r -- "FAIL $name"
        ((failed++))
    fi
done

print -r -- "${#tests} tests, $failed failed"
((!failed))
