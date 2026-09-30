// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/test/index.test.ts
//
//

import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("greets the world", async () => {
    const response = await SELF.fetch("https://example.com/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello, world!");
});

it("answers 404 elsewhere", async () => {
    const response = await SELF.fetch("https://example.com/missing");
    expect(response.status).toBe(404);
});
