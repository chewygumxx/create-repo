#!/bin/sh
# vim:set expandtab shiftwidth=4 filetype=sh:
# SPDX-License-Identifier: GPL-3.0-only

#
#
# ~chewygumxx/repo-tmpl.git
# ::: :/.claude/hooks/prohibit-em-dash.sh
#
#

jq -r '.tool_input.file_path // empty' | {
    read -r f
    [ -z "$f" ] && exit 0
    [ -f "$f" ] || exit 0
    grep -Iqn '—' "$f" && {
        echo "Em dash (U+2014) found in $f. Em dashes are prohibited in this repo; remove it." >&2
        exit 2
    }
    exit 0
}
