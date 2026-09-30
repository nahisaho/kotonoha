# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-09-30

### Added

- Add the `consulting-analyst` skill for issue trees, testable hypotheses,
  evidence discipline, Current–Target–Gap analysis, transparent option
  comparison, Pyramid Principle synthesis, and traceable handoff to writing
  and presentation skills.
- Add general-purpose Blueprint and White Paper doctypes with Japanese
  templates, intake guidance, responsibility boundaries, traceability,
  evidence controls, and review checklists.

### Fixed

- Require ASCII half-width spaces immediately before and after Markdown
  strong emphasis embedded in prose, and flag full-width, non-breaking, or
  tab spacing such as `これは　**「重要」**　と説明する`.

## [0.2.0] - 2026-09-29

### Changed

- Make Japanese prose optimization built in through kotonoha's original
  GiNZA-based `japanese-prose` skill, installed by the default
  `install --skill all` workflow.
- Generate Markdown with half-width spaces around `**strong emphasis**`
  whenever the delimiters would otherwise touch surrounding prose, and flag
  violations in the structural lint.
- Add a Qiita article template whose highest-level body sections use `#` and
  subsections use `##`.

### Added

- Add original GiNZA-based prose lint, reading-load analysis, terminology
  extraction, outline inspection, scoring, baseline comparison, writing
  guidelines, and convergence workflow without bundling third-party prose
  skill source code.
- Add `README-ja.md` as a complete Japanese guide and link it from the
  English README.
- Explain the meaning of the name `kotonoha` in both READMEs, distinguishing
  the *Kokin Wakashu*'s explicit "leaves of words" image from the related
  *kotodama* tradition in the earlier *Man'yoshu*.

## [0.1.5] - 2026-09-29

### Added

- Add a guarded Japanese prose-optimization handoff to `natural-japanese` or
  an equivalent registered skill, with invariant preservation, bounded
  convergence, structural revalidation, and explicit completion statuses.

## [0.1.4] - 2026-09-29

### Added

- Add Japanese requirements-definition and system-design templates with
  doctype routing, responsibility boundaries, traceability, and review
  checklists.
- Add Japanese test-plan, operations-runbook, migration-plan, and
  security-design/threat-model templates with dedicated doctype guidance
  and review checklists.
- Add the `presentation-planner` skill for presentation requirements,
  storyline, slide outlines, design specifications, and PPTX-skill handoff.
- Add executive decision, technical briefing, and data report presentation
  scenario templates plus a `presentation-scenario.md` planning artifact.
- Add executive proposal, technical briefing, and data report design
  specifications in YAML.
- Standardize presentation designs on white backgrounds with Microsoft
  corporate colors and accessible dark semantic text colors.
- Add a guide for adapting design specifications and adding reusable
  presentation templates.
- Add multi-skill installation with `kotonoha install --skill <name|all>`.
- Add Japanese templates for technical proposals, requests for information
  (RFI), and requests for proposal (RFP).
- Add doctype routing, writing guidance, and checklists for the three new
  templates.

## [0.1.2] - 2026-09-29

### Added

- Add a mandatory rubber-duck review loop to `write` mode. Generated
  documents are revised, structurally rechecked, and reviewed again until
  no actionable findings remain.
- Distinguish a missing independent reviewer (`review not performed`) from
  a review that reaches its round limit with unresolved findings
  (`review did not converge`).

## [0.1.1] - 2026-09-28

### Added

- Add the `kotonoha install` CLI for installing `tech-writer` into a
  project or user skill directory.
- Add `--target` for selecting a skill directory and `--force` for
  explicitly replacing an existing installation.
- Add automated tests for default installation, overwrite protection,
  forced replacement, and installation from the packed npm artifact.

### Changed

- Document separate npm and source-checkout installation workflows in the
  README.

## [0.1.0] - 2026-09-28

### Added

- Publish the initial `tech-writer` skill for structuring README files,
  design documents, API references, PR and issue text, release notes,
  user manuals, code comments, and Qiita and Zenn articles.
- Add structural linting for headings, code fences, placeholders, and
  suspicious links.

[0.1.2]: https://github.com/nahisaho/kotonoha/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/nahisaho/kotonoha/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/nahisaho/kotonoha/releases/tag/v0.1.0
[0.1.4]: https://github.com/nahisaho/kotonoha/compare/v0.1.2...v0.1.4
[0.1.5]: https://github.com/nahisaho/kotonoha/compare/v0.1.4...v0.1.5
[Unreleased]: https://github.com/nahisaho/kotonoha/compare/v0.1.5...HEAD
