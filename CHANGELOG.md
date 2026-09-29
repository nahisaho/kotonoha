# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add the `presentation-planner` skill for presentation requirements,
  storyline, slide outlines, design specifications, and PPTX-skill handoff.
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
[Unreleased]: https://github.com/nahisaho/kotonoha/compare/v0.1.2...HEAD
