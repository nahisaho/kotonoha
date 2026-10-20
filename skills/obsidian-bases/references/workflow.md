# Bases workflow

Use this guide with the Skill's scope, byte-preservation and authority rules.
Standalone `.base` is YAML configuration over Vault files, not a separate
database. No Obsidian app, official CLI, MCP, Python or Vault storage API is
required for ordinary direct editing.

## Setup

Install only the requested Skill; existing installations require explicit
replacement authority. Do not overwrite local customizations without consent.

```text
npx kotonoha install --skill obsidian-bases
```

This defaults to Copilot's `.github/skills`. Add `--agent claude` for Claude
Code's `.claude/skills`, or `--agent all` for both. Resolve `<bases-dir>` from
the installed Skill in the selected root.

Installation copies authored assets and the canonical private lockfile, not
`node_modules`. Before dependency preparation explain the local installation
directory and possible package-registry traffic; get separate permission.
Use Node >=18 and the exact local scripts manifest/lock:

```text
npm ci --prefix <bases-dir>/scripts --ignore-scripts --no-audit --no-fund
```

For an explicitly offline preparation use:

```text
npm ci --prefix <bases-dir>/scripts --offline --ignore-scripts --no-audit --no-fund
```

These are alternatives, not automatic fallbacks. A cache miss does not authorize
online installation. The checker never prepares dependencies. Missing or wrong
local dependencies return exit 4 even if a parent/global module is available.
`--help` works without them. The fixed versions and supported JSON schema live
in [execution-contract.json](execution-contract.json), not a second config.

## Examples and paths

Example: "In /absolute/Vault, read Tasks.base only. Rename view index 0 from Tasks
to Active tasks and save; keep everything else unchanged." This can authorize
the exact ordinary name edit without a mandatory plan or repeated approval.
"Propose a base" or "show the diff before saving" never authorizes saving.

Example: "Use /absolute/Vault/Views as the working directory; create reading.base
with Cards for Markdown files in Reading. Show the settings before saving."
Confirm actual folder/property names and application version without assuming
permission to inspect every matching note. An example filter is a proposed
display scope, not a host reading permission.

User workdir takes precedence; otherwise use cwd at request start. Resolve its
relative form from that start and relative targets from the selected workdir.
Preserve absolute and explicitly Vault-relative paths. A directory choice is
not Vault authority. If the target's existing parent or allowed scope is missing,
stop instead of creating directories or saving elsewhere. Never substitute
session-state copies for the target.

## Check exact text

Use strict UTF-8 byte access; BOM must not disappear, invalid bytes must not
become replacement characters. Capture raw SHA-256 independently. Send JSON
through stdin safely, never interpolate document text into shell commands:

```json
{
  "schema_version": 1,
  "intent": "inspect",
  "document": "filters: 'file.ext == \"md\"'\nviews:\n  - {type: table, name: Notes, order: [file.name]}\n",
  "application_version": "1.14.0"
}
```

```text
node <bases-dir>/scripts/check.cjs --stdin
```

Use inspect for existing text and create/edit/proofread for the corresponding
candidate. The Report hash must match raw original bytes and exact candidate
write bytes respectively. No path, output-file, save, fix or evaluation flags
exist. The checker never reads a target or follows a formula's URL.

| Exit | Meaning | Action |
|---|---|---|
| 0 | Complete static processing; may contain cautions | Check static_checks_passed and every separate host/consent requirement |
| 1 | Invalid control or runtime failure | Not complete; no save |
| 2 | Known structure/reference problem or missing candidate views | Explain exact issues; no save |
| 3 | Unsupported feature, limit or unknown application version | Preserve original; diagnosis only |
| 4 | Local dependency or declared application capability insufficient | Report missing capability; no auto-install or save |

Reports always say read_only=true, authorization=not_assessed and
write_status=not_requested. They never certify saving, evaluation or rendering.
Non-parser issues identify a key/index path, not an invented source line;
YAML parser issues use 1-based line/column. Limit fallbacks explicitly retain
unprocessed root. A partial report is never all-file success.

## Supported edits and display consequences

Use `table.base`, `cards.base`, `list.base` and `kanban.base` from the sibling
assets/templates directory. They are independently authored proposals. Adapt
their scope/property names only with authority; do not claim they match real data.
Every view supports creation and name/display-order/filter edits. Kanban requires
its group property; group order and ASC/DESC can be intentionally edited.
Other minimum settings are defined in the contract; unknown extensions cause
whole-file editing refusal, even when only a known name would change.

`order` is display property order, not row sorting. Never infer undocumented
image, marker, sort or plugin keys. The expression subset is deliberately narrow:
unknown documented functions can still be unsupported in this checker.
Defined formula names and known property references are not proof of actual note
types; accepted ASTs are not executed.

Treat every filter/formulas change as potentially widening. Present the actual
before/after and save authority, without proving arbitrary set containment.
No filters means all Vault files when opened. Explain that before an unfiltered
creation or last-filter removal, and obtain authority for that exact content.
Global/view filters combine with AND. groupOrder can hide groups independently;
an empty groupOrder hides every group. Do not invent counts or reinterpret these
conditions as security controls.

## Save through host tools

Follow every numbered step in SKILL.md. Do not read forbidden paths to "verify"
them. Check authorized root-to-target identities, exact spelling, no symlinks,
no management paths, local regular files and preservable metadata. No xattrs or
multiple hard links; do not strip SELinux labels or other safety features.

Keep untouched bytes exactly, including comments, quoted values, key/view order,
spaces and CRLF. Do not round-trip YAML through a serializer. Duplicate names
need user-resolved index/content. A candidate that passes cannot repair an
unsupported/invalid original without changing the agreed scope.

Recheck current bytes and identity just before writing. Exclusive creation must
not overwrite an equivalent existing name. Edit only if the host can preserve
exact bytes, owner/group/modes. Re-read after saving; compare to validated bytes
and hashes. Tools that cannot verify these properties are insufficient.

On a possible partial write or readback mismatch, say the result is unknown.
Do not automatically retry, roll back, switch tools or report a fabricated CLI
receipt. Confirm the current target before requesting authority for remediation.
There is no CLI transaction/root lock/replay guard, and a final-check race remains.

## Proofreading and retention

Proofread selected name/displayName values only, through `japanese-prose`.
Obtain copy consent first: specify an external location, purpose, retention until
user deletion and cleanup of known files only. A workdir inside the Vault cannot
silently redirect copies to session storage. Ask for a suitable external place.
Keep immutable source bytes and a real nine-check semantic review for each
changed string; missing/stale/failed gates prohibit saving. Keep formula text,
identifiers, operators, numbers and all unselected spans unchanged.

Do not send source or diagnostic names to public logs, additional models or web
services without permission. Do not claim control over host conversation logs.
The caller's file tools and model must follow these instructions; no arbitrary
host sandbox or flawless semantic understanding is promised.
