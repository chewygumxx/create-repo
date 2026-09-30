// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/index.test.ts
//
//

import assert from "node:assert/strict";
import { test } from "node:test";
import { greet } from "./index.ts";

test("greets the world by default", () => {
    assert.equal(greet(), "Hello, world!");
});

test("greets a name", () => {
    assert.equal(greet("Ada"), "Hello, Ada!");
});
