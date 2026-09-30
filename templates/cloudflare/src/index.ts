// vim:set expandtab shiftwidth=4 filetype=typescript:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/index.ts
//
//

export default {
    async fetch(request): Promise<Response> {
        const { pathname } = new URL(request.url);
        if (pathname === "/") return new Response("Hello, world!");
        return new Response("Not found", { status: 404 });
    },
} satisfies ExportedHandler<Env>;
