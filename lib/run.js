// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/lib/run.js
//
//

// @ts-check

import { spawn } from "node:child_process";

/**
 * @typedef {object} RunOptions
 * @property {string} [cwd]
 * @property {NodeJS.ProcessEnv} [env]
 * @property {string} [input] written to standard input, otherwise inherited
 * @property {boolean} [capture] collect output instead of showing it
 * @property {boolean} [shell] run `file` through the shell
 */

/** A command that could not start or exited non-zero. */
export class CommandError extends Error {
    /**
     * @param {string} command
     * @param {number | null} code
     * @param {string} stderr
     */
    constructor(command, code, stderr) {
        super(
            `${command} ${code === null ? "could not start" : `exited with ${code}`}${stderr.trim() ? `:\n${stderr.trim()}` : ""}`,
        );
        this.command = command;
        this.code = code;
        this.stderr = stderr;
    }
}

/**
 * @param {string} file
 * @param {string[]} args
 * @param {RunOptions} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function run(file, args, options = {}) {
    const { cwd, env, input, capture = false, shell = false } = options;
    const command = [file, ...args].join(" ");
    return new Promise((resolve, reject) => {
        const child = spawn(file, args, {
            cwd,
            env,
            shell,
            stdio: [
                input === undefined ? "inherit" : "pipe",
                capture ? "pipe" : "inherit",
                capture ? "pipe" : "inherit",
            ],
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.setEncoding("utf8").on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr?.setEncoding("utf8").on("data", (chunk) => {
            stderr += chunk;
        });
        child.on("error", (error) => {
            reject(new CommandError(command, null, error.message));
        });
        child.on("close", (code) => {
            if (code === 0) resolve({ stdout, stderr });
            else reject(new CommandError(command, code, stderr));
        });
        if (input !== undefined) child.stdin?.end(input);
    });
}
