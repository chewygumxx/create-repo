-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/lua/repo_tmpl/health.lua
--
--

local M = {}

--- What `:checkhealth repo_tmpl` reports.
function M.check()
    vim.health.start("repo_tmpl")
    if vim.fn.has("nvim-0.10") == 1 then
        vim.health.ok("Neovim 0.10 or newer")
    else
        vim.health.error("Neovim 0.10 or newer is required")
    end
end

return M
