-- vim:set expandtab shiftwidth=4 filetype=lua:
-- SPDX-License-Identifier: GPL-3.0-only

--
--
-- ~chewygumxx/repo-tmpl.git
-- ::: :/lua/repo_tmpl/init.lua
--
--

local M = {}

---@class repo_tmpl.Config
---@field greeting string The word the greeting opens with.

---@type repo_tmpl.Config
M.defaults = {
    greeting = "Hello",
}

---@type repo_tmpl.Config
M.config = vim.deepcopy(M.defaults)

--- Merges `opts` over the defaults. Calling it is optional.
---@param opts? repo_tmpl.Config
function M.setup(opts)
    M.config = vim.tbl_deep_extend("force", M.defaults, opts or {})
end

--- The greeting for `name`, or for the world.
---@param name? string
---@return string greeting
function M.greet(name)
    return ("%s, %s!"):format(M.config.greeting, name or "world")
end

return M
