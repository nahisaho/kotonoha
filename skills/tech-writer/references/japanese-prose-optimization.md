# Japanese prose optimization handoff

Use this pass after a Japanese document's structure and required information
are complete. The goal is to remove mechanical or translated-sounding prose
without changing the document's approved meaning, obligations, evidence, or
traceability.

The preferred optimizer is the
[natural-japanese prose-polishing skill](https://github.com/coji/natural-japanese).
Kotonoha owns document structure and completeness; `natural-japanese` owns
sentence-level clarity, rhythm, word choice, reading load, and detection of
repeated AI-like phrasing.

## Run this pass when

- The body is primarily Japanese.
- The task is `write` mode.
- A registered `natural-japanese` or equivalent Japanese prose-polishing
  skill is available.

Skip it for English documents, generated machine-readable files, and source
code. For mixed-language documents, optimize only Japanese prose.

## Freeze these invariants

Give the prose optimizer the target file, doctype, reader, and intended
outcome. Require it to preserve:

- Heading hierarchy, section order, and doctype-required sections
- Requirement, risk, control, test, interface, and decision IDs
- Numbers, units, dates, proper nouns, citations, URLs, and source mappings
- Normative force such as Must / Should / May, approval states, and
  acceptance criteria
- Tables, code blocks, commands, schemas, frontmatter keys, and placeholders
- Explicit assumptions, limitations, residual risks, and unresolved items

Heading wording may improve only when its meaning and hierarchy stay intact.
Never trade technical precision for conversational phrasing.

## Optimization loop

1. Inspect the host's registered skill list for `natural-japanese` or a
   compatible Japanese prose-polishing skill. Invoke it through the host's
   skill-loading mechanism. If the host exposes only skill files, load that
   skill's `SKILL.md` and follow its workflow.
2. Ask the loaded skill to review and rewrite only the Japanese prose under
   the frozen invariants.
3. When `natural-japanese` diagnostics are available, use its documented
   technical genre (`lint.py --genre tech`), reading-load check
   (`lint.py --reading-load`), outline extraction (`outline.py`), and
   terminology/first-use check (`terms.py`).
4. Triage findings in context. Do not perform blind global replacements;
   retain a flagged expression when changing it would weaken precision or
   alter a defined term.
5. Re-run the optimizer's rubric and diagnostics after edits. One round is
   one kotonoha-to-optimizer handoff and its returned edits. Allow at most
   three rounds per §5 invocation; stop earlier when no actionable prose
   findings remain. A later rubber-duck edit opens a new invocation limited
   to the changed Japanese prose.
6. Compare the optimized document against the frozen invariants. Revert any
   violating edit, give the violated invariant back to the optimizer, and
   retry within the round limit. If the violation cannot be resolved, report
   `Japanese prose optimization did not converge`.
7. Re-run kotonoha's doctype checklist and structural lint before
   rubber-duck review.

## Required status

When this pass is in scope (a primarily Japanese document in `write` mode),
report exactly one status:

- `Japanese prose optimization completed`: the registered optimizer ran and
  no actionable prose findings remain. Run diagnostics when available; if
  `uv` or a diagnostic script is unavailable, note that limitation without
  changing this status.
- `Japanese prose optimization not performed`: no compatible optimizer was
  registered or loaded, so no prose review or rewrite ran; include the
  concrete reason.
- `Japanese prose optimization did not converge`: three rounds completed with
  unresolved actionable findings or invariant violations, or the optimizer
  started but failed before producing a valid result; list the findings,
  violations, failure, and attempted fixes.

Do not claim natural-language optimization based only on kotonoha's
structural lint. Documents outside the scope of this pass require no Japanese
optimization status.
