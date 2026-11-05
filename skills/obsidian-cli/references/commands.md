# Official Obsidian application commands

Choose commands from installed help, then bind the Vault and file explicitly.
Target: kotonoha 0.5.3 development; checked 2026-11-05 against
[Obsidian CLI help](https://help.obsidian.md/cli).

## Discover syntax before operating

```bash
obsidian help
obsidian help read
obsidian help task
obsidian version
```

These are application commands, not the offline Python storage API. Even help
may start the app; obtain launch permission first. Parameter values use `=`;
flags such as `overwrite` have no value. Use an argument-array process API for
dynamic content, not interpolated shell source. CLI `\n`/`\t` handling differs
from literal text; verify exact bytes when content contains backslashes.

## Bind a Vault and an exact note

Replace `Lab`, `Notes/Trial.md` and the example values with authorized targets.
The examples assume Vault identity and scope were verified first.

Confirm the selected application's root before reading content:

```bash
obsidian vault="Lab" vault info=path
```

Compare it with the authorized absolute root and stop on any mismatch.
Do not enumerate all registered Vaults to resolve uncertainty without consent.

```bash
obsidian vault="Lab" read path="Notes/Trial.md"
obsidian vault="Lab" backlinks path="Notes/Trial.md" format=json
obsidian vault="Lab" links path="Notes/Trial.md"
obsidian vault="Lab" properties path="Notes/Trial.md" format=json
obsidian vault="Lab" tasks path="Notes/Trial.md" todo
```

Backlink results may name files outside the target note's scope; get permission
for those results before invoking the command. Never resolve a duplicate name
by choosing the first focused Vault or active note.

## Search, daily notes and Bases results

```bash
obsidian vault="Lab" search query="calibration" path="Research" limit=10
obsidian vault="Lab" daily:path
obsidian vault="Lab" base:query path="Views/Trials.base" view="Trials" format=json
```

The search example uses the folder-scoping `path` parameter; confirm its
support in installed help and authority for the whole Research folder.
Without that restriction search is Vault-wide. Bases queries may return all
Vault files regardless of the `.base`
file's location; consent must cover the effective filters/results. Never broaden
an authorized search just because the first query returned no matches.
`daily:path` returns an expected path even if the note does not exist; verify
existence and scope before using it. Do not run `daily` or `daily:append`
as shortcuts that implicitly create or open a note.

## Authorized note, property and task changes

Check installed help and inspect each target before these examples:

```bash
obsidian vault="Lab" create path="Notes/New trial.md" content="# New trial"
obsidian vault="Lab" append path="Notes/Trial.md" content="Next check: calibration."
obsidian vault="Lab" property:set path="Notes/Trial.md" name=status value=reviewed type=text
obsidian vault="Lab" task path="Notes/Trial.md" line=12 done
```

Task line numbers are source-dependent: reread the source, identify the exact
task and stop if it changed before the write. Property updates may reformat
frontmatter, and plugin hooks may change additional content. Disclose the exact
diff and require authority for those effects; refuse if preservation cannot be
verified. A requested append is not permission to normalize the whole note.
Do not use `overwrite`, `base:create`, `move`, `rename` or `delete` here.

## Authorized development diagnostics

Only in the selected disposable development Vault, after execution/capture
authority and plugin identity checks:

```bash
obsidian vault="Lab development" plugin:reload id=local-trial-plugin
obsidian vault="Lab development" dev:errors
obsidian vault="Lab development" dev:console level=error
obsidian vault="Lab development" dev:dom selector=".workspace-leaf" text
obsidian vault="Lab development" dev:css selector=".workspace-leaf" prop=background-color
```

Inspect the help for `dev:screenshot` before choosing an approved non-session
output path. DOM and error output can contain note content; scope it before
collection. `eval` executes JavaScript in the app, not an isolated expression
checker. Screenshots, console access and plugin reloads are optional; report
them as not performed when unavailable or unauthorized.
