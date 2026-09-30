-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/tests/test_repo_tmpl.lua
--
--

local MiniTest = require("mini.test")
local plugin   = require("repo_tmpl")
local eq       = MiniTest.expect.equality

local T = MiniTest.new_set({
    hooks = {
        pre_case = function()
            plugin.setup()
            vim.g["loaded_repo_tmpl"] = nil
        end,
    },
})

T["greets the world by default"] = function()
    eq(plugin.greet(), "Hello, world!")
end

T["greets a name"] = function()
    eq(plugin.greet("Neovim"), "Hello, Neovim!")
end

T["setup merges its options over the defaults"] = function()
    plugin.setup({ greeting = "Hi" })
    eq(plugin.greet(), "Hi, world!")
    eq(plugin.defaults.greeting, "Hello")
end

T["loading the plugin defines :Hello once"] = function()
    vim.cmd.runtime("plugin/repo_tmpl.lua")
    eq(vim.fn.exists(":Hello"), 2)
    eq(vim.g["loaded_repo_tmpl"], 1)
end

T["the help tags build"] = function()
    local source = vim.fn.readfile("doc/repo_tmpl.txt")
    local dir    = vim.fn.tempname()
    vim.fn.mkdir(dir, "p")
    vim.fn.writefile(source, dir .. "/repo_tmpl.txt")
    vim.cmd.helptags(dir)
    eq(vim.fn.filereadable(dir .. "/tags"), 1)
end

return T
