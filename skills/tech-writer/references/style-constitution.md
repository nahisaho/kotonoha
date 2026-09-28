# Technical Document Structure Constitution (8 rules)

Constraints to fix a technical document's *structure* before writing.
Sentence-level naturalness, vocabulary, and rhythm are out of scope here
(→ the domain of a prose-polishing skill such as natural-japanese).

## 1. Say "what this is" and "the outcome" in the first three lines

Readers decide "is this relevant to me" within the first three lines. Don't
open with background or acknowledgments. State up front what the document is
for and what the reader can do after reading it.

- Bad (Japanese example): 「本プロジェクトは日々成長を続けており、多くの貢献者の協力により…」
- Good (Japanese example): 「kotonoha は技術文書の構成を整えるための Copilot スキルです。README・設計書・PR説明文などを型に沿って書けます。」

## 2. Make headings labels that preview content

Generic labels like "Overview", "Usage", "Notes" tell the reader nothing
until they read the body. Include *what* is being overviewed or used.

- Bad: `## Overview` `## Usage` `## Notes`
- Good: `## What kotonoha solves` `## Installing the skill into .github/skills` `## Behavior without sudachipy installed`

## 3. Order steps as executed, and put prerequisites before the steps

Readers execute a document top to bottom. Placing prerequisites
(dependencies, permissions, prior setup) mid-way or at the end forces
readers to redo work partway through. Always give prerequisites their own
section before the steps.

## 4. One action per numbered step

Don't pack multiple actions into one numbered item. "Install A, configure B,
and run C" should be three steps. Numbered steps let readers track exactly
where they are.

## 5. Put a concrete example or number right after an abstract term

Words like "fast", "safe", "flexible", "easy to understand" convey nothing
by themselves. Follow them immediately with a concrete number, condition, or
code example.

- Bad: "lint.py runs fast."
- Good: "lint.py processes a 10,000-character document in under 1 second (excluding sudachipy initialization)."

## 6. Keep code examples minimal and runnable; mark omissions explicitly

A code example that doesn't run as copy-pasted costs the reader time before
they realize it's broken. When omitting something, mark it explicitly (e.g.
`# ...`) and note that the reader should substitute their own values.

## 7. Disclose known limitations and unsupported cases; don't hide them

"Not yet supported" or "doesn't work under this condition" doesn't lower a
document's value — it prevents the reader's wasted effort. State it in its
own section instead of omitting it.

## 8. Keep a last-updated date or target version/branch in the document

A technical document starts going stale the moment it's written. A document
that doesn't say when or against what version it was written forces the
reader to pay an extra verification cost: "is this still accurate?"
