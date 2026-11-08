#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["markdown-it-py>=3,<5"]
# ///
"""Check protected content and require a hash-bound semantic review of edits."""

from __future__ import annotations

import argparse
from collections import Counter
from difflib import SequenceMatcher
import hashlib
import json
from pathlib import Path
import re
import sys

from markdown_it import MarkdownIt


SEMANTIC_CHECKS = (
    "actors", "negation", "conditions", "modality", "scope", "causality",
    "quantity_bindings", "terminology", "structure",
)
NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)*")
IDENTIFIER_RE = re.compile(r"(?<![A-Za-z0-9_])[A-Z][A-Z0-9]*(?:[-_][A-Z0-9]+)+(?![A-Za-z0-9_])")
QUANTITY_RE = re.compile(
    r"(\d+(?:[.,]\d+)*)\s*"
    r"(ミリ秒|時間|年間|か月|ヶ月|秒|分|日|週|月|年|回|件|台|人|個|円|倍|"
    r"[A-Za-zµμ]+(?:/[A-Za-zµμ]+)?|%|％|℃)(?![A-Za-z])"
)
BARE_URL_RE = re.compile(r"https?://[^\s<>`\"()\[\]、。！？「」『』（）]+")
ROLE_RE = re.compile(
    r"([一-龠々ァ-ヶーA-Za-z][一-龠々ァ-ヶーA-Za-z0-9_]*(?:さん|氏|様)?)"
    r"(には|から|が|は|を|に|へ)"
)
ROLE_NAMES = {
    "が": "subject/topic", "は": "subject/topic", "には": "subject/topic",
    "を": "object", "に": "target", "へ": "target", "から": "source",
}
RISK_MARKERS = {
    "negation": {
        "negative": r"ない|なく|なければ|ません|禁止|不可|不要|不可能|(?<=[しせられ])ず",
    },
    "conditions": {
        "condition": r"場合|とき(?!どき)|限り|なら(?!ない)|たら",
        "exception": r"ただし|除く|除き|以外",
    },
    "modality": {
        "obligation": r"なければならない|なくてはならない|せざるを得ない|必須|必要",
        "prohibition": r"てはならない|てはいけない|禁止|不可",
        "permission/ability": r"てもよい|てよい|許可|可能(?!性)|できる|できます",
        "recommendation": r"べき|推奨|望ましい",
        "uncertainty": r"かもしれ(?:ない|ません)|おそらく|可能性|と思われる|でしょう",
        "hearsay": r"(?<=[るただ])らしい|とのこと|と聞(?:く|いた|きました)",
        "plan": r"予定|つもり",
        "request": r"ください|下さい|お願いします",
        "completed": r"ました|だった|完了|済み",
    },
    "scope": {
        "limit": r"だけ|のみ|すべて|全て|一部|少なくとも|以上|以下|未満|最大|最小",
    },
    "causality": {
        "relation": r"ため|ので|原因|結果|してから|した後|する前|によって",
    },
}
RISK_MESSAGES = {
    "actors": "主語・対象・送信先などの表層的な結び付きが変わっています。",
    "negation": "否定の手掛かり、またはその直前の文脈が変わっています。",
    "conditions": "条件・例外の手掛かり、またはその直前の文脈が変わっています。",
    "modality": "義務・許可・能力・依頼・推量・伝聞・予定・完了の手掛かりが変わっています。",
    "scope": "限定・範囲の手掛かり、またはその直前の文脈が変わっています。",
    "causality": "因果・目的・時間順序の手掛かりが変わっています。",
    "structure": "文の追加・削除・分割・統合・並べ替えの候補です。原文にない主張を補っていないか確認します。",
}


def fingerprint(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


def markdown_body(text: str) -> tuple[str, str]:
    lines = text.splitlines(keepends=True)
    frontmatter = ""
    body = text
    if lines and lines[0].strip() == "---":
        end = next(
            (index for index in range(1, len(lines)) if lines[index].strip() in {"---", "..."}),
            None,
        )
        if end is not None:
            frontmatter = "".join(lines[:end + 1])
            body = "".join(lines[end + 1:])
    return frontmatter, body


def snapshot(text: str, protected_terms: list[str]) -> dict:
    frontmatter, body = markdown_body(text)
    body_lines = body.splitlines(keepends=True)
    tokens = MarkdownIt("commonmark").enable("table").parse(body)
    blocks = []
    headings = []
    code = []
    links = []
    html = []
    for token in tokens:
        if token.type in {"fence", "code_block", "table_open", "html_block"}:
            if token.map is None:
                raise ValueError(f"Missing source map for {token.type}")
            start, end = token.map
            blocks.append((token.type, "".join(body_lines[start:end])))
        if token.type == "heading_open":
            headings.append(token.tag)
        for child in token.children or []:
            if child.type == "code_inline":
                code.append(child.content)
            elif child.type == "link_open":
                links.append(child.attrGet("href"))
            elif child.type == "image":
                links.append(child.attrGet("src"))
            elif child.type == "html_inline":
                html.append(child.content)
    return {
        "frontmatter": frontmatter,
        "protected_blocks": blocks,
        "heading_levels": headings,
        "inline_code": code,
        "link_destinations": links,
        "html_tags": html,
        "numbers_in_order": NUMBER_RE.findall(text),
        "quantities_in_order": QUANTITY_RE.findall(text),
        "identifiers_in_order": IDENTIFIER_RE.findall(text),
        "bare_urls_in_order": BARE_URL_RE.findall(text),
        "protected_terms": {term: text.count(term) for term in protected_terms},
    }


def prose_sentences(text: str) -> list[dict]:
    frontmatter, body = markdown_body(text)
    offset = len(frontmatter.splitlines())
    sentences = []
    in_table = in_heading = False
    for token in MarkdownIt("commonmark").enable("table").parse(body):
        if token.type in {"table_open", "table_close"}:
            in_table = token.type == "table_open"
        if token.type in {"heading_open", "heading_close"}:
            in_heading = token.type == "heading_open"
        if token.type != "inline" or in_table or in_heading or token.map is None:
            continue
        visible = "".join(
            child.content if child.type == "text" else
            "\n" if child.type in {"softbreak", "hardbreak"} else
            " " if child.type in {"code_inline", "html_inline", "image"} else ""
            for child in token.children or []
        )
        for match in re.finditer(r"[^。！？!?]+[。！？!?]*", visible):
            passage = match.group().strip()
            if not passage:
                continue
            sentences.append({
                "text": passage,
                "line": offset + token.map[0] + 1,
            })
    return sentences


def risk_signature(text: str, category: str) -> list:
    if category == "actors":
        return sorted(Counter(
            (match.group(1), ROLE_NAMES[match.group(2)])
            for match in ROLE_RE.finditer(text)
        ).items())
    signatures = []
    for kind, pattern in RISK_MARKERS[category].items():
        source = text
        if category == "negation":
            source = re.sub(
                r"かもしれ(?:ない|ません)|なければならない|なくてはならない|せざるを得ない",
                lambda match: " " * len(match.group()), source,
            )
        for match in re.finditer(pattern, source):
            context = re.split(r"[、。！？!?\n]", source[:match.start()])[-1][-24:]
            signatures.append((kind, re.sub(r"\s+", "", context)))
    return sorted(Counter(signatures).items())


def semantic_risks(before: str, after: str) -> list[dict]:
    initial, final = prose_sentences(before), prose_sentences(after)

    def normalize(passage: dict) -> str:
        return re.sub(r"\s+", "", passage["text"])

    matcher = SequenceMatcher(
        a=[normalize(item) for item in initial],
        b=[normalize(item) for item in final], autojunk=False,
    )
    risks = []
    for operation, start, end, new_start, new_end in matcher.get_opcodes():
        if operation == "equal":
            continue
        old, new = initial[start:end], final[new_start:new_end]
        pairs = list(zip(old, new)) if len(old) == len(new) else [(
            {"text": "\n".join(item["text"] for item in old), "line": old[0]["line"] if old else None},
            {"text": "\n".join(item["text"] for item in new), "line": new[0]["line"] if new else None},
        )]
        for original, edited in pairs:
            for category in RISK_MESSAGES:
                if category == "structure":
                    evidence = {"before_sentences": len(old), "after_sentences": len(new)}
                    changed = len(old) != len(new)
                else:
                    before_marks = risk_signature(original["text"], category)
                    after_marks = risk_signature(edited["text"], category)
                    evidence = {"before": before_marks, "after": after_marks}
                    changed = before_marks != after_marks
                if changed:
                    risks.append({
                        "category": category, "severity": "info",
                        "message": RISK_MESSAGES[category],
                        "before_line": original["line"], "after_line": edited["line"],
                        "before_excerpt": original["text"], "after_excerpt": edited["text"],
                        "evidence": evidence,
                    })
    return risks


def check(
    before: Path,
    after: Path,
    protected_terms: list[str] | None = None,
    review_path: Path | None = None,
) -> dict:
    review = (
        json.loads(review_path.read_text(encoding="utf-8"))
        if review_path is not None else None
    )
    if review_path is not None and not isinstance(review, dict):
        raise ValueError("Semantic review must be a JSON object")
    return check_bytes(
        before.read_bytes(), after.read_bytes(), protected_terms, review,
        before_name=str(before), after_name=str(after),
    )


def check_bytes(
    original: bytes,
    edited: bytes,
    protected_terms: list[str] | None = None,
    review: dict | None = None,
    *,
    before_name: str = "<before>",
    after_name: str = "<after>",
) -> dict:
    terms = protected_terms or []
    if any(not term.strip() for term in terms):
        raise ValueError("Protected terms must not be empty")
    before_hash = hashlib.sha256(original).hexdigest()
    after_hash = hashlib.sha256(edited).hexdigest()
    before_text, after_text = original.decode("utf-8"), edited.decode("utf-8")
    initial = snapshot(before_text, terms)
    final = snapshot(after_text, terms)
    risks = semantic_risks(before_text, after_text) if original != edited else []
    violations = [
        {
            "category": name,
            "message": f"Protected content changed: {name}",
            "before_fingerprint": fingerprint(initial[name]),
            "after_fingerprint": fingerprint(final[name]),
        }
        for name in initial if initial[name] != final[name]
    ]
    review_errors = []
    review_required = original != edited
    reviewer = None
    if review is not None:
        if not isinstance(review, dict):
            raise ValueError("Semantic review must be a JSON object")
        reviewer = review.get("reviewer")
        if not isinstance(reviewer, str) or not reviewer.strip():
            review_errors.append("reviewer must be a non-empty identifier")
        if review.get("before_sha256") != before_hash or review.get("after_sha256") != after_hash:
            review_errors.append("review hashes do not match this exact before/after pair")
        checks = review.get("checks")
        if not isinstance(checks, dict):
            review_errors.append("checks must be an object")
        else:
            review_errors.extend(
                f"{name} has not been affirmed" for name in SEMANTIC_CHECKS
                if checks.get(name) is not True
            )
    elif review_required:
        review_errors.append("changed text requires a hash-bound semantic review")
    status = "blocked" if violations else "review_required" if review_errors else "passed"
    return {
        "before": before_name,
        "after": after_name,
        "before_sha256": before_hash,
        "after_sha256": after_hash,
        "status": status,
        "mechanical_violations": violations,
        "semantic_risk_count": len(risks),
        "semantic_risks": risks,
        "semantic_review_required": review_required,
        "semantic_checks": list(SEMANTIC_CHECKS),
        "semantic_review_errors": review_errors,
        "reviewer": reviewer,
        "limitations": [
            "Mechanical equality does not prove semantic equivalence.",
            "Proper names and domain terms require caller-supplied --protect values and contextual review.",
            "Semantic checks are reviewer attestations, not automated entailment judgments.",
            "Semantic risks are heuristic prose-only review targets, not violations or proof of changed meaning.",
            "Surface markers, case-particle bindings and sentence alignment can miss changes or flag equivalent rewrites.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--protect", action="append", default=[])
    parser.add_argument("--review", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        result = check(Path(args.before), Path(args.after), args.protect, args.review)
    except (OSError, ValueError, UnicodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"{result['status']}: {args.before} -> {args.after}")
        for violation in result["mechanical_violations"]:
            print(f"  {violation['message']}")
        for error in result["semantic_review_errors"]:
            print(f"  Semantic review: {error}")
        for risk in result["semantic_risks"]:
            print(
                f"  Semantic risk [{risk['category']}] "
                f"L{risk['before_line']} -> L{risk['after_line']}: {risk['message']}"
            )
            print(f"    before: {risk['before_excerpt']}")
            print(f"    after: {risk['after_excerpt']}")
    return {"passed": 0, "blocked": 2, "review_required": 3}[result["status"]]


if __name__ == "__main__":
    sys.exit(main())
