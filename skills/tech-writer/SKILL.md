---
name: tech-writer
description: >-
  Helps structure and polish technical documents: README, design docs/ADRs,
  API reference, PR descriptions/commit messages/issue reports, release
  notes/CHANGELOG, user manuals/how-to guides, code comments/docstrings,
  requirements definitions, system designs, technical proposals, RFI/RFP
  procurement documents, and Qiita/Zenn articles. Use for requests like
  "write a README", "draft a design doc", "define system requirements",
  "write a system design", "write a technical proposal", "draft an RFI",
  "create an RFP", "write this PR description", "clean up my commit
  message", "make this how-to guide clearer", "write API docs", "summarize
  the release notes", "write a Zenn article", "write this up for Qiita", as
  well as
  Japanese-language equivalents (「READMEを書いて」「設計ドキュメントを作って」
  「要件定義書を作って」「システム設計書を書いて」「技術提案書を書いて」
  「RFIを作って」「RFPを作って」「PRの説明文を書いて」
  「コミットメッセージを整えて」「手順書を分かりやすくして」
  「APIドキュメントを整備して」「リリースノートをまとめて」
  「Zennの記事を書いて」「Qiitaに投稿する記事を書いて」). Especially useful when
  the request is a bare goal without enough context to start (e.g. "I want
  to write a README" / "○○を書きたい"), since this skill drives a one
  question-at-a-time intake before writing. Supports both Japanese and
  English documents, with Japanese as the primary target for polished,
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
manuals/how-to guides, code comments/docstrings, requirements definitions,
system designs, technical proposals, RFI/RFP procurement documents, and
Qiita/Zenn articles.

Default format: Markdown for every doctype in this skill, except a git
commit message body (plain text by convention — light "-" bullets are
fine, but don't add Markdown headings or fenced code there) and code
comments/docstrings (the target programming language's own comment/
docstring syntax). Qiita and Zenn use Markdown with a platform-specific
YAML frontmatter and a few platform extensions on top — see their doctype
reference files.

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
  §1–§5 workflow, starting with the intake loop in §1 and ending only after
  the rubber-duck review loop has no remaining actionable findings. If an
  independent review cannot run or cannot converge, returns the explicit
  review status required by §5 instead of claiming a clean review.
- `review`: structural review of an existing document. Does not rewrite;
  reports the gap against the doctype checklist (§6).
- `score`: structure-only quick diagnostic. Runs
  `scripts/lint.py --json <file>` and summarizes the findings (no rewrite).

If no mode is given, interpret "write/create" requests as `write`,
"fix/review" requests as `review`, and "how does this look?/diagnose"
requests as `score`.

## 1. Gather context — one question at a time, then act

Requests are often bare goals ("I want to write a README", "○○を書きたい")
without enough context to start. Do not front-load a long questionnaire or
hand the user a checklist to fill in. Instead:

1. **Determine the doctype first**, from the table below. If the request
   itself doesn't make it clear, that ambiguity is your first question. If
   the table maps the request to `pr-commit`, resolve the **subtype** —
   commit message, PR description, bug report, or feature request — as
   part of this same first question: `references/doctypes/pr-commit.md`
   gives each a different skeleton and different musts, so don't proceed
   past this doctype without knowing which one applies. Similarly, a bare
   "write a tech blog post" request doesn't by itself say Qiita, Zenn, or
   neither — ask which platform (or "no platform, just a plain document")
   as part of this same first question. For a "technical proposal", ask
   whether it is an internal approval proposal or a supplier response to an
   RFP; only the internal approval proposal maps to `technical-proposal`.
   For a supplier response, structure the document against the supplied
   RFP's requirement IDs, requested proposal contents, pricing format, and
   contract deviations, then apply the general principles in
   `references/style-constitution.md`.
2. Open the matching reference file and note its target reader and any
   "settle before writing" items. Combined with the general musts below,
   this is your information checklist — but never show it to the user as a
   form.
3. **Ask exactly one question at a time**: pick the single most
   information-gaining missing item, ask only that, and wait for the
   answer before asking the next one. Never batch multiple questions into
   one message.
4. Stop asking once you have, at minimum: (a) the reader, (b) the
   one-sentence outcome the reader should reach after reading, (c) the
   doctype (and subtype, for `pr-commit`), and (d) any doctype-specific
   musts (e.g. the decision and alternatives for a design doc, the
   prior-knowledge floor for a user manual, breaking-change status for
   release notes, the related issue for a PR description or bug report,
   measurable acceptance conditions for a requirements definition, the
   approved requirements baseline for a system design, market unknowns for
   an RFI, or evaluation rules for an RFP).
5. **A "don't know" / "not applicable" / "no ticket for this" answer
   satisfies a must — it is not a reason to keep asking.** Ask that must
   at most once; if the answer is a non-answer, record it as a stated
   assumption or an open question inside the document itself (design docs
   already have an Open Questions section for this; for others, add a
   one-line note) and move on.
6. **Once complete, do not ask the user to compose anything.** Synthesize
   the gathered answers into the best possible generation approach yourself
   and immediately continue into §2–§5 in the same turn to produce the
   document. Skip further confirmation unless the doctype is release-facing
   and consequential (e.g. a public release note with breaking changes) or
   the user explicitly asked to see a plan first.
7. If the user already volunteered some of this information in the initial
   request, skip the corresponding question — don't re-ask what's already
   known.

| Request | doctype | reference file |
|---|---|---|
| README / project overview | readme | `references/doctypes/readme.md` |
| Design doc / ADR / RFC | design-doc | `references/doctypes/design-doc.md` |
| API reference | api-docs | `references/doctypes/api-docs.md` |
| PR description / commit message / issue report | pr-commit | `references/doctypes/pr-commit.md` |
| Release notes / CHANGELOG | release-notes | `references/doctypes/release-notes.md` |
| User manual / how-to guide / tutorial | user-manual | `references/doctypes/user-manual.md` |
| Code comments / docstrings | code-comments | `references/doctypes/code-comments.md` |
| Requirements definition / 要件定義書 | requirements-definition | `references/doctypes/requirements-definition.md` |
| System design / システム設計書 | system-design | `references/doctypes/system-design.md` |
| Internal technical proposal | technical-proposal | `references/doctypes/technical-proposal.md` |
| Request for information / RFI | rfi | `references/doctypes/rfi.md` |
| Request for proposal / RFP | rfp | `references/doctypes/rfp.md` |
| Zenn article | zenn | `references/doctypes/zenn.md` |
| Qiita article | qiita | `references/doctypes/qiita.md` |

For technical documents that don't fit any of these, apply only the general
principles in `references/style-constitution.md`, using the same
one-question-at-a-time intake for reader and outcome.

## 2. Outline first for long documents

For documents likely to run long — design docs/ADRs, user manuals with
multiple steps, API references covering several endpoints, requirements
definitions, system designs, technical proposals, RFI/RFP documents, or
anything the user calls
"long"/"detailed"/"comprehensive" — draft a table of contents (heading
outline) before writing any body prose.

1. Build the heading outline from the reader and outcome gathered in §1 and
   the doctype's recommended skeleton (in its reference file).
2. **Review the outline from the reader's point of view before writing
   further**: read only the headings, in order, as the reader identified in
   §1 would. Check whether they can predict what they'll learn from each
   section, whether the order matches how they'd naturally look for that
   information, and whether following the outline gets them to the
   §1 outcome. Reorder, merge, or split headings if not — this is cheaper
   to fix in outline form than after the prose is written.
3. Only once the outline holds up under that reader-perspective read-through
   should you write the body, section by section.

Skip this step for inherently short, atomic artifacts (a single commit
message, a short PR description, one new entry appended to an existing
release-notes/CHANGELOG file, a code comment/docstring) and draft directly
under §3 — see the scope note at the top of
`references/style-constitution.md`. This exception is about a single
*entry*, not the release-notes/CHANGELOG document as a whole: a CHANGELOG
being drafted or restructured from scratch is still a living, multi-section
document and needs the outline step below.

## 3. Write — under the structure constitution

For living, multi-section documents (README, design doc, API reference,
release notes, user manual, requirements definition, system design,
technical proposal, RFI/RFP, Zenn/Qiita article), write under the 8 rules
in `references/style-constitution.md`. Summary: state "what this is" and
"the outcome for the reader" in the first three lines; make headings
labels that preview content (not "Overview", but "Overview of what");
order steps as executed and put prerequisites before the steps; one
action per numbered step; put a concrete example or number right after
any abstract term; keep code examples minimal and runnable, marking
omissions explicitly; disclose known limitations and unsupported cases
instead of hiding them; and keep a last-updated date or target version
where staleness is a real risk. For Zenn/Qiita, rule 1's "first three
lines" maps to the frontmatter `title` plus the lead paragraph right
after it — see their doctype reference files for why there's no in-body
'#' title.

For atomic artifacts (commit messages, PR descriptions, issue reports,
code comments/docstrings, a single entry appended to an existing
release-notes/CHANGELOG file), follow their own skeleton in
`references/doctypes/pr-commit.md`, `references/doctypes/code-comments.md`,
or `references/doctypes/release-notes.md` instead — see the scope note in
`references/style-constitution.md` for why the 8 rules don't apply
verbatim there.

Sentence-level concerns — keeping individual sentences concise, avoiding
double negatives, not dropping the subject, and general naturalness — are
out of this skill's scope regardless of doctype. When natural-japanese (or
an equivalent prose-polishing skill) is available, hand Japanese prose to
it for that pass; otherwise apply ordinary careful-writing judgment, but
don't treat it as this skill's responsibility to enforce.


## 4. Review — structural check

After writing, work through the following in order. For atomic artifacts
(commit message, PR description, issue report, code comment/docstring, a
single appended release-notes entry), steps 1 and 4 collapse into simply
re-reading the short artifact against its own doctype skeleton — treat
step 2 as the primary check for those.

1. **Skeleton read-through, from the reader's seat**: extract just the
   headings and the first sentence of each section, and re-read them as the
   §1 reader would — not as the author. Confirm the argument holds together
   and nothing assumes knowledge that reader doesn't have yet. If not,
   revisit how the headings are structured (for long documents, this is the
   same lens as the §2 outline review, now applied to the finished prose).
2. **Doctype checklist**: compare against the checklist at the end of the
   matching reference file.
3. **Structural lint**: where possible, run `uv run scripts/lint.py <file>`
   (add `--atomic` for a commit message, PR description, issue report,
   code comment/docstring, or a single release-notes entry) to
   mechanically catch heading-level skips, code blocks missing a
   language tag, leftover placeholders, and suspicious links. Findings
   are flags, not mandates — deliberate exceptions can stay; note the reason
   briefly.
4. **Reader-goal recheck**: confirm the "what the reader can do after
   reading" outcome from §1 is actually achievable from this document alone.

## 5. Rubber-duck review loop — write mode only

After the structural review in §4, use the host's subagent mechanism to
launch an independent reviewer in the `rubber-duck` role to challenge the
completed document for meaningful problems that the authoring pass may have
missed. Prefer a registered `rubber-duck` agent when the host provides one;
otherwise use an independent general-purpose or critic-style subagent with
the same review prompt. Treat the reviewer as unavailable only when the host
has no independent subagent mechanism. Do not substitute the author's own
self-review: independence is the point of this pass. This loop is mandatory
for `write` mode; do not run it for `review` or `score` mode.

1. **Start the review with full context**: give the reviewer the target file,
   doctype, intended reader, one-sentence reader outcome from §1, and any
   explicit constraints or assumptions. Ask it to report concrete,
   actionable problems in correctness, logic, missing information, reader
   flow, examples, and stated limitations — not cosmetic preferences.
2. **Resolve every valid finding**: edit the document rather than merely
   listing proposed fixes. If a finding conflicts with a stated requirement
   or is factually inapplicable, record a one-line reason for declining it.
3. **Re-run the relevant checks after each edit round**: repeat the doctype
   checklist and structural lint from §4 before asking for another
   rubber-duck review. A fix must not introduce a new structural defect.
4. **Review again with the prior decisions**: reuse the same reviewer context
   when supported. Otherwise, include the previous findings, applied fixes,
   and declined findings with their reasons in every new review prompt. Ask
   specifically for unresolved or newly introduced actionable findings.
5. **Use a bounded convergence rule**: allow at most five rubber-duck rounds
   for a living, multi-section document. For an atomic artifact, run one
   round and finish immediately if it is clean; only continue after an
   actionable finding, with a maximum of three rounds. A round is clean only
   when no unaddressed actionable correctness, logic, completeness,
   reader-flow, example, or limitation findings remain. A finding declined
   with a recorded requirement-based or factual reason is a resolved
   exception rather than an open finding. If another round runs, supply that
   exception back to the reviewer under step 4. Purely cosmetic preferences
   are not actionable.
6. **Report non-clean outcomes precisely**: if the host has no independent
   reviewer, label the result `review not performed` and do not claim the
   rubber-duck pass completed. If the round limit is reached with
   unaddressed actionable findings, or findings oscillate between
   contradictory requirements, label it `review did not converge` and
   include the latest unresolved findings and fixes already attempted.

## 6. Doctype checklist summary

See each reference file for detail. The items below are for living,
multi-section documents (README, design doc, API reference, release notes,
user manual, requirements definition, system design, technical proposal,
RFI/RFP, Zenn/Qiita article). Atomic
artifacts (commit message, PR
description, issue report, code comment/docstring, a single appended
release-notes entry) are already covered by their own doctype checklist
via step 2 in §4 — these common items don't add extra requirements on top
of that. Common items to confirm:

- Do the first three lines convey the purpose and target reader?
- Does reading only the headings trace the whole document's flow?
- Are prerequisites/dependencies stated before the usage steps?
- Can code/command examples be copied and run as-is?
- Are known limitations/unsupported cases/caveats stated, not omitted?
- Where staleness is a real risk, is the version/last-updated date/target
  branch stated?

## Acknowledgment

The idea of separating structure from prose comes from
[natural-japanese](https://github.com/coji/natural-japanese) (MIT License)
and its design principle "machines detect, humans (or agents) judge" and
"prevent at generation time rather than fix afterward". This skill extends
that separation to the structural side of technical documents, deliberately
leaving prose naturalness out of scope.
