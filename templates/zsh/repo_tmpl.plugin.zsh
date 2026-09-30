#!/bin/false
# vim:set expandtab shiftwidth=4 filetype=zsh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/repo_tmpl.plugin.zsh
#
#

# Handle $0 according to the Zsh Plugin Standard:
# https://wiki.zshell.dev/community/zsh_plugin_standard
0="${ZERO:-${${0:#$ZSH_ARGZERO}:-${(%):-%N}}}"
0="${${(M)0:#/*}:-$PWD/$0}"

# `$0` inside a function is the function's name, so the directory is kept where
# `repo_tmpl_plugin_unload` can find it, in the standard's `Plugins` array.
typeset -gA Plugins
Plugins[repo_tmpl_dir]=${0:h}

# `functions/` goes on `fpath` once, however many times the plugin is sourced.
if [[ ${zsh_loaded_plugins[-1]-} != */repo_tmpl && -z ${fpath[(r)${0:h}/functions]-} ]] {
    fpath+=("${0:h}/functions")
}

autoload -Uz repo_tmpl

# The standard's unload function: undoes everything the plugin did.
repo_tmpl_plugin_unload() {
    emulate -L zsh

    fpath=(${fpath:#${(b)Plugins[repo_tmpl_dir]}/functions})
    ((${+functions[repo_tmpl]})) && unfunction repo_tmpl
    unset "Plugins[repo_tmpl_dir]"
    unfunction repo_tmpl_plugin_unload
}
