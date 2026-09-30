-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/tests/minimal_init.lua
--
--

-- The runtimepath and packpath of a test run: this plugin, Neovim's own runtime
-- and mini.test, and nothing from the machine's configuration or packages, so
-- a run means the same everywhere.
--
--     nvim --headless -u tests/minimal_init.lua -l tests/run.lua

local source    = debug.getinfo(1, "S").source
local root      = vim.fn.fnamemodify(source:sub(2), ":p:h:h")
local mini_test = root .. "/.tests/mini.test"

if vim.fn.isdirectory(mini_test) == 0 then
    local message = "mini.test is not installed at %s: run `mise run deps`"
    error(message:format(mini_test))
end

vim.o.runtimepath = table.concat({ root, vim.env.VIMRUNTIME, mini_test }, ",")
vim.o.packpath    = vim.env.VIMRUNTIME
