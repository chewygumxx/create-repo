// vim:set expandtab shiftwidth=4 filetype=javascript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/create-repo.git
// ::: :/test/args.test.js
//
//

// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import {
    checkDescription,
    checkName,
    parseFeatures,
    parseOptions,
    parseTopics,
    UsageError,
} from "../lib/args.js";

test("reads the name and every flag", () => {
    const options = parseOptions([
        "my-thing",
        "--description",
        "D",
        "--topics",
        "a, b",
        "--scopes",
        "api,cli:Command Line",
        "--template",
        "standard",
        "--with",
        "a, b",
        "--owner",
        "someone",
        "--private",
        "--dir",
        "here",
        "--env-file",
        "e.env",
        "--metadata-key-command",
        "pass show k",
        "--dry-run",
        "--yes",
    ]);
    assert.deepEqual(options, {
        name: "my-thing",
        description: "D",
        topics: ["a", "b"],
        scopes: [
            { name: "api", fullName: "Api" },
            { name: "cli", fullName: "Command Line" },
        ],
        template: "standard",
        features: ["a", "b"],
        owner: "someone",
        visibility: "private",
        dir: "here",
        envFile: "e.env",
        metadataKeyFile: undefined,
        metadataKeyCommand: "pass show k",
        metadata: true,
        dryRun: true,
        yes: true,
        help: false,
    });
});

// It once named a GitHub repository; now it names a bundled template.
test("--template takes a bundled template's name, not a repository", () => {
    for (const name of ["a/b", "Standard", "x_y", ""]) {
        assert.throws(
            () => parseOptions(["--template", name]),
            (error) =>
                error instanceof UsageError &&
                /Invalid template/.test(error.message),
            name,
        );
    }
});

test("an empty --with is no features", () => {
    assert.deepEqual(parseOptions(["--with", ""]).features, []);
    assert.deepEqual(parseOptions(["--with", " , "]).features, []);
    assert.deepEqual(parseFeatures("lib, lib,bin"), ["lib", "bin"]);
});

test("defaults leave prompted values undefined", () => {
    const options = parseOptions([]);
    assert.equal(options.name, undefined);
    assert.equal(options.topics, undefined);
    assert.equal(options.visibility, "public");
    assert.equal(options.metadata, true);
    assert.equal(options.yes, false);
    assert.equal(options.template, undefined);
    assert.equal(options.features, undefined);
});

test("--no-metadata switches the metadata off", () => {
    assert.equal(parseOptions(["--no-metadata"]).metadata, false);
});

test("an empty --topics is an empty list, not a prompt", () => {
    assert.deepEqual(parseOptions(["--topics", ""]).topics, []);
});

test("accepts the names GitHub accepts", () => {
    for (const name of [".github", "a_b.c", "my--repo", "x".repeat(100)]) {
        assert.equal(checkName(name), name);
    }
});

test("rejects mistakes before anything is created", () => {
    for (const argv of [
        ["a", "b"],
        ["--unknown"],
        ["my thing"],
        ["a/b"],
        [".."],
        ["x.git"],
        ["x".repeat(101)],
        ["--topics", "Bad_Topic"],
        ["--topics", "x".repeat(51)],
        ["--scopes", "Api"],
        ["--owner", "-bad"],
        ["--owner", "some_user"],
        ["--topics", "a--b"],
        ["--scopes", "x".repeat(16)],
        ["--with", "Bad"],
        ["--with", "a b"],
    ]) {
        assert.throws(() => parseOptions(argv), UsageError, argv.join(" "));
    }
});

test("the key on standard input needs the name, description and --yes", () => {
    assert.throws(
        () => parseOptions(["x", "--metadata-key-file", "-", "--yes"]),
        /--description/,
    );
    assert.throws(
        () =>
            parseOptions([
                "x",
                "--description",
                "D",
                "--metadata-key-file",
                "-",
            ]),
        /--yes/,
    );
    const options = parseOptions([
        "x",
        "--description",
        "D",
        "--metadata-key-file",
        "-",
        "--yes",
    ]);
    assert.equal(options.metadataKeyFile, "-");
});

test("topics trim and drop empty items", () => {
    assert.deepEqual(parseTopics(" a ,, b "), ["a", "b"]);
});

test("topics drop duplicates, which GitHub would refuse", () => {
    assert.deepEqual(parseTopics("a,b,a"), ["a", "b"]);
});

test("more than 20 topics is a mistake, not a later sync failure", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `t${i}`);
    assert.equal(parseTopics(twenty.join()).length, 20);
    assert.throws(() => parseTopics([...twenty, "t20"].join()), UsageError);
});

test("descriptions are trimmed and must say something", () => {
    assert.equal(checkDescription("  A thing  "), "A thing");
    assert.throws(() => checkDescription(" "), UsageError);
    assert.throws(() => parseOptions(["x", "--description", ""]), UsageError);
});

test("descriptions the first commit would refuse are refused first", () => {
    assert.throws(() => checkDescription("Builds \u2014 and more"), /em dash/);
    assert.throws(() => checkDescription("Two\nlines"), /one line/);
    assert.throws(
        () => parseOptions(["x", "--description", "a \u2014 b"]),
        UsageError,
    );
});

// npm create consumed the `--` its documented forms needed. bun create
// drops one before the name, but passes one after it through, so
// `bun create @chewygumxx/repo x -- --template zsh` would otherwise read every
// flag as a positional.
test("one -- is dropped, before the name or after it", () => {
    for (const argv of [
        ["--", "x", "--template", "zsh"],
        ["x", "--", "--template", "zsh"],
    ]) {
        const options = parseOptions(argv);
        assert.equal(options.name, "x", argv.join(" "));
        assert.equal(options.template, "zsh", argv.join(" "));
    }
});
