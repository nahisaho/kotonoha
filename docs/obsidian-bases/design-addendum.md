# Bases design corrections (v0.2)

This addendum and the execution contract supersede conflicting v0.1 design
wording. The approved requirements remain unchanged. Product implementation is
not authorized until the revised artifacts pass review and receive user approval.

## Raw-byte identity and host directory

The host must read exact source bytes, hash them independently, and decode UTF-8
strictly without stripping a BOM or normalizing newlines. Compare that raw-byte
SHA-256 with the source validator Report. If either is unavailable or differs,
stop. U+FFFD substitution is not an acceptable decode path. A preserved BOM
reaches the checker and is unsupported; a stripped BOM produces a hash mismatch.

Encode the final candidate with strict UTF-8, independently hash those exact
bytes, and compare with the candidate Report hash before saving. Write those
bytes and read back exact bytes/hash; use the unchanged pre-save source identity
and byte check from the original design. A text-only host that cannot establish
these guarantees must report not performed. Validator hashes never authorize
saving.

Use the user's working directory or the directory current at request start.
Resolve relative working directories from that start and relative targets from
the chosen directory, preserving explicitly Vault-relative or absolute paths.
Workdir choice does not authorize Vault access. Never substitute session-state
copies for final targets; auxiliary copies still require a suitable separately
consented location. Ask rather than silently using session storage when an
external proofreading workspace is needed.

## Display scope

Before saving an unfiltered base, explicitly explain that opening it displays
all Vault files; obtain authority for that exact unfiltered content and saving.
This also applies to removal of the last effective filter. Already explicit
content-and-save authority needs no repetitive approval. Filters do not enforce
host permissions. Distinguish global/view AND behavior from group visibility:
`groupOrder: []` hides all groups, and omission from a specified group order hides
those groups. Do not claim a filter result count or complete property types.
Do not evaluate expressions or fetch referenced notes/images to obtain counts.

## Classification and deterministic reports

The execution contract's `x-processing-order`, `x-early-report` and `x-counting`
are normative. They resolve previously unspecified schema failures and mixed
states. The Document schema is a final eligibility guard, not an error-to-code
translator: classify the specific source constraint before rejecting it.

| Condition | Code/category | Path and related |
|---|---|---|
| Wrong value type | invalid_type/format | Exact offending path; related empty |
| Missing view type/name or Kanban groupBy | missing_required/format | Path of missing key; related empty |
| Wrong ASC/DESC direction | invalid_enum/format | direction path; related empty |
| Initial-subset value/combination restriction | unsupported_value/unsupported | Exact restricted value path; related empty |
| Unknown key/view | unknown_key or unsupported_view/unsupported | Exact key/type path; related empty |
| Unaccepted expression/node/context/receiver | unsupported_expression/unsupported | Expression path; related empty |
| Unsupported operator/call/arity | unsupported_operator or unsupported_function/unsupported | Expression path; related empty |
| Missing formula/summary | formula_missing or summary_missing/expression | Referencing expression, order item, groupBy.property, properties key, or summary target/assignment path; related sorted unique missing names |
| Formula cycle | formula_cycle/expression | formulas path; related sorted component names |
| Unsupported YAML features | unsupported_yaml_feature/unsupported | Root; related empty |

Every unsupported issue adds its path to unprocessed, deduplicated and sorted.
Code/category/path/related for all remaining codes are fixed in existing
diagnostic cases, early defaults and boundary cases. Non-parser line/column
are null. Parser output is the first error only. Duplicate-name related fields
always point to the first equal name, never all prior matches.
The missing/empty-views operation check runs only on otherwise fully supported
documents. In particular, unknown-key resource fixtures without views emit no
additional no_views caution; their exact output-byte expectations are unchanged.

Check independently readable supported subtrees for local invalid/unsupported
issues. Never run version checks on invalid or unsupported documents. This
prevents a version error from requiring an impossible unsupported/4 Report.
Reference checks need accepted ASTs and a complete relevant definition namespace.
An unsupported formula expression still has a known definition name: do not
emit missing-reference errors for that name or claim its graph is complete.

The preparse delimiter limit is an independent safety cap, not AST depth.
Its exceedance is measured; an unexpected parser RangeError is runtime failure,
not evidence that a documented resource threshold was crossed.

## Resources and independent acceptance

The contract defines inclusive byte/node/depth/count limits and a bounded root
fallback for issue/output overflow. The fallback records incompleteness even
when known-invalid classification dominates. It never carries oversized keys.
Independent constructors and exact comparison rules are in
`boundary-cases.json`; do not derive them from product outputs.

`mean()` is accepted only with the direct `values` receiver in a custom summary,
with zero arguments. Negative context/receiver cases use unsupported_expression;
wrong arity uses unsupported_function. `**` parses in the selected jsep but is
unsupported_operator. Missing formula references are checked in display/group/
properties/summary target positions as well as expressions.

The supported function subset is intentionally narrow, not complete Bases
compatibility. Documented but unlisted calls such as `isEmpty` and `startsWith`,
UI-specific unknown keys and unknown sorting extensions force whole-file editing
refusal. They do not remove meaningful create/edit support from any of the four
views. Unknown application version also blocks saving, rather than guessing.

`scripts/verify.cjs` is a source-checkout acceptance runner and can read the
repository's `docs/obsidian-bases/` data. These docs are not a packed runtime
dependency. Packed-install startup and asset integrity are tested separately
from the checkout; installed users need not run a repository-only test runner.
No acceptance data is silently duplicated or fabricated on installation.

## Open approval state

The initial review identified B-D1 through B-D8. The user's approval of v0.1 was
received before these findings were disclosed; the user subsequently selected
fix-review-reapprove. This is not approval of revised artifacts. Record closure
only after actual mechanical verification and a bounded reviewer follow-up.
No release, commit, push or package publication is authorized by design approval.
