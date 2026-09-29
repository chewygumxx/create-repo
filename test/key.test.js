// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/shared-config.git
// ::: :/packages/create-repo/test/key.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions, UsageError } from "../lib/args.js";
import {
    childEnv,
    DEFAULT_ENV_FILE,
    loadEnvFile,
    resolveKey,
} from "../lib/key.js";

const PEM =
    "-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----\n";
const OTHER = PEM.replace("MIIB", "MIIC");

/** @param {Record<string, string>} files */
function sources(files = {}) {
    /** @type {string[]} */
    const commands = [];
    return {
        commands,
        readStdin: async () => files["-"] ?? "",
        /** @param {string} path */
        readFile: (path) => {
            if (!(path in files)) {
                throw Object.assign(new Error(`ENOENT: ${path}`), {
                    code: "ENOENT",
                });
            }
            return files[path];
        },
        /** @param {string} command */
        runCommand: async (command) => {
            commands.push(command);
            return files[`$ ${command}`] ?? "";
        },
    };
}

test("--metadata-key-file beats every variable", async () => {
    const found = await resolveKey(
        parseOptions(["--metadata-key-file", "/k.pem"]),
        { METADATA_APP_PRIVATE_KEY: OTHER },
        sources({ "/k.pem": PEM }),
    );
    assert.deepEqual(found, { key: PEM, source: "/k.pem" });
});

test("--metadata-key-file - reads standard input", async () => {
    const options = parseOptions([
        "x",
        "--description",
        "D",
        "--yes",
        "--metadata-key-file",
        "-",
    ]);
    const found = await resolveKey(options, {}, sources({ "-": PEM }));
    assert.equal(found.source, "standard input");
});

test("METADATA_APP_PRIVATE_KEY beats the file variable and command", async () => {
    const found = await resolveKey(
        parseOptions([]),
        {
            METADATA_APP_PRIVATE_KEY: PEM,
            METADATA_APP_PRIVATE_KEY_FILE: "/k.pem",
            CREATE_REPO_METADATA_KEY_COMMAND: "pass show k",
        },
        sources({ "/k.pem": OTHER }),
    );
    assert.equal(found.key, PEM);
});

test("METADATA_APP_PRIVATE_KEY_FILE beats the command", async () => {
    const found = await resolveKey(
        parseOptions([]),
        {
            METADATA_APP_PRIVATE_KEY_FILE: "/k.pem",
            CREATE_REPO_METADATA_KEY_COMMAND: "pass show k",
        },
        sources({ "/k.pem": PEM }),
    );
    assert.equal(found.source, "/k.pem");
});

test("the command flag beats the command variable", async () => {
    const fake = sources({ "$ op read k": PEM });
    const found = await resolveKey(
        parseOptions(["--metadata-key-command", "op read k"]),
        { CREATE_REPO_METADATA_KEY_COMMAND: "pass show k" },
        fake,
    );
    assert.equal(found.key, PEM);
    assert.deepEqual(fake.commands, ["op read k"]);
});

test("no source names every way to give one", async () => {
    await assert.rejects(
        resolveKey(parseOptions([]), {}, sources()),
        (error) =>
            error instanceof UsageError && /--no-metadata/.test(error.message),
    );
});

test("a non-PEM key is refused without quoting it", async () => {
    await assert.rejects(
        resolveKey(
            parseOptions([]),
            { METADATA_APP_PRIVATE_KEY: "hunter2" },
            sources(),
        ),
        (error) =>
            error instanceof UsageError &&
            /METADATA_APP_PRIVATE_KEY/.test(error.message) &&
            !error.message.includes("hunter2"),
    );
});

test("an unreadable key file names the path", async () => {
    await assert.rejects(
        resolveKey(
            parseOptions(["--metadata-key-file", "/missing.pem"]),
            {},
            sources(),
        ),
        (error) =>
            error instanceof UsageError && /\/missing\.pem/.test(error.message),
    );
});

test("the env-file fills gaps without overriding", () => {
    /** @type {NodeJS.ProcessEnv} */
    const env = { KEEP: "mine" };
    loadEnvFile(
        env,
        "e.env",
        () => `KEEP=theirs\nMETADATA_APP_PRIVATE_KEY="${PEM.trim()}"\n`,
    );
    assert.equal(env.KEEP, "mine");
    assert.equal(env.METADATA_APP_PRIVATE_KEY, PEM.trim());
});

test("a missing default env-file is ignored, a missing named one is not", () => {
    const missing = () => {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    };
    /** @type {string[]} */
    const read = [];
    loadEnvFile({}, undefined, (path) => {
        read.push(path);
        return missing();
    });
    assert.deepEqual(read, [DEFAULT_ENV_FILE]);
    assert.throws(() => loadEnvFile({}, "e.env", missing), UsageError);
});

test("children never see the key variables", () => {
    const env = childEnv({
        PATH: "/bin",
        METADATA_APP_PRIVATE_KEY: PEM,
        METADATA_APP_PRIVATE_KEY_FILE: "/k.pem",
        CREATE_REPO_METADATA_KEY_COMMAND: "pass show k",
    });
    assert.deepEqual(env, { PATH: "/bin" });
});
