# @chewygumxx/create-repo

Creates a GitHub repository from
[`chewygumxx/repo-tmpl`](https://github.com/chewygumxx/repo-tmpl) whose first
CI run passes, including the repository metadata sync.

```sh
npm create @chewygumxx/repo my-thing
```

It asks for anything not given as a flag, shows a summary, and on
confirmation copies the template, installs its toolchain with mise and its
dependencies with npm, runs the template's `scripts/init.mjs`, and commits
once `npm run check` passes. Only then does it create the repository, set the
metadata App's `METADATA_APP_CLIENT_ID` variable and
`METADATA_APP_PRIVATE_KEY` secret, and push. A failure before that leaves
nothing on GitHub.

It needs Node 22 or later, `git`, `mise`, and `gh` logged in with
`gh auth login`.

## Flags

```sh
npm create @chewygumxx/repo -- \
    my-thing \
    --description "…" \
    --topics a,b \
    --scopes api,"cli:Command Line" \
    --yes
```

Run with `--help` for every flag. Without a terminal, the name and
`--description` are required, topics and scopes default to none, and `--yes`
is required. `--dry-run` does everything locally and prints the GitHub
commands instead of running them. `--no-metadata` skips the App variable and
secret.

## The metadata App private key

The client ID is read from the template repository's variable. The private
key comes from the first of:

1. `--metadata-key-file <path>`, or `-` for standard input
2. `METADATA_APP_PRIVATE_KEY`, the key itself
3. `METADATA_APP_PRIVATE_KEY_FILE`, a path
4. The output of `--metadata-key-command` or
   `CREATE_REPO_METADATA_KEY_COMMAND`, such as `pass show github/metadata-app`

Variables may be set in an env-file, `~/.config/chewygumxx/create-repo.env` by
default or `--env-file`. Setting the command there once is enough:

```sh
CREATE_REPO_METADATA_KEY_COMMAND="pass show github/metadata-app"
```

The key is only ever written to the standard input of `gh secret set`. It is
not printed or stored, and the variables above are removed from the
environment of every other command it runs, including `npm ci`.
