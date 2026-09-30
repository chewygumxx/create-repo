# @chewygumxx/create-repo

Creates a GitHub repository from the template bundled in this package, whose
first CI run passes, including the repository metadata sync.

```sh
npm create @chewygumxx/repo my-thing
```

It asks for anything not given as a flag, shows a summary, and on
confirmation copies the template, installs its toolchain with mise and its
dependencies with npm, rewrites its identity, and commits once
`npm run check` passes. Only then does it create the repository, set the
metadata App's `METADATA_APP_CLIENT_ID` variable and
`METADATA_APP_PRIVATE_KEY` secret, and push. A failure before that leaves
nothing on GitHub.

It needs Node 24 or later, `git`, `mise`, and `gh` logged in with
`gh auth login`.

Installed with `npm install` rather than run with `npm create`, npm may
report the package's `prepare` script as blocked. It only sets up this
repository's own development tooling and is never needed, so the notice is
safe to ignore.

## The template

`template/` is the whole template. A package version always creates the
same repository, and the first commit names the version that made it.

Its identity stays `chewygumxx/repo-tmpl`: `~chewygumxx/repo-tmpl.git` in every
file header and the slug in `.repo-metadata.jsonc` are what `lib/init.js`
finds and rewrites for each new repository. They look stale but are not, so
`.gitattributes` keeps the header sync out of `template/`.

Its `.gitignore` is stored as `_gitignore`, since npm drops nested `.gitignore`
files from the package, and is renamed back on copy.

## Development

`npm run check` runs the typecheck, the lint checks, `npm run lint:template`
(the template's own Biome rules) and the tests. The Create Repo workflow runs
`--dry-run` on the template, so it also catches the template drifting from
`lib/init.js` or failing its own `npm run check`.

To release, bump `version` in `package.json` and `package-lock.json`, commit,
and push a matching `v*` tag. The Publish workflow runs the check and the dry
run, then stages the version with `npm stage publish`; approve it on
npmjs.com to publish it.

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

The client ID is read from the `chewygumxx/create-repo` repository's
variable. The private key comes from the first of:

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
