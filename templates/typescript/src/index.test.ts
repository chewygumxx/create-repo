// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/index.test.ts
//
//

import { expect, test } from "bun:test";
import { greet } from "./index.ts";

test("greets the world by default", () => {
    expect(greet()).toBe("Hello, world!");
});

test("greets a name", () => {
    expect(greet("Ada")).toBe("Hello, Ada!");
});
