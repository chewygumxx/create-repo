// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/vitest.config.ts
//
//

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
});
