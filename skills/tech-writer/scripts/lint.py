#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""tech-writer skill: 技術文書の"構成"を機械的にチェックするlintスクリプト。

natural-japanese の lint.py が文単位の自然さ(語彙・リズム)を検出するのに対し、
本スクリプトは技術文書としての構成的な問題(見出し階層・コード例・プレースホルダの
残存・リンク切れの疑いなど)のみを検出する。役割は重複させない。

検出結果は指摘であり、件数に関わらず exit code 0 を返す(lintなのでCIを止めない)。
入力ファイルが存在しない/読めない場合のみ exit code 1。

使い方:
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
GENERIC_HEADINGS = {
    "概要", "はじめに", "使い方", "使用方法", "注意点", "注意事項", "その他", "補足",
    "overview", "introduction", "usage", "notes", "misc", "others",
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
                    message=f"見出しレベルが H{prev_level} から H{level} へ飛んでいます。",
                    snippet=line.strip(),
                )
            )
        stripped = text.rstrip(":：").strip().lower()
        if stripped in GENERIC_HEADINGS:
            findings.append(
                Finding(
                    line=i,
                    category="generic_heading",
                    message="見出しが汎用ラベルです。内容を予告する見出しに具体化してください(構成憲法2条)。",
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
                        message="コードブロックに言語指定がありません(シンタックスハイライトとコピー時の判別のため推奨)。",
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
                message="コードブロックが閉じられていない可能性があります。",
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
                    message=f"未解決のプレースホルダ '{m.group(1)}' が残っています。公開前に解消してください。",
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
                        message="リンクテキストが空です。'こちら'のような無内容なリンクテキストも避けてください。",
                        snippet=line.strip(),
                    )
                )
            if target.strip() in ("#", "", "javascript:void(0)"):
                findings.append(
                    Finding(
                        line=i,
                        category="dead_link_placeholder",
                        message="リンク先が未設定のプレースホルダのままです。",
                        snippet=line.strip(),
                    )
                )
    return findings


def check_intro_length(lines: list) -> list:
    """先頭の非空行が短すぎ/長すぎないかの簡易チェック(構成憲法1条)。"""
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
                message="冒頭に本文が見当たりません。最初の3行で「これは何か」を言い切ってください(構成憲法1条)。",
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
    parser = argparse.ArgumentParser(description="tech-writer 構成lint")
    parser.add_argument("file", type=str, help="対象のMarkdownファイル")
    parser.add_argument("--json", action="store_true", help="JSON形式で出力する")
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
            print(f"{path}: 構成上の指摘はありませんでした。")
        else:
            print(f"{path}: {len(result.findings)} 件の指摘")
            for f in result.findings:
                print(f"  L{f.line} [{f.category}] {f.message}")
                if f.snippet:
                    print(f"    > {f.snippet}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
