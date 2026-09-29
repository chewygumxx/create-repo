# create-repo design

`npm create @chewygumxx/repo` creates a new GitHub repository from
[`chewygumxx/repo-tmpl`](https://github.com/chewygumxx/repo-tmpl) in one
command, so that its first CI run passes, including the repository metadata
sync.

The work spans three repositories:

| Repository    | Part                                                        |
| ------------- | ----------------------------------------------------------- |
| shared-config | `packages/create-repo`, published `@chewygumxx/create-repo` |
| repo-tmpl     | `scripts/init.mjs` and the `template.yaml` workflow         |
| `.github`     | A slug check in `sync-repo-metadata.yaml`                   |

## Decisions

- **Split.** The creator owns the GitHub side and the ordering. The template
  owns the edits to its own files in `scripts/init.mjs`, so a template change
  and its init change land in one commit and are tested by the template's CI.
- **First commit.** The creator makes an empty repository and pushes the first
  commit itself, rather than using `gh repo create --template`. GitHub's
  generated commit would still describe `chewygumxx/repo-tmpl`, fail
  commitlint, and race the creator's push. The cost is GitHub's "generated
  from" label; the commit message names the template instead.
- **Metadata App.** One GitHub App is installed on all repositories. Each new
  repository needs only the `METADATA_APP_CLIENT_ID` variable and the
  `METADATA_APP_PRIVATE_KEY` secret.
- **No dependencies.** Both scripts are plain ESM on Node's standard library,
  type-checked by `tsc` through JSDoc. The creator calls `gh`, `git`, `mise`
  and `npm`.

## Creator: `@chewygumxx/create-repo`

### Interface

```sh
npm create @chewygumxx/repo my-thing
npm create @chewygumxx/repo -- my-thing --description "…" --topics a,b \
    --scopes api,"cli:Command Line" --yes
```

| Argument or flag         | Default                            |
| ------------------------ | ---------------------------------- |
| `<name>`                 | Prompted                           |
| `--description`          | Prompted                           |
| `--topics`               | Prompted; may be empty             |
| `--scopes`               | Prompted; may be empty             |
| `--owner`                | The account `gh` is logged in as   |
| `--private`              | Public                             |
| `--dir`                  | `./<name>`                         |
| `--template`             | `chewygumxx/repo-tmpl`             |
| `--env-file`             | See below                          |
| `--metadata-key-file`    | None; `-` reads standard input     |
| `--metadata-key-command` | `CREATE_REPO_METADATA_KEY_COMMAND` |
| `--no-metadata`          | Off                                |
| `--dry-run`              | Off                                |
| `--yes`                  | Off                                |

A scope is `name` or `name:Full Name`. Missing values are prompted for only
when standard input is a terminal; otherwise a missing value is an error.
`--yes` skips the confirmation, not missing values.

### Metadata private key

The env-file, by default `~/.config/chewygumxx/create-repo.env` if it exists, is
loaded first with `process.loadEnvFile()`, without overriding variables
already set. The key is then taken from the first of:

1. `--metadata-key-file <path>`, or `-` for standard input
2. `METADATA_APP_PRIVATE_KEY`, the key itself
3. `METADATA_APP_PRIVATE_KEY_FILE`, a path
4. The output of `--metadata-key-command` or
   `CREATE_REPO_METADATA_KEY_COMMAND`, run through the shell

With none of these and without `--no-metadata`, preflight fails. Reading the
key from standard input requires every value as a flag, since prompts would
also need standard input.

The key must contain a `-----BEGIN … PRIVATE KEY-----` block. It is held in
memory, written only to the standard input of `gh secret set`, and never
printed or written to disk. `METADATA_APP_PRIVATE_KEY`,
`METADATA_APP_PRIVATE_KEY_FILE` and `CREATE_REPO_METADATA_KEY_COMMAND` are
removed from the environment of every child process except the key command
itself.

The client ID is read with
`gh variable get METADATA_APP_CLIENT_ID --repo <template>`; variables are
readable, unlike secrets.

### Steps

1. **Preflight.** `gh auth status` succeeds; `git` and `mise` are on `PATH`;
   the repository does not exist; the directory does not exist. The client
   ID and the key are read.
2. **Answers.** Prompt for missing values, print a summary, and confirm
   unless `--yes`.
3. **Copy.** `git clone --depth 1` the template into the directory, remove
   its `.git`, and `git init -b main`.
4. **Install and initialise.** `mise trust`, `mise install`, `npm ci`, then
   `node scripts/init.mjs` with the answers.
5. **Commit.** `npm run check`, then `git add -A` and commit
   `chore: Initialise from <template>`. The git hooks run.
6. **Create.** `gh repo create <owner>/<name> --source <dir> --remote origin`
   with `--public` or `--private` and the description, without pushing. Then
   `gh variable set` the client ID and `gh secret set` the key.
7. **Push.** `git push -u origin main`, then print the repository URL and
   the first CI run.

With `--no-metadata`, step 6 sets neither the variable nor the secret, and the
summary says the metadata sync will fail until they are set.

### Failures

A failure in steps 1 to 5 stops with a message; nothing exists on GitHub, and
the directory is left for inspection. A failure in steps 6 or 7 reports what
now exists on GitHub and the commands to finish or to remove it
(`gh repo delete`). The creator never deletes anything.

### Dry run

`--dry-run` runs steps 1 to 5 for real and prints the commands of steps 6 and
7 instead of running them. Preflight skips the checks that need GitHub, except
reading the client ID when `gh` is logged in. The key is still resolved and
validated, and `--no-metadata` works as usual.

### Layout

```text
packages/create-repo/
├── bin/create-repo.js   entry point: steps and failure reporting
├── lib/args.js          flags into answers
├── lib/prompt.js        terminal prompts and confirmation
├── lib/key.js           env-file, key sources, PEM check, child environment
├── lib/run.js           child processes with the filtered environment
├── lib/preflight.js     step 1 checks
├── test/*.test.js       node:test unit tests
├── package.json         bin create-repo, engines node >=22
├── README.md
└── LICENSE
```

## Template: `scripts/init.mjs`

### Interface

```sh
node scripts/init.mjs --owner chewygumxx --name my-thing \
    --description "…" --topics a,b --scopes api,"cli:Command Line"
```

### Edits

- **`.repo-metadata.jsonc`**: set `name`, `owner`, `slug`, `description` and
  `topics`, and delete the `is_template` line. Edits are made in the text, so
  comments and layout are kept.
- **`package.json`**: set `name`, `description`, `keywords` (the topics),
  `homepage` and `repository`.
- **`README.md`**: in the frontmatter, set `title`, `description`, `tags` and
  `ctime` (today), leaving `__cgxx` alone. In the body, set the `#` heading to
  the name, replace the intro paragraph with the description, and delete the
  "Using this template" section up to the next `##` heading.
- **`.commitlintrc.mts`**: append each scope after `claude` as
  `{ name, fullName, description }`. `fullName` is the given full name or the
  name capitalised; `description` repeats `fullName`.
- **Tidy-up**: run `npm run format`, then delete `scripts/init.mjs`,
  `scripts/` if empty, and `.github/workflows/template.yaml`.

Every edit locates a known key or text and fails if it is absent, so a
template change that init does not know about is an error, not a silent skip.

### Typechecking

`tsconfig.json` includes `scripts/**/*.mjs` with `checkJs`. A pattern that
matches nothing is not an error, so derived repositories need no change.

### Test: `.github/workflows/template.yaml`

Runs on push and pull request in repo-tmpl only, since init deletes it:

1. Copy the checkout to a temporary directory, `git init` it, and `npm ci`.
2. Run init with sample values.
3. Assert `npm run check` passes and a commit passes the git hooks.
4. Assert that `repo-tmpl`, `is_template` and "Using this template" appear
   nowhere outside file headers, and the sample values appear where expected.

### README

"Using this template" leads with `npm create @chewygumxx/repo` and keeps the
manual steps below it.

## `.github`: slug check

`sync-repo-metadata.yaml` gains a first step, before the App token is
created. It reads `slug` from the metadata file with `node`, after removing
whole-line `//` comments, and compares it with `github.repository`,
ignoring case. A mismatch fails the job with an `::error::` naming both. `v1`
then moves to the new commit.

## Publishing

- shared-config's commitlint gains a `create-repo` scope and its README a
  table row.
- 1.0.0 is published by hand, since npm accepts a trusted publisher only for
  an existing package. Its trusted publisher is then added with the stage
  publish permission, and later versions are staged by `publish.yaml`.

## Testing

- **Unit** (`node --test`, run by shared-config's `npm run check`): flag
  parsing with prompts faked; key source order, env-file loading and the
  standard-input conflict; the PEM check; the filtered child environment.
- **Dry run** in shared-config's CI against the published template, so
  creator changes are checked against repo-tmpl.
- **Template** workflow in repo-tmpl, so template changes are checked against
  init.
- **Smoke**, once, with approval: create `chewygumxx/create-repo-smoke`,
  confirm its first CI run passes including the metadata sync, then delete
  it (`gh auth refresh -s delete_repo`).

## Order of work

1. `.github`: slug check, then move `v1`.
2. repo-tmpl: `init.mjs`, `template.yaml`, the `tsconfig.json` pattern, and
   the README.
3. shared-config: `create-repo`, its tests, the dry run in CI, the commit
   scope and the README row.
4. Publish 1.0.0 by hand and add its trusted publisher.
5. Smoke test, then delete the scratch repository.
