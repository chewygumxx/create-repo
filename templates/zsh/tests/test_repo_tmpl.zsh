#!/bin/false
# vim:set expandtab shiftwidth=4 filetype=zsh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/tests/test_repo_tmpl.zsh
#
#

# Each test runs in a subshell, after the runner has sourced the plugin.

# How many times the plugin's `functions/` is on `fpath`.
on_fpath() {
    local -a found=(${(M)fpath:#${plugin_root}/functions})
    print -r -- $#found
}

test_greets_the_world() {
    assert_equal "Hello, world!" "$(repo_tmpl)"
}

test_greets_each_argument() {
    assert_equal "Hello, Ada Lovelace!" "$(repo_tmpl Ada Lovelace)"
}

test_sourcing_twice_leaves_one_entry_on_fpath() {
    source $plugin_root/repo_tmpl.plugin.zsh
    assert_equal 1 "$(on_fpath)"
}

test_unloading_undoes_the_plugin() {
    assert_equal 1 "$(on_fpath)"
    repo_tmpl_plugin_unload
    assert_equal 0 "$(on_fpath)"
    assert_equal 0 ${+functions[repo_tmpl]}
    assert_equal 0 ${+functions[repo_tmpl_plugin_unload]}
    assert_equal 0 ${+Plugins[repo_tmpl_dir]}
}
