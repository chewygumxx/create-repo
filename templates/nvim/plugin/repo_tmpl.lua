-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/plugin/repo_tmpl.lua
--
--

if vim.g["loaded_repo_tmpl"] then
    return
end
vim.g["loaded_repo_tmpl"] = 1

---@param args vim.api.keyset.create_user_command.command_args
local function hello(args)
    local plugin = require("repo_tmpl")
    vim.notify(plugin.greet(args.fargs[1]))
end

vim.api.nvim_create_user_command("Hello", hello, {
    nargs = "?",
    desc = "Greet someone, or the world",
})
