// vim:set expandtab shiftwidth=4 filetype=rust:
// SPDX-License-Identifier: GPL-3.0-only

//
//
// ~chewygumxx/repo-tmpl.git
// ::: :/src/lib.rs
//
//

#![warn(clippy::pedantic)]

/// Greets `name`.
///
/// ```
/// assert_eq!(repo_tmpl::greeting("world"), "Hello, world!");
/// ```
#[must_use]
pub fn greeting(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg(test)]
mod tests {
    use super::greeting;

    #[test]
    fn greets_by_name() {
        assert_eq!(greeting("world"), "Hello, world!");
    }
}
