#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""tech-writer skill: a lint script that mechanically checks a technical
document's *structure*.

Where natural-japanese's lint.py detects sentence-level naturalness
(vocabulary, rhythm), this script only detects structural problems specific
to technical documents (heading hierarchy, code examples, leftover
placeholders, suspicious links). The two scripts intentionally don't
overlap in scope.

Findings are flags, not mandates: exit code is always 0 regardless of the
finding count (it's a lint, so it shouldn't block CI). Exit code 1 is
reserved for the input file being missing or unreadable.

Usage:
    uv run scripts/lint.py <file>
    uv run scripts/lint.py --json <file>
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Finding:
    line: int
    category: str
    message: str
    snippet: str = ""


@dataclass
class LintResult:
    file: str
    findings: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "finding_count": len(self.findings),
            "findings": [f.__dict__ for f in self.findings],
        }


HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
# Generic heading labels that read as content-free in either language.
GENERIC_HEADINGS = {
    "overview", "introduction", "usage", "notes", "misc", "others",
    "概要", "はじめに", "使い方", "使用方法", "注意点", "注意事項", "その他", "補足",
}
CODE_FENCE_RE = re.compile(r"^(```|~~~)(\w*)\s*$")
PLACEHOLDER_RE = re.compile(r"\b(TODO|FIXME|TBD|XXX)\b", re.IGNORECASE)
MD_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


def check_heading_hierarchy(lines: list) -> list:
    findings = []
    prev_level = 0
    for i, line in enumerate(lines, start=1):
        m = HEADING_RE.match(line)
        if not m:
            continue
        level = len(m.group(1))
        text = m.group(2).strip()
        if prev_level and level > prev_level + 1:
            findings.append(
                Finding(
                    line=i,
                    category="heading_skip",
                    message=f"Heading level jumps from H{prev_level} to H{level}.",
                    snippet=line.strip(),
                )
            )
        stripped = text.rstrip(":：").strip().lower()
        if stripped in GENERIC_HEADINGS:
            findings.append(
                Finding(
                    line=i,
                    category="generic_heading",
                    message="Generic heading label; make it preview the content instead (structure constitution rule 2).",
                    snippet=line.strip(),
                )
            )
        prev_level = level
    return findings


def check_code_fences(lines: list) -> list:
    findings = []
    open_fence = None
    open_line = None
    for i, line in enumerate(lines, start=1):
        m = CODE_FENCE_RE.match(line.strip())
        if m and open_fence is None:
            open_fence = m.group(1)
            open_line = i
            lang = m.group(2)
            if not lang:
                findings.append(
                    Finding(
                        line=i,
                        category="code_fence_no_lang",
                        message="Code block has no language tag (recommended for syntax highlighting and copy detection).",
                        snippet=line.strip(),
                    )
                )
        elif m and open_fence is not None and m.group(1) == open_fence:
            open_fence = None
            open_line = None
    if open_fence is not None:
        findings.append(
            Finding(
                line=open_line or 0,
                category="unclosed_code_fence",
                message="A code block may not be closed.",
            )
        )
    return findings


def check_placeholders(lines: list) -> list:
    findings = []
    for i, line in enumerate(lines, start=1):
        for m in PLACEHOLDER_RE.finditer(line):
            findings.append(
                Finding(
                    line=i,
                    category="placeholder",
                    message=f"Unresolved placeholder '{m.group(1)}' remains; resolve before publishing.",
                    snippet=line.strip(),
                )
            )
    return findings


def check_links(lines: list) -> list:
    findings = []
    for i, line in enumerate(lines, start=1):
        for m in MD_LINK_RE.finditer(line):
            text, target = m.group(1), m.group(2)
            if not text.strip():
                findings.append(
                    Finding(
                        line=i,
                        category="empty_link_text",
                        message="Link text is empty. Avoid content-free link text like 'here'/'こちら' too.",
                        snippet=line.strip(),
                    )
                )
            if target.strip() in ("#", "", "javascript:void(0)"):
                findings.append(
                    Finding(
                        line=i,
                        category="dead_link_placeholder",
                        message="Link target is still an unset placeholder.",
                        snippet=line.strip(),
                    )
                )
    return findings


def check_intro_length(lines: list) -> list:
    """Quick check that the opening non-empty lines exist (structure constitution rule 1)."""
    findings = []
    body_started = False
    first_para_lines = []
    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            if body_started:
                break
            continue
        if HEADING_RE.match(stripped) and not body_started:
            continue
        body_started = True
        first_para_lines.append((i, stripped))
        if len(first_para_lines) >= 3:
            break
    if not first_para_lines:
        findings.append(
            Finding(
                line=1,
                category="missing_intro",
                message="No opening body text found. State 'what this is' within the first three lines (structure constitution rule 1).",
            )
        )
    return findings


def run_lint(path: Path) -> LintResult:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    result = LintResult(file=str(path))
    result.findings.extend(check_heading_hierarchy(lines))
    result.findings.extend(check_code_fences(lines))
    result.findings.extend(check_placeholders(lines))
    result.findings.extend(check_links(lines))
    result.findings.extend(check_intro_length(lines))
    result.findings.sort(key=lambda f: f.line)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="tech-writer structural lint")
    parser.add_argument("file", type=str, help="Target Markdown file")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.is_file():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    try:
        result = run_lint(path)
    except OSError as e:
        print(f"error: failed to read file: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    else:
        if not result.findings:
            print(f"{path}: no structural findings.")
        else:
            print(f"{path}: {len(result.findings)} finding(s)")
            for f in result.findings:
                print(f"  L{f.line} [{f.category}] {f.message}")
                if f.snippet:
                    print(f"    > {f.snippet}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
