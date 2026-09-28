# kotonoha

kotonoha provides `tech-writer`, a GitHub Copilot CLI skill that helps
structure and polish technical documents. It covers README, design
docs/ADRs, API reference, PR descriptions/commit messages/issue reports,
release notes, user manuals/how-to guides, code comments, and Qiita/Zenn
articles, structured so readers never get lost.

## What tech-writer solves

Technical documents tend to have two separate problems: "is the prose
natural" and "does the structure have the right amount of information".
`tech-writer` specializes in the latter, leaving the former (sentence-level
naturalness, removing "AI smell") to a prose-polishing skill such as
[natural-japanese](https://github.com/coji/natural-japanese). With both
installed, lock down the structure with `tech-writer` first, then polish
Japanese prose with natural-japanese.

## What it does

- Create/review README, design docs/ADRs, API reference, PR
  descriptions/commit messages/issue reports, release notes, user manuals,
  code comments, and Qiita/Zenn articles
- Doctype-specific structure and checklists to guide writing
- `scripts/lint.py` for mechanical structural checks (heading-level skips,
  code blocks missing a language tag, leftover placeholders, suspicious
  links, etc.); pass `--atomic` for commit messages, PR descriptions, issue
  reports, code comments, and single release-notes entries
- Markdown as the default format for every doctype, except a commit
  message body (plain text by convention) and code comments/docstrings
  (the target programming language's own syntax)
- Japanese as the primary target language, with English document support

## Setup

### Prerequisites

- GitHub Copilot CLI installed
- Python 3.9+ if you want to run the lint script (standard library only,
  no extra install needed)

### Install

Inside this repository, the skill is already placed at
`.github/skills/tech-writer`, so no extra setup is needed to use it with
Copilot CLI here.

To use it in another project, copy the `skills/tech-writer` directory into
that repository's `.github/skills/`, `.claude/skills/`, or your global
`~/.copilot/skills/`.

```bash
cp -r skills/tech-writer /path/to/your-repo/.github/skills/tech-writer
```

## Ask Copilot for the document you need

Just ask for the document type you need in a Copilot CLI session, and it's
invoked automatically.

- "Write a README", "Review this design doc", "Write the PR description",
  "Make this how-to guide clearer"

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
  references/doctypes/       # README, design doc, API docs, PR/issue, release notes, manual, comments, Qiita/Zenn
  scripts/lint.py            # structural lint script
  assets/templates/          # skeleton templates for the main doctypes
.github/skills/tech-writer   # symlink to skills/tech-writer (where Copilot CLI reads it)
```

## Known limitations

- `scripts/lint.py` only detects structural issues (headings, code blocks,
  placeholders, links); it does not detect prose naturalness, vocabulary,
  or rhythm.
- The doctypes are written mainly with Japanese technical-writing
  conventions in mind; most of the guidance (especially the commit-message
  imperative-mood rule) applies directly to English documents as well.

## Acknowledgment

- [natural-japanese](https://github.com/coji/natural-japanese) (MIT
  License) — the design principle "machines detect, humans (or agents)
  judge" and "prevent at generation time rather than fix afterward"
  informed this project's design.

## License

MIT. See [LICENSE](./LICENSE).
