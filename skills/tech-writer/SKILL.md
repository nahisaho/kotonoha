---
name: tech-writer
description: >-
  Helps structure and polish technical documents: README, design docs/ADRs,
  API reference, PR descriptions/commit messages/issue reports, release
  notes/CHANGELOG, user manuals/how-to guides, and code comments/docstrings.
  Use for requests like "write a README", "draft a design doc", "write this
  PR description", "clean up my commit message", "make this how-to guide
  clearer", "write API docs", "summarize the release notes", as well as
  Japanese-language equivalents (「READMEを書いて」「設計ドキュメントを作って」
  「PRの説明文を書いて」「コミットメッセージを整えて」「手順書を分かりやすくして」
  「APIドキュメントを整備して」「リリースノートをまとめて」). Supports both Japanese
  and English documents, with Japanese as the primary target for polished,
  natural phrasing (pairing well with https://github.com/coji/natural-japanese
  for sentence-level Japanese refinement). Does NOT handle sentence-level
  naturalness, word choice, or rhythm ("AI smell" removal) — that is the
  domain of natural-japanese and similar prose-polishing skills. This skill
  is specific to a document's structure, information completeness, and
  reader fit.
license: MIT
argument-hint: "[write|review|score] [doctype] <target file or request>"
---

# tech-writer

Structures technical documents so readers reach the information they need
with the shortest path. Covers README, design docs/ADRs, API reference, PR
descriptions/commit messages/issue reports, release notes/CHANGELOG, user
manuals/how-to guides, and code comments/docstrings.

## Division of labor

Document quality splits into two layers: "is the structure right" and "is
the prose natural and readable". This skill owns the first layer (structure,
document type conventions, completeness, reader fit). The second layer
(sentence-level naturalness, removing "AI smell", rhythm) is out of scope and
belongs to a prose-polishing skill such as [natural-japanese](https://github.com/coji/natural-japanese).
When both skills are installed, use this skill to lock down the structure
first, then hand Japanese prose to natural-japanese for polish.

- Rule of thumb: "does removing a heading still make sense?" tests structure
  (this skill's job). "Does rereading a single sentence change its meaning?"
  tests prose (not this skill's job).
- Code comments/docstrings document code itself, but the same
  structure-and-completeness framing still applies.

## Execution modes

Infer the mode from the argument or the request:

- `write` (default): new document, or restructuring a draft. Runs the full
  §1–§3 workflow.
- `review`: structural review of an existing document. Does not rewrite;
  reports the gap against the doctype checklist (§4).
- `score`: structure-only quick diagnostic. Runs
  `scripts/lint.py --json <file>` and summarizes the findings (no rewrite).

If no mode is given, interpret "write/create" requests as `write`,
"fix/review" requests as `review`, and "how does this look?/diagnose"
requests as `score`.

## 1. Identify the reader and the goal

Before writing, pin down these three points. Ask the user if any is unclear.

1. **Reader**: who reads this (a first-time user, a fellow engineer, your
   future self, a decision-maker)? The reader determines how much prior
   knowledge you can assume.
2. **What the reader can do after reading**: can you state the document's
   goal in one sentence — "can get it running", "can make a decision", "can
   approve the review"? If not, the document's purpose itself isn't settled
   yet.
3. **Document type**: identify the doctype from the table below and read the
   matching reference file.

| Request | doctype | reference file |
|---|---|---|
| README / project overview | readme | `references/doctypes/readme.md` |
| Design doc / ADR / RFC | design-doc | `references/doctypes/design-doc.md` |
| API reference | api-docs | `references/doctypes/api-docs.md` |
| PR description / commit message / issue report | pr-commit | `references/doctypes/pr-commit.md` |
| Release notes / CHANGELOG | release-notes | `references/doctypes/release-notes.md` |
| User manual / how-to guide / tutorial | user-manual | `references/doctypes/user-manual.md` |
| Code comments / docstrings | code-comments | `references/doctypes/code-comments.md` |

For technical documents that don't fit any of these, apply only the general
principles in `references/style-constitution.md`.

## 2. Write — under the structure constitution

Write under the 8 rules in `references/style-constitution.md`. Summary: state
"what this is" and "the outcome for the reader" in the first three lines;
make headings labels that preview content (not "Overview", but "Overview of
what"); order steps as executed and put prerequisites before the steps;
one action per numbered step; put a concrete example or number right after
any abstract term; keep code examples minimal and runnable, marking
omissions explicitly; disclose known limitations and unsupported cases
instead of hiding them; and keep a last-updated date or target version in
the document.

When writing in Japanese, also prioritize concision and clarity on top of
the above: avoid overly long sentences, avoid double negatives, and don't
drop the subject (especially important in technical Japanese). Sentence-level
polish is left to a paired skill such as natural-japanese.

## 3. Review — structural check

After writing, work through the following in order:

1. **Skeleton read-through**: extract just the headings and the first
   sentence of each section, and confirm the argument holds together. If
   not, revisit how the headings are structured.
2. **Doctype checklist**: compare against the checklist at the end of the
   matching reference file.
3. **Structural lint**: where possible, run `uv run scripts/lint.py <file>`
   to mechanically catch heading-level skips, code blocks missing a
   language tag, leftover TODO/placeholders, and suspicious links. Findings
   are flags, not mandates — deliberate exceptions can stay; note the reason
   briefly.
4. **Reader-goal recheck**: confirm the "what the reader can do after
   reading" outcome from §1 is actually achievable from this document alone.

## 4. Doctype checklist summary

See each reference file for detail. Common items to confirm:

- Do the first three lines convey the purpose and target reader?
- Does reading only the headings trace the whole document's flow?
- Are prerequisites/dependencies stated before the usage steps?
- Can code/command examples be copied and run as-is?
- Are known limitations/unsupported cases/caveats stated, not omitted?
- (Where relevant) Is the version/last-updated date/target branch stated?

## Acknowledgment

The idea of separating structure from prose comes from
[natural-japanese](https://github.com/coji/natural-japanese) (MIT License)
and its design principle "machines detect, humans (or agents) judge" and
"prevent at generation time rather than fix afterward". This skill extends
that separation to the structural side of technical documents, deliberately
leaving prose naturalness out of scope.
