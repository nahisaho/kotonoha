# Knap rendering and batch guide

Render original example data to stdout before choosing a save destination.
Target: kotonoha 0.5.3 development; checked 2026-11-05.
Requires a separately prepared Knap CLI and Node.js >=20.

## Use the bundled example

From this installed Skill's directory, validate and render:

```bash
knap validate assets/templates/source-note.knap.md
knap render assets/templates/source-note.knap.md --data assets/examples/source.json
```

The template uses `yaml_property` to emit a whole YAML property line, a
conditional for optional provenance and a normal Markdown heading.
`source.json` is synthetic input, not a fetched source or verified fact.
For untrusted titles, additionally review Markdown punctuation in the rendered
heading; YAML escaping does not escape Markdown.

## Choose typed input and one stdin consumer

```bash
knap render -t '# {{ title | trim }}' --data-json '{"title":"  Trial record  "}'
knap render assets/templates/source-note.knap.md --data assets/examples/source.json --set 'title=Revised trial record'
```

The first command prints `# Trial record`. `--set 'reviewed=false'` would
provide a string, not a boolean. JSON is required for nested values and
non-string types. Missing variables may render empty, so a syntax-valid
template can still produce an incomplete note.

When piping data, supply a template file or `-t` explicitly:

```bash
cat assets/examples/source.json | knap render assets/templates/source-note.knap.md --data -
```

Data must be an object for `render`. Wrap an array under a named object property
for a loop in a single document; use `batch` for one document per record.
Inspect `knap help tag for` and `knap help filter yaml_property` before adapting
the template. The CLI has no browser DOM or Web Clipper session variables.

## Preview CSV and JSON batches

Replace `/approved/staging/trials` with an approved, empty, non-session
directory outside the Vault. It must not be a symlink.

```bash
knap batch assets/templates/source-note.knap.md \
  --data assets/examples/sources.csv --output-dir /approved/staging/trials \
  --filename '{{ title | safe_name }}.md' --dry-run
```

Review the listed paths and rendered candidates. Only after explicit staging
authority, run the same command without `--dry-run`. Missing directories are
created by Knap; this does not authorize creating Vault folders.

JSON arrays use `--data records.json`; JSON folders use `--data /approved/json`.
With piped CSV use `--data - --format csv`. CSV values remain strings,
including `00123` and `false`; supply JSON for typed arrays or booleans.
Filename templates produce a single filename including its extension, never
directories. Duplicates (including case/normalization equivalents) fail even
with `--overwrite`. Existing files require overwrite permission, not an
automatic retry. This Skill deliberately uses empty staging instead.

`--dry-run` writes no files but checks current collisions; a later write can
still fail or race. Batch filesystem failures may leave some completed files.
The generated Markdown is still only a candidate, not saved Vault content.

## Render reviewed web extraction

Do not pipe a new URL straight to a final file. First use `defuddle` with
network authority, review its JSON and retain it only in an approved workspace.
Then render the approved JSON:

```bash
knap render assets/templates/source-note.knap.md --data /approved/work/article.json \
  --set 'source=https://example.com/field-report'
```

The `source` override must match the confirmed source; Defuddle's `domain`
is not a full source URL. Rendered remote images/embeds may later cause app
traffic. Review them before handing note preparation to `obsidian-markdown`;
its `obsidian-vault` backend handles only the authorized local save.
Do not assert metadata completeness or claim the extraction's statements are
true merely because rendering succeeded.

## Output and failure semantics

stdout is the default output; diagnostics and warnings use stderr. Exit 1
means failure, while exit 0 can still carry warnings. Do not discard stderr.
`-o`/`--output` creates parent directories and replaces a destination after
successful rendering. Shell redirection can truncate a file before rendering
even starts. Neither is used as a Vault save method.

## Language and tool references

- [Knap CLI](https://knap.md/cli)
- [Variables](https://knap.md/variables)
- [Filters](https://knap.md/filters)
- [Logic](https://knap.md/logic)
- [Source repository](https://github.com/obsidianmd/knap)
