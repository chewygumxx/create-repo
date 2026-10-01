// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/mise-task.js
//
//

// @ts-check

import { readFileSync } from "node:fs";

/**
 * The script of a mise task: the multi-line `run` string of
 * `[tasks."<name>"]`, with TOML's `\\` undone, so a test can run it.
 * @param {string} file
 * @param {string} name
 */
export function taskScript(file, name) {
    const text = readFileSync(file, "utf8");
    const header = `[tasks."${name}"]`;
    const start = text.indexOf(header);
    if (start < 0) throw new Error(`${name} is not in ${file}`);
    const section = text.slice(start + header.length).split(/^\[/m)[0];
    const match = /^run\s*=\s*"""\n([\s\S]*?)"""/m.exec(section);
    if (!match) throw new Error(`${name} has no multi-line run in ${file}`);
    return match[1].replaceAll("\\\\", "\\");
}
