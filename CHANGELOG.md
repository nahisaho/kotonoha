# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.7] - 2026-11-08

### Added

- Allow an approved tarball SHA-256 in the manual npm publishing workflow.
  Pack once, verify the supplied hash and publish that exact archive; stop
  before publishing if the artifact differs.

### Fixed

- Use WSL-visible path, type and file-identity checks for normal OneDrive host
  reads/saves instead of requiring Windows reparse-tag or final-path APIs.
  Cloud reparse metadata alone no longer blocks WSL operations. Keep detected
  redirection/access denials, source rechecks and in-place updates; retain
  native Windows tag verification and unchanged Python CLI/Canvas/Bases gates.

## [0.5.6] - 2026-11-07

### Added

- Allow authorized host directory creation and regular-file creation, editing
  and deletion, including verified OneDrive paths. Require exact path/action
  authority, non-overwriting creation, source rechecks and verified deletion.
  Disclose synced deletion and uncertain recovery; exclude directory deletion,
  recursive removal, moves and renames. Retain dedicated content save gates.

### Fixed

- Allow host saves on verified non-redirecting OneDrive cloud paths, including
  native Windows and WSL, instead of rejecting every reparse point. Retain
  identity, in-place updates, attribute preservation and hydration consent.
- Add an explicitly authorized host import workflow for PDF downloads and local
  Docling outputs in the selected Vault directory. Require exact output paths,
  non-overwriting creation, scoped scratch/directory consent and per-artifact
  verification. Keep Python CLI, Canvas and Bases storage support unchanged.

## [0.5.5] - 2026-11-06

### Fixed

- Separate authorized host reads from save-only checks so a OneDrive parent
  folder does not cause a blanket refusal. Require verified cloud reparse tags,
  in-scope file identity and local availability; retain access denials and
  explicit consent for hydration. Keep save policies unchanged.
- Scope `npm test` to kotonoha's `test` directory so Node's test runner does not
  try to execute the separate comparison project's Vitest TypeScript tests.

## [0.5.4] - 2026-11-05

### Changed

- Allow normal Markdown host direct saves on confirmed local Windows drives
  mounted through WSL (`drvfs`, `9p` or `v9fs`), without a filesystem-name-only
  refusal. Require in-place updates preserving the existing Windows file object,
  path/identity checks and exact readback. Do not silently redirect rejected
  Vault saves to `/tmp`. Keep Python CLI, Canvas and Bases storage policies unchanged.

## [0.5.3] - 2026-11-05

### Breaking changes

- Reduce `obsidian-vault` to scoped local reads, static validation and exact
  candidate saving. Remove standalone authoring, convention inference,
  related-note recommendations, link analysis and proofreading orchestration.
  Route note content to `obsidian-markdown`, Japanese wording to
  `japanese-prose` and explicitly selected live-app operations to `obsidian-cli`.
  Retain the v1 backend request format, validation/save gates and Canvas storage
  API version 1; legacy intent labels do not restore the removed workflows.
  See the [migration and storage guide](skills/obsidian-vault/references/workflow.md).

### Added

- Add `obsidian-markdown` for note authoring/editing, Obsidian-specific syntax,
  Japanese proofreading coordination and protected local-storage handoffs.
- Add `obsidian-cli` for explicitly selected official application commands,
  scoped note/task/property operations and authorized development diagnostics.
- Add `defuddle` for optional web/HTML-to-Markdown or JSON extraction, with
  separate network consent and reviewed handoffs instead of direct Vault writes.
- Add `knap` for optional JSON/CSV template rendering, batch previews and
  Vault-external staging, with original templates and example data.
- Add JSON Canvas field and Bases expression/view references, preserving the
  existing validation subsets and save workflows.
- Expose the Obsidian suite through source-checkout Skill links and verify
  selective installation plus npm-tarball delivery for both hosts.

### Changed

- Promote `0.5.3-dev.0` to stable `0.5.3`.
- Route all six capability families from `kepano/obsidian-skills` through
  eleven bundled kotonoha Skills without introducing a second Canvas writer.
  External tools remain optional and are not installed by kotonoha.
- Document npm and source-checkout installation for all eleven Skills.
  Keep the Node.js >=18 installer requirement; the optional Knap CLI needs >=20.
- Preserve existing Vault, Canvas and Bases save workflows, one-note handoffs
  and the prohibition on session-storage outputs. Official app commands require
  separate authority and never bypass a refused storage operation.

## [0.5.1] - 2026-10-21

### Fixed

- Prohibit session-storage outputs for all Obsidian Skills, including auxiliary
  files and delegated work. Ask for a non-session location before writing when
  necessary; retain Vault scope checks and external CLI workspace requirements.

## [0.5.0] - 2026-10-20

### Added

- Add explicit `kotonoha install --agent
  copilot|claude|all` selection for GitHub Copilot, Claude Code, or both.
  Keep the Copilot default and independent `--skill` selection.
- Preserve existing Skills in both roots, preflight explicit-skill conflicts
  before copying, and allow `--target` overrides for a single agent.

### Changed

- Document both hosts and their installation/update paths. Extend
  `tech-writer`'s prose Skill discovery to Claude project and personal roots.
- Keep npm installation free of automatic Skill writes or interactive setup.

### Fixed

- Shorten `tech-writer`'s description to the Agent Skills 1,024-character
  limit so hosts discover all seven bundled Skills. Add a regression check.

## [0.4.2] - 2026-10-20

### Added

- Add `obsidian-bases` for Table, Cards, List and Kanban configuration with direct
  authorized host edits, four original templates and a read-only stdin checker.
  Ship a private dependency lock, excluding dependency caches from installation.
- Add `obsidian-canvas` for scoped JSON Canvas diagnosis, four diagram
  templates, explicit edits, layout proposals and approval-gated saves.
- Add per-string semantic reviews for selected Canvas text and labels,
  persistent evidence/proposal markings, and original acceptance fixtures.

### Changed

- Allow explicitly authorized host-tool creation and editing of Vault Markdown
  notes without mandatory CLI plans. Keep CLI plan-approved saving optional,
  preserve proofreading checks, and distinguish direct-edit failure guarantees.
- Use the user-specified directory, or the current directory by default, for
  Vault direct editing. Modify the authorized target itself rather than a
  session-state copy; retain Vault scope and auxiliary-copy consent checks.
- Rewrite the `obsidian-vault` Skill entrypoint in concise English to reduce
  loading tokens while preserving its operating and safety rules.
- Share authorized storage and atomic commit primitives with `obsidian-vault`
  while preserving its Markdown CLI contract. Existing unapplied plans must
  be regenerated and approved after updating the implementation.

## [0.4.1] - 2026-10-19

### Added

- Add an Obsidian knowledge-note template and doctype guide with core
  Templates variables, YAML properties, wikilinks, a callout, and tasks.
- Add an independent `obsidian-vault` skill for scoped convention discovery, note
  creation, related-note suggestions, link diagnosis and approval-gated
  Japanese proofreading saves on Linux local files.
- Add a locked offline launcher, content-bound plans and success receipts,
  protected Obsidian syntax, and an independent 100-note acceptance fixture.

### Changed

- Rename the development Skill from `obsidian` to `obsidian-vault`, including
  its installation name and `test:obsidian-vault` runner. Historical approval
  records retain their original paths; the execution contract is relocated
  without changing its approved bytes.

## [0.4.0] - 2026-10-19

### Added

- Add duplicate-particle/word, Japanese bracket, and paragraph style-mixing
  diagnostics, plus a minimal-edit `proofread` skill mode.
- Add a Markdown-aware invariant gate with protected-content checks and
  required hash-bound semantic review of edits.

### Fixed

- Avoid treating obligation expressions as double-negative errors and
  conclusion questions as formulaic assertions.
- Keep shorter fence markers and fence-like info strings inside code blocks
  out of prose diagnostics.
- Require the invariant gate and current semantic review to pass before
  claiming Japanese prose optimization completed.

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
[0.4.2]: https://github.com/nahisaho/kotonoha/compare/d76ef4a...v0.4.2
[0.5.0]: https://github.com/nahisaho/kotonoha/compare/v0.4.2...v0.5.0
[0.5.3]: https://github.com/nahisaho/kotonoha/compare/d665884...v0.5.3
[0.5.4]: https://github.com/nahisaho/kotonoha/compare/v0.5.3...v0.5.4
[0.5.5]: https://github.com/nahisaho/kotonoha/compare/v0.5.4...v0.5.5
[0.5.6]: https://github.com/nahisaho/kotonoha/compare/v0.5.5...v0.5.6
[0.5.7]: https://github.com/nahisaho/kotonoha/compare/v0.5.6...v0.5.7
[Unreleased]: https://github.com/nahisaho/kotonoha/compare/v0.5.7...HEAD
