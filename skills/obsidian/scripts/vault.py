#!/usr/bin/env python3
# /// script
# requires-python = "==3.12.*"
# dependencies = ["markdown-it-py>=3,<5", "PyYAML>=6,<7", "jsonschema>=4,<5"]
# ///
"""Diagnose authorized Markdown notes and apply explicitly approved single-note plans."""

from __future__ import annotations

import argparse
from collections import defaultdict
from contextlib import contextmanager
from datetime import date
import difflib
import fcntl
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import stat
import sys
from urllib.parse import unquote_to_bytes

from jsonschema import Draft202012Validator, ValidationError
from markdown_it import MarkdownIt
from markdown_it.helpers import parseLinkDestination, parseLinkLabel, parseLinkTitle
from markdown_it.rules_inline.state_inline import StateInline
import yaml


SKILL = Path(__file__).resolve().parent.parent
CONTRACT_PATH = SKILL / "references" / "execution-contract.json"
MANAGEMENT = {".git", ".obsidian"}
MARKDOWN = MarkdownIt("commonmark").enable("table")
CHECKS = (
    "actors", "negation", "conditions", "modality", "scope", "causality",
    "quantity_bindings", "terminology", "structure",
)


class Failure(Exception):
    def __init__(self, code, path=None, *, status="not_performed", exit_code=2):
        super().__init__(code)
        self.code, self.path = code, path
        self.status, self.exit_code = status, exit_code


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError("Non-finite JSON number")

    return json.loads(data, object_pairs_hook=pairs, parse_constant=invalid_constant)


CONTRACT = strict_json(CONTRACT_PATH.read_bytes())


def validate(value, definition):
    Draft202012Validator({
        "$ref": f"#/$defs/{definition}", "$defs": CONTRACT["$defs"],
    }).validate(value)


def issue(code, path=None):
    return {"code": code, "path": path, "message": code}


def relative(path, *, dot=False):
    if not isinstance(path, str) or not path or "\0" in path or path.startswith("/"):
        raise Failure("invalid_path")
    parts = path.split("/")
    if ".." in parts:
        raise Failure("invalid_path", path)
    normalized = posixpath.normpath(path)
    if normalized == "." and not dot:
        raise Failure("invalid_path", path)
    if MANAGEMENT.intersection(parts):
        raise Failure("excluded_management_directory", path)
    return normalized


def directory(path):
    path = os.fspath(path)
    if not os.path.isabs(path) or "\0" in path or ".." in path.split("/"):
        raise Failure("invalid_path")
    descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in Path(path).parts[1:]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        return descriptor
    except (OSError, Failure):
        os.close(descriptor)
        raise


class Vault:
    def __init__(self, request):
        self.root = os.path.normpath(request["vault_root"])
        self.scopes = [
            (scope["kind"], relative(scope["path"], dot=scope["kind"] == "directory"))
            for scope in request["read_scopes"]
        ]
        try:
            self.fd = directory(self.root)
        except OSError as error:
            raise Failure("invalid_request", status="failed", exit_code=1) from error

    def close(self):
        os.close(self.fd)

    def allowed(self, path):
        return any(
            path == scope or kind == "directory" and (
                scope == "." or path.startswith(scope + "/")
            ) for kind, scope in self.scopes
        )

    @contextmanager
    def parent(self, path):
        path = relative(path)
        descriptor = os.dup(self.fd)
        try:
            for part in path.split("/")[:-1]:
                try:
                    child = os.open(
                        part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                        dir_fd=descriptor,
                    )
                except OSError as error:
                    if error.errno in (20, 40):
                        raise Failure("symlink_not_followed", path) from error
                    raise
                os.close(descriptor)
                descriptor = child
            yield descriptor, path.split("/")[-1]
        finally:
            os.close(descriptor)

    def read(self, path, maximum=None):
        path = relative(path)
        if not self.allowed(path):
            raise Failure("outside_scope", path)
        if not path.endswith(".md"):
            raise Failure("unsupported_format", path)
        with self.parent(path) as (parent, name):
            try:
                descriptor = os.open(
                    name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent,
                )
            except OSError as error:
                if error.errno == 40:
                    raise Failure("symlink_not_followed", path) from error
                raise
            with os.fdopen(descriptor, "rb") as stream:
                metadata = os.fstat(stream.fileno())
                if not stat.S_ISREG(metadata.st_mode):
                    raise Failure("unsupported_format", path)
                if maximum is not None and metadata.st_size > maximum:
                    raise Failure("limit_reached", path)
                data = stream.read() if maximum is None else stream.read(maximum + 1)
                if maximum is not None and len(data) > maximum:
                    raise Failure("limit_reached", path)
                return data, metadata

    def enumerate(self):
        paths, skipped, issues = set(), set(), []
        enumeration_complete = True

        def walk(descriptor, prefix):
            nonlocal enumeration_complete
            try:
                names = sorted(os.listdir(descriptor))
            except OSError:
                skipped.add(prefix)
                issues.append(issue("read_failed", prefix))
                enumeration_complete = False
                return
            for name in names:
                path = name if prefix == "." else prefix + "/" + name
                if name in MANAGEMENT:
                    issues.append(issue("excluded_management_directory", path))
                    continue
                try:
                    metadata = os.stat(name, dir_fd=descriptor, follow_symlinks=False)
                    if stat.S_ISLNK(metadata.st_mode):
                        skipped.add(path)
                        issues.append(issue("symlink_not_followed", path))
                        enumeration_complete = False
                    elif stat.S_ISDIR(metadata.st_mode):
                        child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                        dir_fd=descriptor)
                        try:
                            walk(child, path)
                        finally:
                            os.close(child)
                    elif name.endswith(".md"):
                        if stat.S_ISREG(metadata.st_mode):
                            paths.add(path)
                        else:
                            skipped.add(path)
                            issues.append(issue("unsupported_format", path))
                except OSError:
                    skipped.add(path)
                    issues.append(issue("read_failed", path))
                    enumeration_complete = False

        for kind, path in self.scopes:
            if kind == "file":
                if not path.endswith(".md"):
                    raise Failure("unsupported_format", path)
                paths.add(path)
                continue
            try:
                if path == ".":
                    walk(self.fd, ".")
                else:
                    with self.parent(path) as (parent, name):
                        child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                        dir_fd=parent)
                        try:
                            walk(child, path)
                        finally:
                            os.close(child)
            except (OSError, Failure):
                skipped.add(path)
                issues.append(issue("read_failed", path))
                enumeration_complete = False
        return sorted(paths), skipped, issues, enumeration_complete


def yaml_properties(frontmatter):
    for event in yaml.parse(frontmatter):
        if getattr(event, "anchor", None) or isinstance(event, yaml.AliasEvent):
            raise ValueError("YAML anchors unsupported")
        tag = getattr(event, "tag", None)
        if tag and not tag.startswith("tag:yaml.org,2002:"):
            raise ValueError("Custom YAML tag unsupported")
    node = yaml.compose(frontmatter, Loader=yaml.SafeLoader)
    if node is None:
        return {}
    if not isinstance(node, yaml.MappingNode):
        raise ValueError("Properties must be a mapping")
    keys = [key.value for key, _ in node.value if isinstance(key, yaml.ScalarNode)]
    if len(keys) != len(node.value) or len(set(keys)) != len(keys):
        raise ValueError("Duplicate or complex YAML key")
    values = yaml.safe_load(frontmatter)

    def scalar(value):
        return (value is None or isinstance(value, (str, bool, int, date))
                or isinstance(value, float) and math.isfinite(value))

    for key, value in values.items():
        if not isinstance(key, str) or not key:
            raise ValueError("Non-string property key")
        if not scalar(value) and not (
            isinstance(value, list) and all(scalar(item) for item in value)
        ):
            raise ValueError("Nested property unsupported")
        if key in {"aliases", "tags", "cssclasses"} and not (
            isinstance(value, list) and all(isinstance(item, str) for item in value)
        ):
            raise ValueError("Expected string list")
    return values


def masked_body(body):
    chars = list(body)
    fatal = False
    comments = []

    def hide(start, end, *, inline=False):
        for index in range(start, end):
            if chars[index] not in "\r\n":
                chars[index] = "x" if inline else " "

    def blocks(text):
        lines = text.splitlines(keepends=True)
        offsets = [0]
        for line in lines:
            offsets.append(offsets[-1] + len(line))
        found, containers, tables = {}, [], []
        for token in MARKDOWN.parse(text):
            if token.type == "inline" and token.map:
                containers.append((offsets[token.map[0]], offsets[token.map[1]]))
            if token.type == "table_open" and token.map:
                tables.append((offsets[token.map[0]], offsets[token.map[1]]))
            if token.type in {"fence", "code_block"} and token.map:
                start, end = token.map
                found[offsets[start]] = (offsets[end], token, lines[start:end])
        return found, containers, tables

    code, containers, tables = blocks(body)
    index = 0
    while index < len(body):
        if index in code:
            end, token, lines = code[index]
            if token.type == "fence" and not (
                len(lines) > 1 and re.match(
                    r"^[ >]*" + re.escape(token.markup[0]) + "{"
                    + str(len(token.markup)) + r",}\s*$", lines[-1],
                )
            ):
                fatal = True
            hide(index, end)
            index = end
        elif body[index] == "\\":
            index += 2
        elif body.startswith("%%", index):
            close = body.find("%%", index + 2)
            end = len(body) if close < 0 else close + 2
            fatal |= close < 0
            comments.append(body[index:end])
            hide(index, end, inline=True)
            index = end
        elif body[index] == "`":
            opening = re.match(r"`+", body[index:]).group()
            containing = [end for start, end in containers if start <= index < end]
            newline = body.find("\n", index)
            bound = min(containing) if containing else len(body) if newline < 0 else newline
            bound = min([bound] + [start for start in code if start > index])
            if any(start <= index < end for start, end in tables):
                bound = min(bound, len(body) if newline < 0 else newline)
                for position in range(index + len(opening), bound):
                    if body[position] == "|":
                        previous = position - 1
                        while previous >= 0 and body[previous] == "\\":
                            previous -= 1
                        if (position - previous - 1) % 2 == 0:
                            bound = position
                            break
            close = re.search(r"(?<!`)" + re.escape(opening) + r"(?!`)",
                              body[index + len(opening):bound])
            if close:
                end = index + len(opening) + close.end()
                hide(index, end, inline=True)
                index = end
            else:
                index += len(opening)
        else:
            index += 1
    for start, (end, token, lines) in blocks("".join(chars))[0].items():
        if token.type == "fence" and not (
            len(lines) > 1 and re.match(
                r"^[ >]*" + re.escape(token.markup[0]) + "{"
                + str(len(token.markup)) + r",}\s*$", lines[-1],
            )
        ):
            fatal = True
        hide(start, end)
    return "".join(chars), fatal, comments


def extract_links(body, masked, line_offset):
    tokens = MARKDOWN.parse(masked)
    blocks = []
    for token in tokens:
        if token.map:
            blocks.append(tuple(token.map))
    links, external, all_raw = [], 0, []
    index = 0
    state = StateInline(body, MARKDOWN, {}, [])
    while index < len(masked):
        if masked[index] == "\\":
            index += 2
            continue
        start = index
        image = masked.startswith("![", start)
        bracket = start + 1 if image else start
        syntax = None
        destination = ""
        if masked.startswith("[[", bracket):
            close = masked.find("]]", bracket + 2)
            newline = masked.find("\n", bracket)
            if close >= 0 and (newline < 0 or close < newline):
                end = close + 2
                syntax = "wiki"
                destination = body[bracket + 2:close].replace("\\|", "|").split("|", 1)[0]
                if "[[" in destination:
                    syntax = "unsupported"
            else:
                end = len(masked) if newline < 0 else newline
                syntax = "unsupported"
        elif masked.startswith("[", bracket):
            close = parseLinkLabel(state, bracket, False)
            if close >= 0 and masked.startswith("(", close + 1):
                position = close + 2
                while position < len(body) and body[position].isspace():
                    position += 1
                parsed = parseLinkDestination(body, position, len(body))
                if parsed.ok:
                    destination = parsed.str
                    position = parsed.pos
                    while position < len(body) and body[position].isspace():
                        position += 1
                    if position < len(body) and body[position] in "\"'(":
                        title = parseLinkTitle(body, position, len(body))
                        if title.ok:
                            position = title.pos
                            while position < len(body) and body[position].isspace():
                                position += 1
                    if position < len(body) and body[position] == ")":
                        end = position + 1
                        syntax = "unsupported" if image else "markdown"
                if syntax is None:
                    newline = masked.find("\n", bracket)
                    end = len(masked) if newline < 0 else newline
                    syntax = "unsupported"
        if syntax is None:
            url = re.match(r"https?://[^\s<>]+", masked[index:])
            if url:
                external += 1
                index += len(url.group())
            else:
                index += 1
            continue
        all_raw.append(body[start:end])
        if re.match(r"^(?:https?|mailto|ftp):", destination, re.I):
            external += 1
            index = end
            continue
        line = body.count("\n", 0, start)
        containing = [(a, b) for a, b in blocks if a <= line < b]
        block_line = min((a for a, _ in containing), default=line)
        links.append({
            "raw": body[start:end], "syntax": syntax, "destination": destination,
            "block_start_line": line_offset + block_line + 1,
            "occurrence": len(links) + 1,
        })
        index = end
    return links, external, all_raw


def parse_note(path, data):
    text = data.decode("utf-8")
    lines = text.splitlines(keepends=True)
    properties, offset, fatal = {}, 0, False
    if lines and lines[0].strip() == "---":
        close = next((i for i in range(1, len(lines))
                      if lines[i].strip() in {"---", "..."}), None)
        if close is None:
            fatal = True
        else:
            offset = close + 1
            try:
                properties = yaml_properties("".join(lines[1:close]))
            except (ValueError, yaml.YAMLError):
                fatal = True
    body = "".join(lines[offset:])
    masked, incomplete, comments = masked_body(body)
    fatal |= incomplete
    headings, all_headings, unsupported = [], [], False
    tokens = MARKDOWN.parse(masked)
    for index, token in enumerate(tokens):
        if token.type == "heading_open":
            inline = tokens[index + 1]
            start, end = token.map
            source_lines = body.splitlines()
            raw = source_lines[start]
            marker = re.match(r"^[ \t>]*(?:(?:[-+*]|\d+[.)])[ \t]+)?#{1,6}(?:[ \t]+|$)", raw)
            if marker:
                raw = re.sub(r"[ \t]+#+[ \t]*$", "", raw[marker.end():]).strip(" \t")
            else:
                raw = "\n".join(line.lstrip(" >") for line in source_lines[start:end - 1])
            all_headings.append(raw)
            children = MARKDOWN.parseInline(raw)[0].children or []
            plain = (len(children) == 1 and children[0].type == "text"
                     and children[0].content == raw
                     and not any(marker in raw for marker in ("[[", "]]", "==", "~~", "%%")))
            if plain:
                headings.append(raw)
            else:
                unsupported = True
    links, external, all_raw = extract_links(body, masked, offset) if not fatal else ([], 0, [])
    return {
        "path": path, "data": data, "sha256": digest(data), "properties": properties,
        "headings": headings, "all_headings": all_headings, "unsupported_heading": unsupported,
        "links": links, "external": external, "fatal": fatal, "comments": comments,
        "all_link_raw": all_raw,
    }


def resolve_link(source, link, notes, vault, coverage):
    raw, syntax = link["destination"], link["syntax"]
    candidates = []

    def result(classification, reason):
        return {key: link[key] for key in ("raw", "block_start_line", "occurrence")} | {
            "source_path": source, "classification": classification,
            "reason": reason, "candidates": candidates,
        }

    if syntax == "unsupported" or "^" in raw or not raw:
        return result("indeterminate", "unsupported_syntax")
    path, separator, heading = raw.partition("#")
    if syntax == "markdown":
        extension = PurePosixPath(path).suffix
        if path.startswith(("/", "\\")) or (
            extension and "%" not in extension and extension != ".md"
        ):
            return result("indeterminate", "unsupported_syntax")
        try:
            if re.search(r"%(?![a-fA-F0-9]{2})", path + heading):
                raise ValueError("Invalid encoding")
            path = unquote_to_bytes(path).decode("utf-8")
            heading = unquote_to_bytes(heading).decode("utf-8")
        except (ValueError, UnicodeError):
            return result("indeterminate", "invalid_encoding")
        if not path.endswith(".md") or path.startswith("/") or re.match(r"^[a-zA-Z]+:", path):
            return result("indeterminate", "unsupported_syntax")
        target = posixpath.normpath(posixpath.join(posixpath.dirname(source), path))
        bare = False
    else:
        if path.startswith("/") or re.search(r"\.(?:png|jpe?g|gif|pdf|webp|svg|mp[34]|canvas|base)$", path, re.I):
            return result("indeterminate", "unsupported_syntax")
        bare = bool(path) and "/" not in path
        target = source if not path and separator else path if path.endswith(".md") else path + ".md"
    if target == ".." or target.startswith("../") or "\0" in target:
        return result("indeterminate", "outside_scope")
    try:
        target = relative(target)
    except Failure:
        return result("indeterminate", "outside_scope")
    if bare:
        candidates = sorted(name for name in notes if PurePosixPath(name).name == target)
        if len(candidates) > 1:
            return result("ambiguous", "multiple_notes")
        if not (coverage["whole_vault"] and coverage["enumeration_complete"] and coverage["reads_complete"]):
            return result("indeterminate", "scope_incomplete")
    else:
        if not vault.allowed(target):
            return result("indeterminate", "outside_scope")
        if any(target == name or target.startswith(name + "/") for name in coverage["unprocessed"]):
            return result("indeterminate", "scope_incomplete")
        if target in notes:
            candidates = [target]
    if not candidates:
        return result("unresolved", "note_missing")
    note = notes[candidates[0]]
    if note["fatal"]:
        return result("indeterminate", "target_parse_incomplete")
    if not separator:
        return result("resolved", "note_found")
    count = note["headings"].count(heading)
    if count > 1:
        return result("ambiguous", "multiple_headings")
    if count == 1:
        return result("resolved", "heading_found")
    if note["unsupported_heading"]:
        return result("indeterminate", "unsupported_heading")
    return result("unresolved", "heading_missing")


def property_type(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, date):
        return "date"
    return "list" if isinstance(value, list) else "string"


def observations(notes):
    groups = defaultdict(set)
    for path, note in notes.items():
        groups["name", PurePosixPath(path).stem].add(path)
        groups["folder", str(PurePosixPath(path).parent)].add(path)
        if note["fatal"]:
            continue
        for name, value in note["properties"].items():
            groups["property_name", name].add(path)
            groups["property_type", name + ":" + property_type(value)].add(path)
        for tag in note["properties"].get("tags", []):
            if tag:
                groups["tag", tag].add(path)
    return [
        {"kind": kind, "value": value, "paths": sorted(paths),
         "count": len(paths), "label": "observation"}
        for (kind, value), paths in sorted(groups.items())
    ]


def note_record(note):
    return {"path": note["path"], "sha256": note["sha256"],
            "bytes": len(note["data"]), "heading_texts": note["all_headings"]}


def inspect(request, vault, report):
    paths, skipped, issues, complete = vault.enumerate()
    coverage = report["coverage"]
    coverage["enumeration_complete"] = complete
    coverage["reads_complete"] = not skipped
    report["issues"].extend(issues)
    notes, total = {}, 0
    limits = request["limits"]
    for index, path in enumerate(paths):
        if limits["max_files"] is not None and index >= limits["max_files"]:
            skipped.add(path)
            report["issues"].append(issue("limit_reached", path))
            continue
        maximum = limits["max_file_bytes"]
        if limits["max_total_bytes"] is not None:
            remaining = limits["max_total_bytes"] - total
            maximum = remaining if maximum is None else min(maximum, remaining)
        try:
            data, _ = vault.read(path, maximum)
            total += len(data)
            note = parse_note(path, data)
            notes[path] = note
            coverage["processed"].append(path)
            if note["fatal"]:
                coverage["parses_complete"] = False
                report["issues"].extend([
                    issue("source_parse_incomplete", path), issue("unsupported_format", path),
                ])
        except (OSError, UnicodeError, Failure) as error:
            skipped.add(path)
            code = error.code if isinstance(error, Failure) else "unsupported_format" if isinstance(error, UnicodeError) else "read_failed"
            report["issues"].append(issue(code, path))
    coverage["unprocessed"] = sorted(skipped)
    coverage["reads_complete"] &= not skipped
    links = [
        resolve_link(path, link, notes, vault, coverage)
        for path, note in sorted(notes.items()) for link in note["links"]
    ]
    for link in links:
        if link["reason"] == "target_parse_incomplete":
            report["issues"].append(issue("target_parse_incomplete", link["source_path"]))
    declarations = []
    for path in request["declared_rules"]:
        path = relative(path)
        if not vault.allowed(path):
            raise Failure("outside_scope", path)
        if path not in notes:
            raise Failure("read_failed", path, status="failed", exit_code=1)
        declarations.append(note_record(notes[path]))
    report["data"] = {
        "notes": [note_record(note) for _, note in sorted(notes.items())],
        "observations": observations(notes), "declarations": declarations,
        "links": links, "external_url_count": sum(note["external"] for note in notes.values()),
    }
    if skipped or not complete or not coverage["parses_complete"] or any(
        link["classification"] == "indeterminate" for link in links
    ):
        report.update(status="partial", exit_code=3)


def load_gate():
    path = SKILL.parent / "japanese-prose" / "scripts" / "invariants.py"
    if not path.is_file():
        raise Failure("dependency_missing", status="not_performed", exit_code=4)
    spec = importlib.util.spec_from_file_location("kotonoha_invariants", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not callable(getattr(module, "check_bytes", None)) or tuple(module.SEMANTIC_CHECKS) != CHECKS:
        raise Failure("dependency_missing", status="not_performed", exit_code=4)
    return module


def implementation_hash():
    paths = [
        Path(__file__), Path(__file__).with_suffix(".py.lock"),
        SKILL.parent / "japanese-prose" / "scripts" / "invariants.py",
    ]
    try:
        return digest(canonical({path.name: digest(path.read_bytes()) for path in paths}))
    except FileNotFoundError as error:
        raise Failure("dependency_missing", status="not_performed", exit_code=4) from error


def protected_snapshot(note):
    text = note["data"].decode("utf-8")
    return {
        "headings": note["all_headings"],
        "wikilinks": re.findall(r"!?\[\[[^\n]*?\]\]", text),
        "links": note["all_link_raw"],
        "markdown_links": re.findall(r"!?\[[^\]\n]*\]\([^\n]*?\)", text),
        "callouts": re.findall(r"^[ >]*\[![^\]\n]+\][+-]?", text, re.M),
        "comments": note["comments"],
        "definitions": re.findall(r"^[ ]{0,3}\[[^\]\n]+\]:[^\n]*(?:\n[ \t]+[^\n]+)*", text, re.M),
    }


def edit_gate(before, after, terms, review):
    initial, final = parse_note("before.md", before), parse_note("after.md", after)
    if initial["fatal"] or final["fatal"]:
        raise Failure("unsupported_format")
    result = load_gate().check_bytes(before, after, terms, review)
    if protected_snapshot(initial) != protected_snapshot(final):
        raise Failure("gate_blocked")
    if result["status"] == "blocked":
        raise Failure("gate_blocked")
    if result["status"] != "passed":
        raise Failure("semantic_review_required")


def workspace_path(request, path):
    workspace = request["workspace"]
    if not workspace:
        raise Failure("consent_missing")
    workspace = os.path.normpath(workspace)
    root = os.path.normpath(request["vault_root"])
    if not os.path.isabs(workspace) or os.path.commonpath([workspace, root]) == root:
        raise Failure("invalid_path")
    path = os.path.normpath(os.fspath(path))
    if not os.path.isabs(path) or os.path.commonpath([workspace, path]) != workspace:
        raise Failure("outside_scope")
    return workspace, path


def workspace_read(request, path):
    workspace, path = workspace_path(request, path)
    descriptor = directory(workspace)
    try:
        relative_path = os.path.relpath(path, workspace)
        parts = relative(relative_path).split("/")
        for part in parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                            dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        file_descriptor = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                                  dir_fd=descriptor)
        with os.fdopen(file_descriptor, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                raise Failure("unsupported_format")
            return stream.read()
    finally:
        os.close(descriptor)


def write_private(path, data, *, reuse=False):
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        if reuse:
            descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            with os.fdopen(descriptor, "rb") as stream:
                metadata = os.fstat(stream.fileno())
                if (stat.S_ISREG(metadata.st_mode) and metadata.st_uid == os.geteuid()
                        and stat.S_IMODE(metadata.st_mode) == 0o600
                        and stream.read() == data):
                    return
        raise Failure("target_exists") from None
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def replace_private(path, data):
    temporary = path.with_name("." + path.name + ".tmp")
    write_private(temporary, data)
    os.replace(temporary, path)
    descriptor = directory(path.parent)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def identity(metadata):
    return {"device": metadata.st_dev, "inode": metadata.st_ino}


def operation_id(plan, parent_metadata):
    return digest(canonical({
        key: plan[key] for key in (
            "request_sha256", "vault_identity", "target", "before_sha256",
            "after_sha256", "review_sha256", "implementation_sha256",
        )
    } | {"target_parent_identity": identity(parent_metadata)}))


def review_data(data):
    review = strict_json(data)
    if (not isinstance(review, dict)
            or set(review) != {"before_sha256", "after_sha256", "reviewer", "checks"}
            or not isinstance(review["checks"], dict) or set(review["checks"]) != set(CHECKS)):
        raise Failure("semantic_review_required")
    return review


def assert_target(target):
    target = relative(target)
    if not target.endswith(".md"):
        raise Failure("invalid_path", target)
    return target


def metadata_supported(metadata, descriptor=None):
    if (metadata.st_uid != os.geteuid() or metadata.st_nlink != 1
            or metadata.st_mode & 0o7000
            or metadata.st_gid not in {os.getegid(), *os.getgroups()}):
        raise Failure("capability_missing", exit_code=4)
    if descriptor is not None:
        try:
            attributes = os.listxattr(descriptor)
        except OSError as error:
            raise Failure("capability_missing", exit_code=4) from error
        if attributes:
            raise Failure("capability_missing", exit_code=4)


def write_capabilities():
    if (not all(hasattr(os, name) for name in ("replace", "link", "fsync", "listxattr"))
            or os.open not in os.supports_dir_fd or os.link not in os.supports_dir_fd):
        raise Failure("capability_missing", exit_code=4)


def maximum_note_bytes(request):
    limits = [value for value in (
        request["limits"]["max_file_bytes"], request["limits"]["max_total_bytes"],
    ) if value is not None]
    return min(limits) if limits else None


def diff_bytes(before, candidate, target):
    lines = difflib.unified_diff(
        (before or b"").decode("utf-8").splitlines(keepends=True),
        candidate.decode("utf-8").splitlines(keepends=True),
        fromfile=target if before is not None else "/dev/null", tofile=target,
    )
    return "".join(
        line if line.endswith(("\n", "\r")) else line + "\n\\ No newline at end of file\n"
        for line in lines
    ).encode("utf-8")


def local_filesystem(descriptor):
    try:
        location = os.readlink(f"/proc/self/fd/{descriptor}")
        matches = []
        for line in Path("/proc/self/mountinfo").read_text().splitlines():
            fields = line.split()
            mount = re.sub(
                r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), fields[4],
            )
            if mount == "/" or location == mount or location.startswith(mount + "/"):
                matches.append((len(mount), fields[fields.index("-") + 1]))
        filesystem = max(matches)[1] if matches else None
    except (OSError, ValueError, IndexError) as error:
        raise Failure("capability_missing", exit_code=4) from error
    if filesystem not in {"ext2", "ext3", "ext4", "xfs", "btrfs", "tmpfs", "overlay", "zfs", "f2fs"}:
        raise Failure("capability_missing", exit_code=4)


def plan(request, vault, report, args):
    try:
        validate(request, "PlanRequest")
    except ValidationError as error:
        raise Failure("invalid_request") from error
    target = assert_target(request["write_target"])
    if not request["consent"]["workspace_copies"]:
        raise Failure("consent_missing")
    workspace, _ = workspace_path(request, request["workspace"])
    descriptor = directory(workspace)
    os.close(descriptor)
    candidate = workspace_read(request, args.candidate)
    candidate.decode("utf-8")
    review_bytes = None
    before = None
    with vault.parent(target) as (parent, name):
        existing = None
        try:
            existing = os.stat(name, dir_fd=parent, follow_symlinks=False)
        except FileNotFoundError:
            pass
        if request["intent"] == "proofread":
            before, metadata = vault.read(target, maximum_note_bytes(request))
            if digest(before) != request["base_sha256"]:
                raise Failure("target_changed", target)
            if before == candidate:
                report["data"] = {"plan_path": None, "plan_sha256": None,
                                  "operation_id": None, "gate_status": "passed",
                                  "no_changes": True}
                return
            metadata_supported(metadata)
            with os.fdopen(os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent), "rb") as stream:
                metadata_supported(os.fstat(stream.fileno()), stream.fileno())
        elif existing is not None:
            raise Failure("target_exists", target)
        write_capabilities()
        local_filesystem(parent)
        maximum = maximum_note_bytes(request)
        if maximum is not None and len(candidate) > maximum:
            raise Failure("limit_reached", target)
        if not (SKILL.parent / "tech-writer" / "SKILL.md").is_file():
            raise Failure("dependency_missing", exit_code=4)
        load_gate()
        review_bytes = workspace_read(request, args.review) if args.review else None
        review = review_data(review_bytes) if review_bytes is not None else None
        if before is not None:
            edit_gate(before, candidate, request["protected_terms"], review)
        else:
            if parse_note(target, candidate)["fatal"]:
                raise Failure("unsupported_format", target)
            if request["deliverable"] == "note" and re.search(r"\{\{[^}]*\}\}", candidate.decode("utf-8")):
                raise Failure("gate_blocked", target)
        planned = {
            "schema_version": 1, "request_sha256": report["request_sha256"],
            "contract_sha256": digest(CONTRACT_PATH.read_bytes()),
            "implementation_sha256": implementation_hash(),
            "vault_identity": identity(os.fstat(vault.fd)), "target": target,
            "kind": "edit" if before is not None else "create",
            "before_sha256": digest(before) if before is not None else None,
            "after_sha256": digest(candidate),
            "review_sha256": digest(review_bytes) if review_bytes is not None else None,
            "state": "validated", "protected_terms": request["protected_terms"],
        }
        planned["operation_id"] = operation_id(planned, os.fstat(parent))
    operation = Path(workspace) / planned["operation_id"]
    try:
        operation.mkdir(mode=0o700)
    except FileExistsError:
        pass
    descriptor = directory(operation)
    try:
        metadata = os.fstat(descriptor)
        if metadata.st_uid != os.geteuid() or stat.S_IMODE(metadata.st_mode) != 0o700:
            raise Failure("capability_missing", exit_code=4)
    finally:
        os.close(descriptor)
    planned["stage_target"] = posixpath.join(
        posixpath.dirname(target), ".kotonoha-" + planned["operation_id"] + ".tmp",
    )
    diff = diff_bytes(before, candidate, target)
    planned["diff_sha256"] = digest(diff)
    contents = {"candidate": candidate, "diff": diff}
    if before is not None:
        contents["before"] = before
    if review_bytes is not None:
        contents["review"] = review_bytes
    filenames = {"candidate": "candidate.md", "before": "before.md",
                 "diff": "diff.patch", "review": "semantic-review.json"}
    planned["artifacts"] = {
        key: str(operation / filename) if key in contents else None
        for key, filename in filenames.items()
    }
    for key, data in contents.items():
        write_private(operation / filenames[key], data, reuse=True)
    validate(planned, "Plan")
    plan_bytes = canonical(planned)
    write_private(operation / "plan.json", plan_bytes, reuse=True)
    report.update(operation_state="validated", data={
        "plan_path": str(operation / "plan.json"), "plan_sha256": digest(plan_bytes),
        "operation_id": planned["operation_id"],
        "gate_status": "passed" if before is not None else "not_applicable",
        "no_changes": False,
    })


def exclusive_create(parent, stage_name, name):
    os.link(stage_name, name, src_dir_fd=parent, dst_dir_fd=parent, follow_symlinks=False)


def apply(request, vault, report, args):
    if not request["consent"]["workspace_copies"]:
        raise Failure("consent_missing")
    plan_bytes = workspace_read(request, args.plan)
    if digest(plan_bytes) != args.approve_plan_sha256:
        raise Failure("plan_not_approved")
    planned = strict_json(plan_bytes)
    validate(planned, "Plan")
    if planned["state"] != "validated":
        raise Failure("gate_blocked")
    if planned["request_sha256"] != report["request_sha256"]:
        raise Failure("request_changed")
    if planned["contract_sha256"] != digest(CONTRACT_PATH.read_bytes()):
        raise Failure("implementation_changed")
    if planned["implementation_sha256"] != implementation_hash():
        raise Failure("implementation_changed")
    if planned["vault_identity"] != identity(os.fstat(vault.fd)):
        raise Failure("parent_changed")
    if planned["protected_terms"] != request["protected_terms"]:
        raise Failure("request_changed")
    target = assert_target(planned["target"])
    if (target != request["write_target"]
            or planned["kind"] != ("edit" if request["intent"] == "proofread" else "create")):
        raise Failure("request_changed", target)
    if planned["kind"] == "edit" and request["base_sha256"] != planned["before_sha256"]:
        raise Failure("request_changed", target)
    workspace, _ = workspace_path(request, args.plan)
    operation = Path(workspace) / planned["operation_id"]
    if os.path.normpath(args.plan) != str(operation / "plan.json"):
        raise Failure("invalid_path")
    expected_artifacts = {
        "candidate": operation / "candidate.md", "before": operation / "before.md",
        "review": operation / "semantic-review.json", "diff": operation / "diff.patch",
    }
    loaded = {}
    for key, path in planned["artifacts"].items():
        if path is not None:
            if path != str(expected_artifacts[key]):
                raise Failure("invalid_path")
            loaded[key] = workspace_read(request, path)
    candidate = loaded["candidate"]
    before = loaded.get("before")
    review_bytes = loaded.get("review")
    if digest(candidate) != planned["after_sha256"]:
        raise Failure("candidate_changed")
    if digest(loaded["diff"]) != planned["diff_sha256"]:
        raise Failure("candidate_changed")
    if (digest(before) if before is not None else None) != planned["before_sha256"]:
        raise Failure("target_changed")
    if (digest(review_bytes) if review_bytes is not None else None) != planned["review_sha256"]:
        raise Failure("semantic_review_required")
    if before is not None:
        if not vault.allowed(target):
            raise Failure("outside_scope", target)
        edit_gate(before, candidate, request["protected_terms"],
                  review_data(review_bytes) if review_bytes is not None else None)
    elif (parse_note(target, candidate)["fatal"] or
          request["deliverable"] == "note" and re.search(r"\{\{[^}]*\}\}", candidate.decode("utf-8"))):
        raise Failure("gate_blocked", target)
    stage = posixpath.join(
        posixpath.dirname(target), ".kotonoha-" + planned["operation_id"] + ".tmp",
    )
    if planned["stage_target"] != stage:
        raise Failure("invalid_path", stage)
    report["operation_state"] = "approved"
    report["data"] = {
        "target": target, "after_sha256": None, "operation_id": planned["operation_id"],
        "changed": False, "verified": False,
    }

    def read_at(parent, name):
        try:
            descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        except OSError as error:
            if error.errno == 40:
                raise Failure("symlink_not_followed", target) from error
            raise
        with os.fdopen(descriptor, "rb") as stream:
            metadata = os.fstat(stream.fileno())
            if not stat.S_ISREG(metadata.st_mode):
                raise Failure("unsupported_format", target)
            maximum = maximum_note_bytes(request)
            if maximum is not None and metadata.st_size > maximum:
                raise Failure("limit_reached", target)
            data = stream.read() if maximum is None else stream.read(maximum + 1)
            if maximum is not None and len(data) > maximum:
                raise Failure("limit_reached", target)
            return data, metadata

    with vault.parent(target) as (parent, name):
        local_filesystem(parent)
        if operation_id(planned, os.fstat(parent)) != planned["operation_id"]:
            raise Failure("parent_changed", target)
        expected_receipt = {
            "schema_version": 1, "operation_id": planned["operation_id"],
            "plan_sha256": digest(plan_bytes), "request_sha256": report["request_sha256"],
            "target": target, "after_sha256": digest(candidate), "verified": True,
        }
        receipt_path = operation / "receipt.json"
        try:
            receipt_bytes = workspace_read(request, receipt_path)
        except FileNotFoundError:
            receipt_bytes = None
        if receipt_bytes is not None:
            try:
                receipt = strict_json(receipt_bytes)
                validate(receipt, "Receipt")
            except (ValueError, ValidationError) as error:
                raise Failure("commit_outcome_uncertain", target) from error
            if receipt != expected_receipt:
                raise Failure("commit_outcome_uncertain", target)
            if not vault.allowed(target):
                raise Failure("outside_scope", target)
            try:
                current, _ = read_at(parent, name)
            except FileNotFoundError as error:
                raise Failure("target_changed", target) from error
            if digest(current) != planned["after_sha256"]:
                raise Failure("target_changed", target)
            report.update(operation_state="saved", write_status="saved")
            report["data"].update(after_sha256=digest(current), changed=False, verified=True)
            report["issues"].append(issue("already_applied", target))
            return
        result_path = operation / "result.json"
        try:
            previous = strict_json(workspace_read(request, result_path))
        except FileNotFoundError:
            previous = None
        if previous is not None:
            validate(previous, "Report")
            if previous["write_status"] in {"unknown", "saved"}:
                raise Failure("commit_outcome_uncertain", target)
        try:
            current_metadata = os.stat(name, dir_fd=parent, follow_symlinks=False)
        except FileNotFoundError:
            current_metadata = None
        metadata = None
        if planned["kind"] == "create" and current_metadata is not None:
            if vault.allowed(target) and stat.S_ISREG(current_metadata.st_mode):
                current, _ = read_at(parent, name)
                if digest(current) == planned["after_sha256"]:
                    raise Failure("commit_outcome_uncertain", target)
            raise Failure("target_exists", target)
        if planned["kind"] == "edit":
            if current_metadata is None:
                raise Failure("target_changed", target)
            current, metadata = vault.read(target, maximum_note_bytes(request))
            if digest(current) == planned["after_sha256"]:
                raise Failure("commit_outcome_uncertain", target)
            if digest(current) != planned["before_sha256"]:
                raise Failure("target_changed", target)
            with os.fdopen(os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent), "rb") as stream:
                metadata_supported(os.fstat(stream.fileno()), stream.fileno())
        try:
            os.stat(PurePosixPath(stage).name, dir_fd=parent, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise Failure("target_exists", stage)
        pending = dict(report, status="failed", exit_code=1, write_status="unknown",
                       issues=[issue("commit_outcome_uncertain", target)])
        replace_private(result_path, canonical(pending))
        committed, own_stage = False, False
        stage_name = PurePosixPath(stage).name
        try:
            try:
                descriptor = os.open(
                    stage_name, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o666 if planned["kind"] == "create" else 0o600, dir_fd=parent,
                )
            except FileExistsError as error:
                raise Failure("target_exists", stage) from error
            own_stage = True
            with os.fdopen(descriptor, "w+b") as stream:
                stream.write(candidate)
                stream.flush()
                if metadata is not None:
                    os.fchown(stream.fileno(), metadata.st_uid, metadata.st_gid)
                    os.fchmod(stream.fileno(), stat.S_IMODE(metadata.st_mode))
                os.fsync(stream.fileno())
                current_root = directory(vault.root)
                try:
                    if identity(os.fstat(current_root)) != planned["vault_identity"]:
                        raise Failure("parent_changed", target)
                finally:
                    os.close(current_root)
                with vault.parent(target) as (current_parent, _):
                    if identity(os.fstat(current_parent)) != identity(os.fstat(parent)):
                        raise Failure("parent_changed", target)
                if before is not None:
                    current, current_metadata = read_at(parent, name)
                    if digest(current) != planned["before_sha256"]:
                        raise Failure("target_changed", target)
                    if (identity(current_metadata) != identity(metadata)
                            or current_metadata.st_mode != metadata.st_mode
                            or current_metadata.st_gid != metadata.st_gid):
                        raise Failure("target_changed", target)
                    with os.fdopen(os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent), "rb") as check:
                        metadata_supported(os.fstat(check.fileno()), check.fileno())
                    os.replace(stage_name, name, src_dir_fd=parent, dst_dir_fd=parent)
                    committed, own_stage = True, False
                else:
                    try:
                        exclusive_create(parent, stage_name, name)
                    except FileExistsError as error:
                        raise Failure("target_exists", target) from error
                    committed = True
                os.fsync(parent)
                verified, _ = read_at(parent, name)
                if digest(verified) != planned["after_sha256"]:
                    raise OSError("Post-commit verification failed")
                if own_stage:
                    os.unlink(stage_name, dir_fd=parent)
                    own_stage = False
                    os.fsync(parent)
                replace_private(receipt_path, canonical(expected_receipt))
                report.update(operation_state="saved", write_status="saved")
                report["data"].update(
                    after_sha256=digest(verified), changed=True, verified=True,
                )
                report["issues"].append(issue("saved", target))
                replace_private(result_path, canonical(report))
        except (OSError, Failure) as error:
            report["issues"] = [item for item in report["issues"] if item["code"] != "saved"]
            if own_stage:
                try:
                    os.unlink(stage_name, dir_fd=parent)
                except OSError as cleanup_error:
                    report["issues"].append(issue("runtime_error", stage))
                    if not committed:
                        report.update(status="failed", exit_code=1, operation_state="blocked")
                        report["issues"].append(issue("write_failed_before_commit", target))
                        raise Failure("write_failed_before_commit", target, status="failed", exit_code=1) from cleanup_error
            report.update(
                status="failed" if committed or not isinstance(error, Failure) else error.status,
                exit_code=1 if committed or not isinstance(error, Failure) else error.exit_code,
                operation_state="blocked", write_status="unknown" if committed else "unsaved",
            )
            report["data"].update(changed=None if committed else False, verified=False,
                                  after_sha256=None)
            code = "commit_outcome_uncertain" if committed else error.code if isinstance(error, Failure) else "write_failed_before_commit"
            report["issues"].append(issue(code, target))
            try:
                replace_private(result_path, canonical(report))
            except (OSError, Failure):
                report["issues"].append(issue("runtime_error", str(result_path)))
            return


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise Failure("invalid_request", status="failed", exit_code=1)


def arguments(argv):
    parser = Parser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True, parser_class=Parser)
    for name, command in CONTRACT["x-commands"].items():
        child = commands.add_parser(name)
        for flag in command["required"]:
            child.add_argument(flag, required=True)
        for flag in command["optional"]:
            child.add_argument(flag)
    return parser.parse_args(argv)


def run(argv):
    command = argv[0] if argv and argv[0] in CONTRACT["x-commands"] else "inspect"
    report = {
        "schema_version": 1, "command": command, "status": "completed", "exit_code": 0,
        "write_status": "unsaved" if command in {"plan", "apply"} else "not_requested",
        "operation_state": "scoped", "request_sha256": None,
        "coverage": {"whole_vault": False, "enumeration_complete": True,
                     "reads_complete": True, "parses_complete": True,
                     "processed": [], "unprocessed": []},
        "issues": [], "data": None,
    }
    vault = None
    try:
        args = arguments(argv)
        request_bytes = Path(args.request).read_bytes()
        report["request_sha256"] = digest(request_bytes)
        request = strict_json(request_bytes)
        validate(request, "Request")
        if not request["consent"]["model_context"]:
            raise Failure("consent_missing")
        if sys.platform != "linux" or not hasattr(os, "O_NOFOLLOW"):
            raise Failure("capability_missing", exit_code=4)
        vault = Vault(request)
        report["coverage"]["whole_vault"] = ("directory", ".") in vault.scopes
        if command == "inspect":
            inspect(request, vault, report)
        elif command == "read":
            data, _ = vault.read(args.path, maximum_note_bytes(request))
            report["coverage"]["processed"] = [relative(args.path)]
            report["data"] = {"path": relative(args.path), "sha256": digest(data),
                              "bytes": len(data), "content": data.decode("utf-8")}
        else:
            if command == "apply":
                write_capabilities()
            fcntl.flock(vault.fd, fcntl.LOCK_EX)
            try:
                if command == "plan":
                    plan(request, vault, report, args)
                else:
                    apply(request, vault, report, args)
            finally:
                fcntl.flock(vault.fd, fcntl.LOCK_UN)
    except Failure as error:
        report.update(status=error.status, exit_code=error.exit_code,
                      operation_state="blocked")
        report["issues"].append(issue(error.code, error.path))
    except (ValueError, UnicodeError, ValidationError, OSError) as error:
        code = ("unsupported_format" if isinstance(error, UnicodeError)
                else "read_failed" if command == "read" and isinstance(error, OSError)
                else "invalid_request" if isinstance(error, (ValueError, ValidationError))
                else "runtime_error")
        report.update(status="failed", exit_code=1, operation_state="blocked")
        report["issues"].append(issue(code))
    finally:
        if vault is not None:
            vault.close()
    validate(report, "Report")
    return report


def main():
    report = run(sys.argv[1:])
    print(json.dumps(report, ensure_ascii=False, allow_nan=False))
    return report["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
