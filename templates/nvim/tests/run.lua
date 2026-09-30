-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/tests/run.lua
--
--

-- Runs every `tests/test_*.lua`. mini.test exits 0 when nothing failed, and a
-- run that collected nothing has nothing to fail, so an empty collection is an
-- error here.
--
--     nvim --headless -u tests/minimal_init.lua -l tests/run.lua

local MiniTest = require("mini.test")

local function find_files()
    return vim.fn.glob("tests/test_*.lua", true, true)
end

if #MiniTest.collect({ find_files = find_files }) == 0 then
    error("collected no tests under " .. vim.fn.getcwd() .. "/tests")
end

MiniTest.run({ collect = { find_files = find_files } })
