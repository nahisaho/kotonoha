# kotonoha

kotonoha provides skills for GitHub Copilot and Claude Code: consulting analysis,
technical writing, Japanese prose, Obsidian workflows and presentation planning.
Turn evidence into documents, work with scoped Vault content, and prepare
presentations without mixing drafting with unauthorized saves.

`consulting-analyst` structures problems and evidence; `tech-writer` creates
reader-focused technical documents; `japanese-prose` improves Japanese wording
with GiNZA diagnostics. `presentation-planner` prepares scenarios, slide outlines
and design specifications for a dedicated PPTX creation skill.

The Obsidian suite covers Markdown syntax, authorized Vault notes, JSON Canvas,
Bases, official app commands, web/HTML extraction and JSON/CSV template rendering.
Each workflow keeps its own scope, dependency and save requirements.

Version: **0.5.7** (updated 2026-11-08), with eleven bundled Skills, including
`obsidian-markdown`, `obsidian-cli`, `defuddle` and `knap`.
Install the npm package or use the
[source-checkout installation](#install-skills-from-this-source-checkout).

[English](./README.md) | [日本語](./README-ja.md)

## Why the name kotonoha

`kotonoha` comes from the Japanese expression 言の葉 (*kotonoha*), a
classical and poetic name for words, language, and verse. The name reflects
this project's purpose: helping a reader's intent grow into clear,
well-structured words.

Its connection to the *Man'yoshu* needs one qualification. One traditional
interpretation reads the anthology's title as "countless words or poems,"
but the title's etymology is not settled. The famous explicit image,
"Japanese poetry takes the human heart as its seed and grows into myriad
leaves of words," is from the
[*Kokin Wakashu* Kana Preface](https://ja.wikisource.org/wiki/%E5%8F%A4%E4%BB%8A%E5%92%8C%E6%AD%8C%E9%9B%86%E4%BB%AE%E5%90%8D%E5%BA%8F),
not the *Man'yoshu*. The earlier *Man'yoshu* expresses a related belief in
the power of language through *kotodama*, including poems
[894](https://manyo-hyakka.pref.nara.jp/db/detailLink?cls=db_manyo&pkey=894)
and
[3254](https://manyo-hyakka.pref.nara.jp/db/detailLink?cls=db_manyo&pkey=3254).
The broader historical meaning of 言の葉 is summarized by
[Kotobank](https://kotobank.jp/word/%E8%A8%80%E3%81%AE%E8%91%89-503155).

## What tech-writer solves

Technical documents tend to have two separate problems: "is the prose
natural" and "does the structure have the right amount of information".
Kotonoha includes both layers. `tech-writer` owns structure and completeness;
the original bundled `japanese-prose` skill uses
[GiNZA](https://github.com/megagonlabs/ginza) to check sentence-level
naturalness, reading load, terminology, dependency depth, and repeated
AI-like patterns. Kotonoha locks the structure and technical invariants, runs
the Japanese prose pass, then rechecks the structure before rubber-duck
review.

## What it does

- Structure ambiguous business and technical problems with issue trees,
  hypotheses, evidence ledgers, Current–Target–Gap analysis, transparent
  decision matrices, and Pyramid Principle synthesis
- Create/review README, design docs/ADRs, API reference, PR
  descriptions/commit messages/issue reports, release notes, user manuals,
  code comments, requirements definitions, system designs, test plans,
  operations runbooks, migration plans, security designs, technical proposals,
  Blueprints, White Papers, RFI/RFP procurement documents, Obsidian notes
  and templates, and Qiita/Zenn articles
- Doctype-specific structure and checklists to guide writing
- Original GiNZA-based `japanese-prose` lint, reading-load review, terminology
  checks, and iterative prose optimization without changing IDs, facts,
  tables, code, or acceptance criteria
- Iterative rubber-duck review after document creation, with fixes and
  re-review until no actionable findings remain; unavailable reviews are
  reported as `review not performed`, while unresolved review loops are
  reported as `review did not converge`
- `scripts/lint.py` for mechanical structural checks (heading-level skips,
  code blocks missing a language tag, leftover placeholders, suspicious
  links, etc.); pass `--atomic` for commit messages, PR descriptions, issue
  reports, code comments, and single release-notes entries
- Markdown as the default format for every doctype, except a commit
  message body (plain text by convention) and code comments/docstrings
  (the target programming language's own syntax)
- Japanese as the primary target language, with English document support
- Draft Obsidian syntax and work with authorized Vault notes, Canvas diagrams
  and Bases configuration without changing unrelated content
- Use explicitly selected official Obsidian commands, optional Defuddle
  extraction and Knap data-driven rendering with separate consent and save gates

## Supported document types

| Document type | Examples | Doctype |
|---|---|---|
| Project overview | README | `readme` |
| Design decision | Design doc, ADR, RFC | `design-doc` |
| Requirements definition | 要件定義書, functional and non-functional requirements | `requirements-definition` |
| System design | システム設計書, architecture and detailed system design | `system-design` |
| Test planning | テスト計画書, test strategy and acceptance evidence | `test-plan` |
| Operations | 運用設計書, operations runbook, incident procedures | `operations-runbook` |
| Migration | 移行計画書, data and system cutover plan | `migration-plan` |
| Security | セキュリティ設計書, threat model | `security-design` |
| API reference | REST API, events, SDK reference | `api-docs` |
| Development workflow text | PR description, commit message, bug report, feature request | `pr-commit` |
| Release documentation | Release notes, CHANGELOG | `release-notes` |
| User guidance | User manual, how-to guide, tutorial | `user-manual` |
| Source documentation | Code comments, docstrings | `code-comments` |
| Internal technical proposal | Architecture, investment, and delivery proposal | `technical-proposal` |
| Future-state blueprint | Business, operating-model, data, and technology transformation blueprint | `blueprint` |
| Evidence-led publication | Technical or business White Paper | `white-paper` |
| Request for information | RFI | `rfi` |
| Request for proposal | RFP | `rfp` |
| Vault knowledge note | Obsidian note or reusable template | `obsidian` |
| Technical article | Zenn article | `zenn` |
| Technical article | Qiita article | `qiita` |

Reusable templates are included for README, design decisions, user manuals,
PR descriptions, requirements definitions, system designs, test plans,
operations runbooks, migration plans, security designs, technical proposals,
Blueprints, White Papers, RFI, RFP, Obsidian notes, and Qiita articles. Every supported
doctype includes dedicated structure guidance and a review checklist under
`skills/tech-writer/references/doctypes/`.

For Obsidian, copy
[`obsidian.md`](skills/tech-writer/assets/templates/obsidian.md) into your
vault's template folder and select that folder in the core Templates plugin.
Create and name an empty note, then run **Templates: Insert template**.
The template includes YAML properties, core title/date variables, wikilinks,
a callout, and a task; no community plugins are required. Kotonoha does not
configure your vault. See the [Obsidian guide](skills/tech-writer/references/doctypes/obsidian.md)
for setup, placeholder handling, and limitations.

## Working with an Obsidian Vault

Use `obsidian-markdown` to create or edit Markdown notes and templates. It uses
`tech-writer` for structure and coordinates Japanese proofreading with
`japanese-prose`. `obsidian-vault` is the shared backend for scoped local reads,
static validation, saving an already prepared candidate, authorized file/directory
operations and artifact imports.
Its direct-save path uses host file tools without Python, uv, Obsidian, MCP
or plugins.

Standalone convention inference, related-note recommendations, link analysis
and proofreading orchestration have been removed from `obsidian-vault`.
Use an explicitly selected `obsidian-cli` workflow for live-app search and
link inspection; it does not replace editorial recommendations.
The backend retains static observations/link evidence, the v1 request format
and Canvas storage API version 1 for compatibility, not the removed workflows.

The user explicitly selects the Vault, read scopes and model-context consent.
Direct editing requires authorization for the exact target and changes, preserves
unspecified content, refuses unsafe paths, and reads back the saved file.
A request for a proposal or pre-save approval never authorizes a write.
Direct edits use the user-specified working directory, or the current directory
at request start by default. Relative targets resolve there unless explicitly
Vault-relative; absolute targets stay unchanged. Edit the authorized target
itself, not a session-state copy. This does not broaden the permitted Vault scope;
auxiliary copies still need separate consent and a suitable location.
All Obsidian workflows prohibit saving operation files in session storage,
including originals, candidates, diagnostics, reviews, plans and temporary files.
If a selected directory resolves there, they ask for another location before
writing. Delegated skills receive the same restriction. CLI workspaces still
require a consented location outside the Vault, not in session storage.
This governs skill-directed files, not host-managed conversation logs.
Protected syntax checks and a hash-bound semantic review remain required for
Japanese proofreading in either mode.
Unresolved links are observations, not automatic repair requests.

Optional CLI plan-approved saving remains available for creation and proofreading,
not general content edits. Only `apply` writes in this mode, after exact plan
approval. It requires Linux, CPython 3.12 and uv, using
`uv run --offline --locked --python 3.12`; dependency bootstrap needs separate
consent. Direct edits do not use the CLI's root lock, atomic commit or receipt-based
replay protection, and must not be an automatic fallback from CLI failures.
See the [Japanese workflow guide](skills/obsidian-vault/references/workflow.md)
for requests, command examples, data retention and recovery.

Saving requires verifiable local regular files; symlinks and multiple hard
links are refused. Native Linux saves preserve ownership/modes.
Host direct saves also support native Windows and confirmed local Windows drives
through WSL (`drvfs`/`9p`/`v9fs`), not network shares. WSL OneDrive saves use
WSL-resolved paths, component types and file identity; cloud reparse metadata
is not a WSL symlink. Windows tag/final-path APIs are not required for otherwise
normal WSL files. Native Windows retains cloud-tag verification. Detected
redirections, symlinks, scope escapes and actual access denials remain blocked;
known hydration requires separate consent. Existing notes must be updated in place,
preserving Windows ACLs/attributes rather than replacing the file or requiring
synthetic Linux permissions. Path/identity checks and exact readback remain
mandatory; an unknown host replacement method is not sufficient.
No silent `/tmp` output may substitute for an authorized Vault update.
This profile, added in 0.5.4, does not extend Python CLI, Canvas or Bases support.
CLI saving still requires a verified Linux filesystem and refuses all xattrs,
including SELinux labels. Never remove attributes to bypass a refusal.
Direct-edit failure and concurrency limitations are disclosed before saving;
neither mode eliminates post-check external edits or LLM mistakes.
The skill is not a host sandbox. WSL host-visible checks are not an independent
Windows reparse audit or a guarantee against undetectable redirections.

Host operations also allow explicitly authorized directory creation and
regular-file creation, editing and deletion, not just Markdown/PDF outputs.
Each exact path/action needs authority; wildcard batches need approval after
scoped enumeration. Creation is non-overwriting, edits recheck source bytes and
identity, and deletion rechecks the exact file/hash then verifies absence.
OneDrive may sync deletions to other devices; recovery is not guaranteed.
Directory deletion, recursive removal, moves and renames remain outside this
workflow. Markdown proofreading and dedicated Canvas/Bases write gates remain
in force; the Python CLI gains no new commands.

Explicit PDF downloads and local Docling conversion outputs can be imported into
the authorized Vault working directory, including verified OneDrive paths.
Source/network/conversion authority and every output path must be specified;
directory selection alone grants no write permission. Imports use non-overwriting
creation and the same path/attribute checks, with separate consent for exact new
directories, sidecars and scratch locations. Docling is optional, not bundled or
auto-installed. Downloads and conversion are verified and reported separately
with output paths/hashes; Python CLI, Canvas and Bases support is unchanged.

## Working with Obsidian Canvas

The dedicated `obsidian-canvas` skill handles note maps, mind maps, conditional
workflows and evidence comparisons in JSON Canvas 1.0. It reads, diagnoses,
lays out and edits `.canvas` files without opening Obsidian or fetching URLs.
This feature is included in `kotonoha@0.4.2`.

Install `obsidian-vault` alongside it with storage API version 1. A selective
Canvas install does not silently add or replace siblings; an old backend
reports a missing dependency. Japanese proofreading additionally requires
`japanese-prose`. Runtime commands are locked and offline on Linux/Python 3.12.

Every changed plan binds exact content, authorized ID/field changes, persisted
evidence/proposal markings and the review. Selected text and labels require
per-string semantic reviews when proofreading. Only an explicitly approved
plan can save a single Canvas; source notes and attachments are unchanged.
Unknown structure is diagnosis-only. Rendering, arbitrary Obsidian extensions
and casefold filesystem behavior are not claimed as verified.
See the [Japanese Canvas workflow](skills/obsidian-canvas/references/workflow.md)
for scope, copying consent, partial results and uncertain-save recovery.

## Working with Obsidian Bases

`obsidian-bases` creates, reads, diagnoses and directly edits standalone `.base`
files for Table, Cards, List and Kanban. It does not change source notes,
Markdown properties or embedded base blocks. This feature is included in
`kotonoha@0.4.2`.

Authorized host tools save the exact target in the user-selected working
directory (cwd by default). A Node >=18 stdin checker only validates text:
no Vault paths, saving, expression evaluation or network. Prepare its private
fixed dependencies explicitly with separate consent, using
`npm ci --prefix <bases-dir>/scripts --ignore-scripts --no-audit --no-fund`;
add `--offline` for a separately selected cache-only preparation.
Installation ships the private lockfile but excludes dependency caches.

Every filter/formulas change needs exact content/save authority; unfiltered
display covers the whole Vault when opened. Unknown features, application version
or incomplete checks block saving. Direct edits have no CLI lock, atomic commit
or receipt protection. Rendering, real expression results and arbitrary host
enforcement remain unverified. See the [Bases workflow](skills/obsidian-bases/references/workflow.md)
for exact-byte preservation, four original templates and failure handling.

## Obsidian syntax, app commands and data-driven notes

The 0.5.7 Skills cover all six capability families in
[kepano/obsidian-skills](https://github.com/kepano/obsidian-skills), with original
kotonoha instructions and examples. Reference snapshot:
[`3ccff5338ea700537839b21900aa5358a0402c98`](https://github.com/kepano/obsidian-skills/tree/3ccff5338ea700537839b21900aa5358a0402c98),
checked 2026-11-05. This is capability coverage, not identical runtime support:
the existing Canvas/Bases validation subsets and approval rules remain intact.

| Capability | kotonoha Skill | Runtime and save boundary |
|---|---|---|
| Markdown notes and syntax | [`obsidian-markdown`](skills/obsidian-markdown/SKILL.md) | No external CLI; owns authoring/editing, coordinates Japanese proofreading and hands local I/O to `obsidian-vault` |
| JSON Canvas | [`obsidian-canvas`](skills/obsidian-canvas/SKILL.md) | Existing locked Python backend and approved single-Canvas plans; no new `json-canvas` install name |
| Bases | [`obsidian-bases`](skills/obsidian-bases/SKILL.md) | Existing read-only Node checker and authorized host saves |
| Official application CLI | [`obsidian-cli`](skills/obsidian-cli/SKILL.md) | Registered desktop CLI and app; explicit Vault/file targets and separate live-app authority |
| Web/HTML extraction | [`defuddle`](skills/defuddle/SKILL.md) | Optional Defuddle CLI, network consent including possible third-party requests; stdout or authorized external workspace |
| JSON/CSV templates | [`knap`](skills/knap/SKILL.md) | Optional Knap CLI with Node >=20; validate, render, preview and stage outside the Vault |

The application CLI is not `vault.py` and is never a fallback for a refused
storage operation. Its official setup currently requires installer 1.12.7+
and CLI registration in Settings > General. Commands can launch Obsidian;
launches, plugins, screenshots and developer execution need explicit authority.
Live Bases queries require consent for the effective result scope.
Canvas/Bases static checks do not prove application rendering or runtime results.

Defuddle can make asynchronous third-party requests even for local HTML.
It is not an assumed offline parser. Knap rendering does not fetch a source,
verify facts or authorize a save. Its batch workflow previews all output paths
and stages into an approved empty directory. `obsidian-markdown` prepares each
selected note, then hands local saving individually to `obsidian-vault`.
No new workflow permits session-storage outputs.
The installer prepares none of these optional tools or application settings.

Example requests:

```text
Explain heading/block links, nested callouts and YAML properties in this text.
Do not read a Vault or save a note.
```

```text
Using the official Obsidian app CLI, read Notes/Trial.md in my selected Vault.
Confirm the Vault identity and app-launch permission before running commands.
```

```text
Preview one Markdown note per CSV row with Knap. Use a consented staging
directory outside my Vault; show output paths before generating or saving.
```

See the [Markdown syntax](skills/obsidian-markdown/references/syntax.md),
[app commands](skills/obsidian-cli/references/commands.md),
[Canvas fields](skills/obsidian-canvas/references/json-canvas.md),
[Bases expressions](skills/obsidian-bases/references/expressions.md) and
[Knap examples](skills/knap/references/rendering.md).

## What consulting-analyst does

- Defines the decision-maker, decision question, outcome, scope, and evidence
  gaps before a document or presentation is written
- Selects the smallest useful framework set instead of filling frameworks
  mechanically
- Builds an issue tree and testable hypothesis/evidence ledger
- Supports Current–Target–Gap analysis and weighted option comparison with
  scoring anchors and sensitivity analysis
- Separates facts, estimates, assumptions, interpretations, and
  recommendations
- Produces a traceable synthesis handoff for `tech-writer` and
  `presentation-planner`

Example requests:

```text
Structure this business problem as an issue tree and identify the evidence
needed to answer each priority issue.
```

```text
Analyze the current and target states, identify the gaps, and prepare the
analysis for a Blueprint.
```

```text
Compare these alternatives using explicit criteria and prepare a White Paper
handoff without inventing missing evidence.
```

## What presentation-planner does

- Defines the audience, decision, call to action, and presentation constraints
- Produces a brief, audience-reasoning scenario, assertion-title slide outline,
  YAML design specification, and deterministic handoff for the host's PPTX
  creation skill
- Includes executive decision, technical briefing, and data report scenario
  templates
- Includes executive proposal, technical briefing, and data report design
  specifications
- Delegates `.pptx` generation, binary editing, rendering, and visual QA to
  the dedicated PPTX skill instead of duplicating it

## Setup

### Prerequisites

- GitHub Copilot (CLI or a supported IDE agent mode) or Claude Code installed
- Node.js 18+ and npm for the installer
- Optional tools only for their selected workflows: registered Obsidian
  desktop CLI, Defuddle, or Knap (Knap CLI requires Node.js 20+)
- Python 3.9+ for tech-writer's structural lint
- Python 3.10+ and `uv` for the edit-invariant gate and bundled GiNZA
  diagnostics such as prose lint,
  reading-load analysis, outline extraction, and terminology checks; `uv`
  resolves GiNZA, `ja_ginza`, and spaCy on first use

### Install Skills from this source checkout

All eleven Skills are available in this source checkout.
From the repository root, replace `/path/to/your-project` with the destination
project's absolute path and choose one command:

```bash
node bin/kotonoha.js install --agent copilot --target /path/to/your-project/.github/skills
node bin/kotonoha.js install --agent claude --target /path/to/your-project/.claude/skills
```

Both commands select all eleven Skills by default and preserve existing Skill
directories. To update an existing copy, review local changes first and add
`--force` only when replacement is intended. To select one Skill, add
`--skill obsidian-markdown` or another bundled name.
This copies Skill files only; it does not install Obsidian, Defuddle, Knap,
Python dependencies or the Bases checker's dependencies.

### Install a published package from npm

Install the package, then copy all packaged skills into a skill directory
with the included CLI:

```bash
npm install --save-dev kotonoha
npx kotonoha install
```

`npm install` installs the package only; it does not write to your agent's
skill directories or prompt you to choose an agent.

### Choose GitHub Copilot, Claude Code, or both

Agent selection requires kotonoha `0.5.0` or later. Older packages such as
`0.4.2` do not support `--agent`; update the npm package before using it.

```bash
npx kotonoha install --agent copilot   # .github/skills/
npx kotonoha install --agent claude    # .claude/skills/
npx kotonoha install --agent all       # both directories
```

The default is `--agent copilot`, preserving existing installations.
`--agent` chooses the destination agent(s); `--skill` chooses the bundled
skill(s). Both agents receive the same Skill files, scripts and templates.
The installer does not install either agent application, configure credentials,
or prepare Python/Node runtime dependencies for individual skills.

You can combine agent and skill selection:

```bash
npx kotonoha install --agent claude --skill tech-writer
npx kotonoha install --agent all --skill obsidian-bases
npx kotonoha install --agent all --force
```

Existing-directory protection and `--force` apply separately in each selected
root. An explicitly selected skill that already exists in either root blocks
the operation before any Skill is copied. A later filesystem/copy error can
still leave earlier copies installed; this is not a transaction across roots.

For one agent, `--target` overrides its default root. Combining `--target`
with `--agent all` is rejected; use separate commands for custom roots.

Agent selection controls file placement, not isolation: Copilot can also
discover `.claude/skills`. Installing for Claude does not prevent Copilot from
loading those files. See the official
[Copilot Skill locations](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
and [Claude Code Skills](https://code.claude.com/docs/en/skills).

### Install all bundled skills together

`kotonoha install` installs every packaged skill that is not already present.
For an installed published package, the explicit form is:

```bash
npx kotonoha install --skill all
```

`--skill all` is the default, so `npx kotonoha install` has the same behavior.
The selected package determines which Skills are available; version 0.5.7
includes all eleven. In the destination project, confirm they were installed:

```bash
test -f .github/skills/consulting-analyst/SKILL.md
test -f .github/skills/tech-writer/SKILL.md
test -f .github/skills/japanese-prose/SKILL.md
test -f .github/skills/obsidian-vault/SKILL.md
test -f .github/skills/obsidian-canvas/SKILL.md
test -f .github/skills/obsidian-bases/SKILL.md
test -f .github/skills/obsidian-markdown/SKILL.md
test -f .github/skills/obsidian-cli/SKILL.md
test -f .github/skills/defuddle/SKILL.md
test -f .github/skills/knap/SKILL.md
test -f .github/skills/presentation-planner/SKILL.md
```

If a directory already exists, the default command preserves it and installs
only the missing skills. To replace and update all installed skills at once,
review or back up local customizations first, then run:

```bash
npx kotonoha install --skill all --force
```

### Built-in Japanese prose optimization

Kotonoha includes its own `japanese-prose` skill, so no separate prose skill
installation is required. `npx kotonoha install` places it beside
`tech-writer`, allowing the writing workflow to run GiNZA-based prose lint,
reading-load checks, terminology extraction, outline inspection, and
iterative prose review locally. The implementation was developed from
scratch for kotonoha and does not include `natural-japanese` source code.
GiNZA dependency and license information is recorded in
`skills/japanese-prose/NOTICE.md`.

The lint also flags adjacent duplicate particles/words, Japanese bracket
mismatches, and polite/plain style mixing within a paragraph. Findings are
review targets, not automatic replacements. Use `proofread` mode for minimal
typo/grammar corrections without optional stylistic rewriting. The 0–100
score is a triage aid, not correction accuracy or a quality certificate.

Before editing, the workflow saves an immutable original. The bundled
`scripts/invariants.py` checks protected content and requires a hash-bound
semantic review of changed prose. Numbers, identifiers, code, tables, links,
and caller-supplied proper names/domain terms cannot be silently changed.
Mechanical equality alone does not establish preserved meaning. See
[`review-workflow.md`](skills/japanese-prose/references/review-workflow.md)
for the review format and gate exit codes.

You do not need to name GiNZA explicitly in a natural-language request.
Requests to make a Japanese document more natural, readable, concise, or less
formulaic invoke the bundled prose-optimization workflow. For example:

```text
Rewrite README-ja.md in natural, readable Japanese.
```

```text
Review this design document for unnatural Japanese, overly long sentences,
and repetitive AI-like phrasing, then fix the findings.
```

You can specify the intended mode more precisely:

- Edit the file: `Optimize the Japanese prose in README-ja.md.`
- Correct errors only: `Proofread README-ja.md; make minimal typo/grammar corrections without stylistic rewrites.`
- Review without editing: `Review the Japanese in README-ja.md, but do not modify the file.`
- Score only: `Score the Japanese prose in README-ja.md out of 100.`
- Run every diagnostic: `Run the full Japanese prose optimization workflow on README-ja.md.`
- Request GiNZA explicitly: `Analyze README-ja.md with GiNZA and improve dependency depth and reading load.`

When creating a new Japanese document, asking `Create a Japanese README for
this repository` lets `tech-writer` create and structurally review the draft,
then run the GiNZA-based prose pass before rubber-duck review. To require the
pass unambiguously, ask: `Create or revise <file> as a technical document and
run GiNZA-based Japanese prose optimization.`

The default destinations are `.github/skills/consulting-analyst`,
`.github/skills/tech-writer`, `.github/skills/japanese-prose`,
`.github/skills/obsidian-vault`, `.github/skills/obsidian-canvas`,
`.github/skills/obsidian-bases`, and
`.github/skills/presentation-planner` in the current project. To install only
one skill, or use another supported skill directory:

```bash
npx kotonoha install --skill consulting-analyst
npx kotonoha install --skill presentation-planner
npx kotonoha install --agent claude
npx kotonoha install --agent claude --target ~/.claude/skills
npx kotonoha install --target ~/.copilot/skills
```

An explicit `--skill <name>` install refuses to overwrite that existing
skill directory. Review or back up the existing installation, then pass
`--force` only when you intend to replace the selected skills:

```bash
npx kotonoha install --force
```

When installing all skills, existing skill directories are skipped and only
missing skills are added. This makes upgrading from a tech-writer-only
installation safe:

```bash
npx kotonoha install
# Skipped tech-writer (...)
# Installed consulting-analyst (...)
# Installed japanese-prose (...)
# Installed presentation-planner (...)
```

### Update kotonoha

First review and commit or back up any local changes under the installed skill
directories. Updating with `--force` replaces the complete selected
directories, including local customizations.

Update to the latest stable package:

```bash
npm install --save-dev kotonoha@latest
```

To test the current prerelease instead, install the `next` tag:

```bash
npm install --save-dev kotonoha@next
```

Installing the npm package does not automatically replace existing copied
skills. Reinstall all packaged skills after the package update:

```bash
npx kotonoha install --force
npx kotonoha install --agent claude --force
npx kotonoha install --agent all --force
```

Choose the command matching the original `--agent`; these are alternatives.
The first updates only the default Copilot destination.

To update only one skill:

```bash
npx kotonoha install --skill consulting-analyst --force
npx kotonoha install --skill tech-writer --force
npx kotonoha install --skill japanese-prose --force
npx kotonoha install --skill presentation-planner --force
```

If the original installation used another target, pass the same directory
again:

```bash
npx kotonoha install --target ~/.copilot/skills --force
```

Confirm the installed package version and review the replaced files before
committing them:

```bash
npx kotonoha --version
git diff -- .github/skills .claude/skills
```

Running `npx kotonoha install` without `--force` is safe but does not update
existing skill directories; it only installs skills that are missing.

### Install from a source checkout

Inside this repository, the skills are linked under `.github/skills/`, so no
extra setup is needed to use them with Copilot CLI here.

To use a skill from a source checkout in another project, copy its directory
into that repository's `.github/skills/`, `.claude/skills/`, or your global
`~/.copilot/skills/`.

```bash
cp -r skills/consulting-analyst /path/to/your-repo/.github/skills/consulting-analyst
cp -r skills/tech-writer /path/to/your-repo/.github/skills/tech-writer
cp -r skills/japanese-prose /path/to/your-repo/.github/skills/japanese-prose
cp -r skills/obsidian-vault /path/to/your-repo/.github/skills/obsidian-vault
cp -r skills/obsidian-canvas /path/to/your-repo/.github/skills/obsidian-canvas
cp -r skills/obsidian-bases /path/to/your-repo/.github/skills/obsidian-bases
cp -r skills/obsidian-markdown /path/to/your-repo/.github/skills/obsidian-markdown
cp -r skills/obsidian-cli /path/to/your-repo/.github/skills/obsidian-cli
cp -r skills/defuddle /path/to/your-repo/.github/skills/defuddle
cp -r skills/knap /path/to/your-repo/.github/skills/knap
cp -r skills/presentation-planner /path/to/your-repo/.github/skills/presentation-planner
```

## Ask Copilot or Claude Code for the document you need

Just ask for the document type you need in a Copilot or Claude Code session, and it's
invoked automatically.

- "Write a README", "Review this design doc", "Write the PR description",
  "Make this how-to guide clearer"
- "要件定義書を作って", "承認済み要件からシステム設計書を書いて",
  "移行計画とRunbookを作って"
- "Create a PPTX from this proposal", "Plan an executive presentation",
  "Design a technical briefing deck"

To run a quick structure-only diagnostic:

```bash
uv run skills/tech-writer/scripts/lint.py --json path/to/document.md
```

Without `uv`, `python3 skills/tech-writer/scripts/lint.py path/to/document.md`
works too (standard library only).

## Repository layout

```text
skills/consulting-analyst/   # problem structuring and evidence-led analysis skill
  SKILL.md                   # analysis workflow, safeguards, and handoff
  references/                # framework selection, evidence discipline, handoff contract
  assets/templates/          # brief, issue tree, evidence, decision, and synthesis artifacts
skills/tech-writer/          # the skill itself
  SKILL.md                   # skill definition
  references/                # structure constitution + doctype rules/checklists
  references/doctypes/       # README, requirements/design/test/operations/migration/security, API docs, PR/issue, release notes, proposals, Blueprints, White Papers, RFI/RFP, Qiita/Zenn
  scripts/lint.py            # structural lint script
  assets/templates/          # doctype skeletons including requirements, design, test, operations, migration, security, strategy, evidence-led publications, and procurement
skills/japanese-prose/       # original GiNZA-based prose optimization skill
  SKILL.md                   # writing, lint, review, and convergence workflow
  references/                # writing guidelines, review workflow, and scoring
  scripts/                   # prose lint, reading-load, outline, and terminology diagnostics
  NOTICE.md                  # GiNZA dependency and license information
skills/presentation-planner/ # storyline, design-spec, and PPTX handoff skill
  SKILL.md
  references/                # boundary, scenario/design guidance, customization, handoff contract
  assets/scenario-templates/ # executive, technical, and data-report narrative scenarios
  assets/design-templates/   # executive, technical, and data-report YAML designs
skills/obsidian-vault/       # scoped local read/validate/save backend and shared API
skills/obsidian-canvas/      # JSON Canvas diagnosis, layouts, and approved saves
  scripts/                   # locked offline CLI and original-fixture tests
  assets/templates/          # note map, mind map, workflow, comparison
skills/obsidian-bases/       # direct Bases configuration and read-only validation
  scripts/                   # stdin checker, private dependency lock, checkout-only tests
  assets/templates/          # Table, Cards, List, Kanban
skills/obsidian-markdown/    # note authoring/editing; local I/O uses obsidian-vault
skills/obsidian-cli/         # explicitly selected official live-app commands
skills/defuddle/             # optional web/HTML extraction, no direct Vault writes
skills/knap/                 # optional JSON/CSV rendering, preview and external staging
.github/skills/tech-writer   # symlink to skills/tech-writer (where Copilot CLI reads it)
.github/skills/consulting-analyst
.github/skills/japanese-prose
.github/skills/presentation-planner
.github/skills/obsidian-vault
.github/skills/obsidian-canvas
.github/skills/obsidian-bases
.github/skills/obsidian-markdown
.github/skills/obsidian-cli
.github/skills/defuddle
.github/skills/knap
```

## Known limitations

- `consulting-analyst` structures supplied or verified evidence but does not
  manufacture market data, customer facts, estimates, or citations.
- `skills/tech-writer/scripts/lint.py` detects structural and Markdown
  rendering issues. Prose naturalness, vocabulary, rhythm, and reading load
  are handled by the separately invoked but bundled
  `skills/japanese-prose` workflow and GiNZA diagnostics.
- The doctypes are written mainly with Japanese technical-writing
  conventions in mind; most of the guidance (especially the commit-message
  imperative-mood rule) applies directly to English documents as well.
- `presentation-planner` does not create or validate `.pptx` binaries by
  itself; a dedicated PPTX skill is required for generation and visual QA.
- Design customization is documented in
  `skills/presentation-planner/references/customizing-design-templates.md`.

## Acknowledgment

- [GiNZA](https://github.com/megagonlabs/ginza) (MIT License) — provides
  tokenization, part-of-speech tagging, dependency parsing, lemmatization,
  sentence boundaries, and named-entity recognition for kotonoha's original
  Japanese prose diagnostics.

## License

MIT. See [LICENSE](./LICENSE).
