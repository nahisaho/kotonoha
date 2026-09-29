# kotonoha

kotonoha provides GitHub Copilot CLI skills for technical documents and
presentation planning. `tech-writer` helps structure and polish README, design
docs/ADRs, API reference, PR descriptions/commit messages/issue reports,
release notes, user manuals/how-to guides, code comments, requirements
definitions, system designs, test plans, operations runbooks, migration plans,
security designs, technical proposals, RFI/RFP procurement documents, and
Qiita/Zenn articles,
structured so readers never get lost. `presentation-planner` turns source
material into a reusable presentation scenario, slide outline, design
specification, and handoff for a dedicated PPTX creation skill.

## What tech-writer solves

Technical documents tend to have two separate problems: "is the prose
natural" and "does the structure have the right amount of information".
`tech-writer` specializes in the latter and delegates the former
(sentence-level naturalness, reading load, terminology, and removing
"AI smell") to a prose-polishing skill such as
[natural-japanese](https://github.com/coji/natural-japanese). With both
installed, kotonoha locks the structure and technical invariants, invokes the
Japanese prose pass, then rechecks the structure before rubber-duck review.

## What it does

- Create/review README, design docs/ADRs, API reference, PR
  descriptions/commit messages/issue reports, release notes, user manuals,
  code comments, requirements definitions, system designs, test plans,
  operations runbooks, migration plans, security designs, technical proposals,
  RFI/RFP procurement documents, and Qiita/Zenn articles
- Doctype-specific structure and checklists to guide writing
- Optional `natural-japanese` integration for Japanese phrase lint,
  reading-load review, terminology checks, and iterative prose optimization
  without changing IDs, facts, tables, code, or acceptance criteria
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
| Request for information | RFI | `rfi` |
| Request for proposal | RFP | `rfp` |
| Technical article | Zenn article | `zenn` |
| Technical article | Qiita article | `qiita` |

Reusable templates are included for README, design decisions, user manuals,
PR descriptions, requirements definitions, system designs, test plans,
operations runbooks, migration plans, security designs, technical proposals,
RFI, RFP, and Qiita articles. Every supported doctype includes dedicated
structure guidance and a review checklist under
`skills/tech-writer/references/doctypes/`.

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

- GitHub Copilot CLI installed
- Python 3.9+ if you want to run the lint script (standard library only,
  no extra install needed)
- `uv` when using `natural-japanese` diagnostics such as phrase lint,
  reading-load analysis, outline extraction, and terminology checks

### Install from npm

Install the package, then copy all packaged skills into a skill directory
with the included CLI:

```bash
npm install --save-dev kotonoha
npx kotonoha install
```

### Install tech-writer and presentation-planner together

`kotonoha install` installs every packaged skill that is not already present.
The following commands install both `tech-writer` and
`presentation-planner` into `.github/skills/`:

```bash
npm install --save-dev kotonoha
npx kotonoha install --skill all
```

`--skill all` is the default, so `npx kotonoha install` has the same behavior.
Confirm that both skills were installed:

```bash
test -f .github/skills/tech-writer/SKILL.md
test -f .github/skills/presentation-planner/SKILL.md
```

If either directory already exists, the default command preserves it and
installs only the missing skill. To replace and update both installed skills
at once, review or back up local customizations first, then run:

```bash
npx kotonoha install --skill all --force
```

For Japanese sentence-level optimization, also install
`natural-japanese` using one of its supported installation methods:

```bash
npx skills add coji/natural-japanese
```

Ensure the installed skill is visible to Copilot CLI in the same registered
skill root used by this project, such as
`.github/skills/natural-japanese` or
`~/.copilot/skills/natural-japanese`. If the command installs it for a
different host, follow the upstream alternative installation instructions
and place or link the skill into a Copilot-visible skill directory.

If no compatible Japanese prose-polishing skill is registered, kotonoha
finishes the structural workflow and reports
`Japanese prose optimization not performed` instead of claiming that the
prose was optimized.

The default destinations are `.github/skills/tech-writer` and
`.github/skills/presentation-planner` in the current project. To install
only one skill, or use another supported skill directory:

```bash
npx kotonoha install --skill presentation-planner
npx kotonoha install --target .claude/skills
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
```

To update only one skill:

```bash
npx kotonoha install --skill tech-writer --force
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
git diff -- .github/skills
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
cp -r skills/tech-writer /path/to/your-repo/.github/skills/tech-writer
cp -r skills/presentation-planner /path/to/your-repo/.github/skills/presentation-planner
```

## Ask Copilot for the document you need

Just ask for the document type you need in a Copilot CLI session, and it's
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
skills/tech-writer/          # the skill itself
  SKILL.md                   # skill definition
  references/                # structure constitution + doctype rules/checklists
  references/doctypes/       # README, requirements/design/test/operations/migration/security, API docs, PR/issue, release notes, proposals, RFI/RFP, Qiita/Zenn
  scripts/lint.py            # structural lint script
  assets/templates/          # doctype skeletons including requirements, design, test, operations, migration, security, and procurement
skills/presentation-planner/ # storyline, design-spec, and PPTX handoff skill
  SKILL.md
  references/                # boundary, scenario/design guidance, customization, handoff contract
  assets/scenario-templates/ # executive, technical, and data-report narrative scenarios
  assets/design-templates/   # executive, technical, and data-report YAML designs
.github/skills/tech-writer   # symlink to skills/tech-writer (where Copilot CLI reads it)
.github/skills/presentation-planner
```

## Known limitations

- `scripts/lint.py` only detects structural issues (headings, code blocks,
  placeholders, links); it does not detect prose naturalness, vocabulary,
  or rhythm by itself. Those checks require a registered prose-polishing
  skill such as `natural-japanese`.
- The doctypes are written mainly with Japanese technical-writing
  conventions in mind; most of the guidance (especially the commit-message
  imperative-mood rule) applies directly to English documents as well.
- `presentation-planner` does not create or validate `.pptx` binaries by
  itself; a dedicated PPTX skill is required for generation and visual QA.
- Design customization is documented in
  `skills/presentation-planner/references/customizing-design-templates.md`.

## Acknowledgment

- [natural-japanese](https://github.com/coji/natural-japanese) (MIT
  License) — the design principle "machines detect, humans (or agents)
  judge" and "prevent at generation time rather than fix afterward"
  informed this project's design.

## License

MIT. See [LICENSE](./LICENSE).
