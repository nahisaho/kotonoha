#!/usr/bin/env python3
# /// script
# requires-python = "==3.12.*"
# dependencies = ["markdown-it-py>=3,<5", "PyYAML>=6,<7", "jsonschema>=4,<5"]
# ///
"""Scope-bound Canvas diagnostics and explicitly approved single-file transactions."""
from __future__ import annotations

from contextlib import contextmanager
import copy
import errno
import fcntl
import hashlib
import importlib.util
import ipaddress
import json
import math
import os
from pathlib import Path
import posixpath
import re
import stat
import sys
from urllib.parse import unquote, urlsplit

from jsonschema import Draft202012Validator, ValidationError

SKILL = Path(__file__).resolve().parent.parent
CONTROL_MAX = 1048576
SAFE = 9007199254740991
CHECKS = ("actors", "negation", "conditions", "modality", "scope", "causality",
          "quantity_bindings", "terminology", "structure")
PREFIXES = {"evidence": "[根拠あり] ", "proposal": "[提案] ", "unverified": "[未確認] "}
COMMON = {"id", "type", "x", "y", "width", "height", "color"}
EXTRA = {"text": {"text"}, "file": {"file", "subpath"}, "link": {"url"},
         "group": {"label", "background", "backgroundStyle"}}
EDGE = {"id", "fromNode", "toNode", "fromSide", "toSide", "fromEnd", "toEnd", "color", "label"}
SEMANTIC = {"text", "file", "subpath", "url", "label", "background",
            "fromNode", "toNode", "fromEnd", "toEnd"}
VIRTUAL = {"nodes_presence", "edges_presence", "nodes_order", "edges_order"}


class Failure(Exception):
    def __init__(self, code, exit_code=2, *, path=None):
        self.code, self.exit_code = code, exit_code
        self.path = path
        super().__init__(code)


class Number(str):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def strict_json(data, *, numbers=False):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate_key")
            result[key] = value
        return result

    def constant(_):
        raise ValueError("nonfinite_number")

    def finite(raw):
        value = float(raw)
        if not math.isfinite(value):
            raise ValueError("nonfinite_number")
        return value

    text = data.decode("utf-8")
    if text.startswith("\ufeff"):
        raise ValueError("utf8_bom")
    result = json.loads(text, object_pairs_hook=pairs, parse_constant=constant,
                        **({"parse_int": Number, "parse_float": Number} if numbers else {"parse_float": finite}))
    if not numbers:
        pending = [result]
        while pending:
            item = pending.pop()
            if isinstance(item, str) and any(0xD800 <= ord(c) <= 0xDFFF for c in item):
                raise ValueError("unicode_scalar")
            if isinstance(item, dict):
                pending.extend(item.keys())
                pending.extend(item.values())
            elif isinstance(item, list):
                pending.extend(item)
    return result


CONTRACT_BYTES = (SKILL / "references/execution-contract.json").read_bytes()
CONTRACT = strict_json(CONTRACT_BYTES)


def validate(value, definition):
    Draft202012Validator({"$ref": f"#/$defs/{definition}",
                           "$defs": CONTRACT["$defs"]}).validate(value)


def issue(code, path=None, entity="document", id=None, field=None, related_ids=None,
          category=None):
    if category is None:
        category = next(k for k, v in CONTRACT["x-diagnostic-codes"].items() if code in v)
    return dict(path=path, category=category, code=code, entity=entity, id=id,
                field=field, related_ids=related_ids or [])


def load_module(path, name):
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    except (OSError, ImportError, AttributeError):
        raise Failure("dependency_missing", 4) from None


def backend():
    module = load_module(SKILL.parent / "obsidian-vault/scripts/vault.py", "canvas_storage")
    if (getattr(module, "STORAGE_API_VERSION", None) != 1
            or not all(callable(getattr(getattr(module, "Vault", None), name, None)) for name in
                       ("read_authorized", "stat_authorized", "enumerate_authorized"))
            or not all(callable(getattr(module, name, None)) for name in (
                "commit_bytes", "directory", "identity", "metadata_supported", "write_capabilities",
                "local_filesystem", "diff_bytes", "parse_note", "masked_body", "extract_links"))):
        raise Failure("dependency_missing", 4)
    return module


def gate():
    module = load_module(SKILL.parent / "japanese-prose/scripts/invariants.py", "canvas_gate")
    if (tuple(getattr(module, "SEMANTIC_CHECKS", ())) != CHECKS
            or not callable(getattr(module, "check_bytes", None))):
        raise Failure("dependency_missing", 4)
    return module


def integer(number):
    """Classify the decimal lexeme without exponent-sized allocations or float rounding."""
    if isinstance(number, bool) or not isinstance(number, (Number, int, float)):
        return None, "invalid_type"
    raw = str(number).lower()
    match = re.fullmatch(r"(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?", raw)
    if not match:
        return None, "invalid_type"
    sign, whole, fraction, exponent = match.groups()
    fraction = fraction or ""
    digits = (whole + fraction).lstrip("0")
    if not digits:
        return 0, None
    exp = (exponent or "0").lstrip("+")
    magnitude = exp.lstrip("-").lstrip("0") or "0"
    # Only a shift within the input's length can produce a small integer.
    if len(magnitude) > len(str(len(raw) + 32)):
        return None, "invalid_type" if exp.startswith("-") else "integer_range"
    shift = int(exp) - len(fraction)
    if shift < 0:
        if -shift > len(digits) or any(c != "0" for c in digits[shift:]):
            return None, "invalid_type"
        digits = digits[:shift]
    elif len(digits) + shift > 16:
        return None, "integer_range"
    else:
        digits += "0" * shift
    digits = digits.lstrip("0") or "0"
    if len(digits) > 16 or len(digits) == 16 and digits > str(SAFE):
        return None, "integer_range"
    return (-1 if sign else 1) * int(digits), None


def request_json(data):
    holder = [strict_json(data, numbers=True)]
    pending = [(holder, 0)]
    while pending:
        parent, key = pending.pop()
        value = parent[key]
        if isinstance(value, Number):
            value, error = integer(value)
            if error:
                raise ValueError("invalid_input")
            parent[key] = value
        elif isinstance(value, str):
            if any(0xD800 <= ord(c) <= 0xDFFF for c in value):
                raise ValueError("invalid_input")
        elif isinstance(value, dict):
            if any(any(0xD800 <= ord(c) <= 0xDFFF for c in field) for field in value):
                raise ValueError("invalid_input")
            pending.extend((value, field) for field in value)
        elif isinstance(value, list):
            pending.extend((value, index) for index in range(len(value)))
    return holder[0]


def forbidden(path, *, parents=False):
    if (not isinstance(path, str) or not path or path.startswith(("/", "\\"))
            or "\\" in path or any(ord(c) < 32 or ord(c) == 127 for c in path)
            or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", path)):
        return True
    parts = path.split("/")
    return (any(p.lower() in {".git", ".obsidian"} for p in parts)
            or not parents and ".." in parts)


def safe_path(path, *, dot=False):
    if forbidden(path):
        raise Failure("scope_refused")
    normalized = posixpath.normpath(path)
    if normalized == "." and not dot:
        raise Failure("scope_refused")
    return normalized


def valid_url(raw):
    try:
        url = urlsplit(raw)
        host = url.hostname
        if (url.scheme.lower() not in {"http", "https"} or not host
                or "\\" in raw or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in raw)):
            return False
        _ = url.port
        try:
            ipaddress.ip_address(host)
        except ValueError:
            ascii_host = host.encode("idna").decode("ascii").removesuffix(".")
            labels = ascii_host.split(".")
            if (len(ascii_host) > 253 or len(labels) == 4 and all(label.isdigit() for label in labels)
                    or not all(re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                               for label in labels)):
                return False
        return True
    except (ValueError, UnicodeError):
        return False


def text_links(storage, text):
    masked, _, _ = storage.masked_body(text)
    internal, _, all_raw = storage.extract_links(text, masked, 0)
    remaining = iter(internal)
    next_internal = next(remaining, None)
    records, occupied, position = [], [], 0
    for raw in all_raw:
        start = text.find(raw, position)
        while start >= 0 and masked[start:start + 1] != text[start:start + 1]:
            start = text.find(raw, start + 1)
        position = start + len(raw)
        occupied.append((start, position))
        if next_internal is not None and next_internal["raw"] == raw:
            records.append((start, next_internal))
            next_internal = next(remaining, None)
            continue
        wiki = re.fullmatch(r"!?\[\[(.*?)\]\]", raw)
        if wiki:
            destination = wiki[1].replace("\\|", "|").split("|", 1)[0]
        else:
            children = storage.MARKDOWN.parseInline(raw)[0].children or []
            target = next((token for token in children if token.type in {"link_open", "image"}), None)
            destination = target.attrGet("href" if target.type == "link_open" else "src") if target else ""
        records.append((start, {"raw": raw, "syntax": "external", "destination": destination}))
    for match in re.finditer(r"https?://[^\s<>]+", masked, re.I):
        if not any(start <= match.start() < end for start, end in occupied):
            records.append((match.start(), {"raw": text[match.start():match.end()],
                                            "syntax": "external", "destination": text[match.start():match.end()]}))
    return [link for _, link in sorted(records, key=lambda item: item[0])]


def contains(group, node):
    return (group["width"] > 0 and group["height"] > 0
            and node["width"] > 0 and node["height"] > 0
            and group["x"] <= node["x"] and group["y"] <= node["y"]
            and group["x"] + group["width"] >= node["x"] + node["width"]
            and group["y"] + group["height"] >= node["y"] + node["height"])


def intersects(a, b):
    return (min(a["width"], a["height"], b["width"], b["height"]) > 0
            and a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"]
            and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"])


def prefix(value):
    if not isinstance(value, str):
        return None
    for category, marker in PREFIXES.items():
        if value.startswith(marker):
            rest = value[len(marker):]
            if not rest.startswith(" ") and not any(rest.startswith(other.rstrip()) for other in PREFIXES.values()):
                return category
    return None


def effective(document):
    nodes = document.get("nodes", [])
    by_id = {n["id"]: n for n in nodes}
    node_positions = {n["id"]: i for i, n in enumerate(nodes)}
    groups = [(i, n) for i, n in enumerate(nodes) if n["type"] == "group"]
    result, carriers = {}, {}
    for entity, objects in (("node", nodes), ("edge", document.get("edges", []))):
        for index, obj in enumerate(objects):
            key = entity, obj["id"]
            field = "text" if obj.get("type") == "text" else "label"
            own = prefix(obj.get(field))
            if own:
                result[key], carriers[key] = own, {(entity, obj["id"], field)}
                continue
            subjects = [obj] if entity == "node" else [by_id[obj["fromNode"]], by_id[obj["toNode"]]]
            choices = [(i, g) for i, g in groups
                       if (entity == "edge" or i < index)
                       and all(i < node_positions[n["id"]] for n in subjects)
                       and all(contains(g, n) and g is not n for n in subjects)]
            inner = [(i, g) for i, g in choices
                     if not any(g is not h and contains(g, h) and not contains(h, g)
                                for _, h in choices)]
            categories = {prefix(g.get("label")) for _, g in inner}
            result[key] = next(iter(categories)) if len(categories) == 1 else (
                "ambiguous" if categories else None)
            carriers[key] = {("node", g["id"], "label") for _, g in inner}
    return result, carriers


def parse_document(data, path):
    issues = []
    diagnostics = dict(structure="supported", references=[], issues=issues,
                       render_check="not_performed")
    try:
        document = strict_json(data, numbers=True)
    except UnicodeDecodeError:
        issues.append(issue("utf8_decode", path))
        diagnostics["structure"] = "unsupported"
        return None, diagnostics
    except (ValueError, RecursionError) as error:
        code = str(error) if str(error) in {"duplicate_key", "nonfinite_number", "utf8_bom"} else "json_syntax"
        issues.append(issue(code, path))
        diagnostics["structure"] = "unsupported" if code == "utf8_bom" else "invalid"
        return None, diagnostics

    def add(code, entity="document", obj=None, field=None, related=None):
        identifier = obj.get("id") if isinstance(obj, dict) else None
        if not isinstance(identifier, str) or isinstance(identifier, Number):
            identifier = None
        if identifier is not None and any(0xD800 <= ord(c) <= 0xDFFF for c in identifier):
            identifier = None
        if field is not None and any(0xD800 <= ord(c) <= 0xDFFF for c in field):
            field = None
        issues.append(issue(code, path, entity, identifier, field, related))

    def scalar(value):
        pending = [value]
        while pending:
            item = pending.pop()
            if isinstance(item, str) and any(0xD800 <= ord(c) <= 0xDFFF for c in item):
                return True
            if isinstance(item, list):
                pending.extend(item)
            elif isinstance(item, dict):
                pending.extend(item.keys())
                pending.extend(item.values())
        return False

    if not isinstance(document, dict):
        add("invalid_type")
    else:
        for name in sorted(document):
            if name not in {"nodes", "edges"}:
                add("unknown_attribute", field=name)
        for collection, entity in (("nodes", "node"), ("edges", "edge")):
            objects = document.get(collection, [])
            if not isinstance(objects, list):
                add("invalid_type", field=collection)
                continue
            seen = set()
            for obj in objects:
                if not isinstance(obj, dict):
                    add("invalid_type", entity)
                    continue
                raw_kind = obj.get("type")
                kind = raw_kind if isinstance(raw_kind, str) and not isinstance(raw_kind, Number) else None
                unknown_kind = entity == "node" and kind is not None and kind not in EXTRA
                known = COMMON | EXTRA.get(kind, set()) if entity == "node" else EDGE
                required = ({"id", "type", "x", "y", "width", "height"}
                            | ({"text"} if kind == "text" else {"file"} if kind == "file"
                               else {"url"} if kind == "link" else set())
                            if entity == "node" else {"id", "fromNode", "toNode"})
                for field in sorted(required - obj.keys()):
                    add("missing_required", entity, obj, field)
                for field in sorted(obj):
                    value = obj[field]
                    if scalar(value) or scalar(field):
                        add("unicode_scalar", entity, obj, field)
                    if field not in known:
                        if not unknown_kind:
                            add("unknown_attribute", entity, obj, field)
                        continue
                    if field in {"x", "y", "width", "height"}:
                        value, error = integer(value)
                        if error:
                            add(error, entity, obj, field)
                        else:
                            obj[field] = value
                    elif not isinstance(value, str) or isinstance(value, Number):
                        add("invalid_type", entity, obj, field)
                    elif field == "type" and unknown_kind:
                        add("unknown_node_type", entity, obj, field)
                    elif field == "color" and not re.fullmatch(r"(?:[1-6]|#[0-9A-Fa-f]{6})", value):
                        add("unsupported_color", entity, obj, field)
                    elif (field in {"fromSide", "toSide"} and value not in {"top", "bottom", "left", "right"}
                          or field in {"fromEnd", "toEnd"} and value not in {"none", "arrow"}
                          or field == "backgroundStyle" and value not in {"cover", "ratio", "repeat"}
                          or field == "subpath" and not value.startswith("#")):
                        add("invalid_enum", entity, obj, field)
                identifier = obj.get("id")
                if isinstance(identifier, str):
                    if identifier in seen:
                        add("duplicate_id", entity, obj, "id")
                    seen.add(identifier)
        nodes = document.get("nodes", [])
        edges = document.get("edges", [])
        if isinstance(nodes, list) and isinstance(edges, list):
            ids = {n.get("id") for n in nodes if isinstance(n, dict) and isinstance(n.get("id"), str)}
            for edge in edges:
                if isinstance(edge, dict):
                    for field in ("fromNode", "toNode"):
                        if isinstance(edge.get(field), str) and edge[field] not in ids:
                            add("missing_endpoint", "edge", edge, field, [edge[field]])
    if scalar(document) and not any(i["code"] == "unicode_scalar" for i in issues):
        add("unicode_scalar")
    diagnostics["structure"] = (
        "unsupported" if any(i["code"] == "unicode_scalar" for i in issues)
        else "invalid" if any(i["category"] == "format" for i in issues)
        else "unsupported" if issues else "supported")
    if diagnostics["structure"] == "supported":
        nodes = document.get("nodes", [])
        for index, node in enumerate(nodes):
            for field in ("height", "width"):
                if node[field] <= 0:
                    add("nonpositive_size", "node", node, field)
            if node["type"] != "group":
                for earlier in nodes[:index]:
                    if earlier["type"] != "group" and intersects(earlier, node):
                        add("overlap", "node", node, related=[earlier["id"]])
        categories, _ = effective(document)
        for (entity, identifier), category in categories.items():
            if category == "ambiguous":
                issues.append(issue("ambiguous_marking", path, entity, identifier))
    if isinstance(document, dict):
        positions = {("document", None): -1}
        for offset, collection in ((0, "nodes"), (1000000000, "edges")):
            objects = document.get(collection, [])
            if isinstance(objects, list):
                for index, obj in enumerate(objects):
                    if isinstance(obj, dict):
                        identifier = obj.get("id")
                        if isinstance(identifier, str):
                            positions.setdefault((collection[:-1], identifier), offset + index)
        issues.sort(key=lambda i: (positions.get((i["entity"], i["id"]), -1),
                                   i["field"] or "", i["code"], i["related_ids"]))
    return document, diagnostics


class Session:
    def __init__(self, request, storage):
        self.request, self.storage = request, storage
        self.vault = storage.Vault(request)
        self.versions, self.paths, self.total = set(), set(), 0
        self.exhausted = False
        self.notes_cache = {}
        self.version_sizes = {}

    def reserve(self, path, data):
        key = path, digest(data)
        if key in self.versions:
            return
        limits = self.request["limits"]
        if ((limits["max_file_bytes"] is not None and len(data) > limits["max_file_bytes"])
                or limits["max_files"] is not None and path not in self.paths and len(self.paths) >= limits["max_files"]
                or limits["max_total_bytes"] is not None and self.total + len(data) > limits["max_total_bytes"]):
            self.exhausted = True
            raise Failure("limit_exceeded")
        self.versions.add(key)
        self.paths.add(path)
        self.total += len(data)

    def read(self, path):
        safe_path(path)
        if not self.vault.allowed(path):
            raise Failure("scope_refused")
        limits = self.request["limits"]
        maximum = limits["max_file_bytes"]
        # Reserve-size checks precede reading new bodies. Previously seen versions
        # may be re-read without consuming their budget a second time.
        try:
            metadata = self.vault.stat_authorized(path)
        except self.storage.Failure as error:
            if error.code in {"symlink_not_followed", "outside_scope", "invalid_path", "unsupported_format"}:
                raise Failure("scope_refused") from None
            raise
        known_sizes = [size for (name, _), size in self.version_sizes.items() if name == path]
        new_size = metadata.st_size not in known_sizes
        if new_size and (
                limits["max_files"] is not None and path not in self.paths and len(self.paths) >= limits["max_files"]
                or limits["max_total_bytes"] is not None and self.total + metadata.st_size > limits["max_total_bytes"]):
            self.exhausted = True
            raise Failure("limit_exceeded")
        if limits["max_total_bytes"] is not None:
            available = max(limits["max_total_bytes"] - self.total, max(known_sizes, default=0))
            maximum = min(maximum, available) if maximum is not None else available
        try:
            data, metadata = self.vault.read_authorized(path, maximum)
        except self.storage.Failure as error:
            if error.code == "limit_reached":
                self.exhausted = True
                raise Failure("limit_exceeded") from None
            if error.code in {"symlink_not_followed", "outside_scope", "invalid_path", "unsupported_format"}:
                raise Failure("scope_refused") from None
            raise
        self.reserve(path, data)
        self.version_sizes[(path, digest(data))] = len(data)
        return data, metadata

    def note(self, path):
        if path not in self.notes_cache:
            data, _ = self.read(path)
            self.notes_cache[path] = self.storage.parse_note(path, data)
        return self.notes_cache[path]

    def resolve(self, path, fragment):
        if forbidden(path):
            return "forbidden_path", []
        path = posixpath.normpath(path)
        if not self.vault.allowed(path):
            return "outside_scope", []
        try:
            metadata = self.vault.stat_authorized(path)
            if not stat.S_ISREG(metadata.st_mode):
                return "not_regular_file", []
        except FileNotFoundError:
            return "missing_file", []
        except (OSError, self.storage.Failure):
            return "read_failed", []
        candidates = [path]
        note = None
        if path.endswith(".md"):
            try:
                note = self.note(path)
            except Failure:
                return "limit_exceeded", candidates
            except (OSError, ValueError, self.storage.Failure):
                return "target_parse_incomplete", candidates
            if note["fatal"]:
                return "target_parse_incomplete", candidates
        if fragment is None:
            return "file_exists", candidates
        if note is None or not fragment.startswith("#") or fragment.startswith("#^"):
            return "unsupported_subpath", candidates
        heading = fragment[1:]
        if note["headings"].count(heading) > 1:
            return "ambiguous_heading", candidates
        if heading in note["headings"]:
            return "heading_exists", candidates
        if note["unsupported_heading"]:
            return "unsupported_subpath", candidates
        return "missing_heading", candidates

    def text_reference(self, canvas, link):
        raw, syntax = link["destination"], link["syntax"]
        path, separator, heading = raw.partition("#")
        fragment = "#" + heading if separator else None
        if syntax == "external" or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", raw):
            return ("external_url" if valid_url(raw) else "forbidden_url"), [], fragment
        if syntax == "unsupported" or not path:
            return "unsupported_reference", [], fragment
        if forbidden(path, parents=syntax == "markdown"):
            return "forbidden_path", [], fragment
        if syntax == "markdown":
            try:
                if re.search(r"%(?![0-9A-Fa-f]{2})", path + heading):
                    raise ValueError()
                path, heading = unquote(path, errors="strict"), unquote(heading, errors="strict")
            except (ValueError, UnicodeError):
                return "unsupported_reference", [], fragment
            fragment = "#" + heading if separator else None
            if forbidden(path, parents=True):
                return "forbidden_path", [], fragment
            path = posixpath.normpath(posixpath.join(posixpath.dirname(canvas), path))
            if forbidden(path):
                return "forbidden_path", [], fragment
            if not path.endswith(".md"):
                return "unsupported_reference", [], fragment
        else:
            if Path(path).suffix and not path.endswith(".md"):
                return "unsupported_reference", [], fragment
            path = path if path.endswith(".md") else path + ".md"
            if "/" not in path:
                names, _, _, complete = self.vault.enumerate_authorized((".md",))
                candidates = sorted(n for n in names if posixpath.basename(n) == path)
                if len(candidates) > 1:
                    return "multiple_notes", candidates, fragment
                whole = ("directory", ".") in self.vault.scopes
                if not whole or not complete:
                    return "incomplete_search", candidates, fragment
                if not candidates:
                    return "missing_file", [], fragment
                path = candidates[0]
        reason, candidates = self.resolve(path, fragment)
        return reason, candidates, fragment

    def diagnose(self, data, path):
        document, diagnostics = parse_document(data, path)
        if (diagnostics["structure"] == "invalid" or document is None
                or any(i["code"] == "unicode_scalar" for i in diagnostics["issues"])):
            return document, diagnostics
        for entity, collection in (("node", "nodes"), ("edge", "edges")):
            objects = document.get(collection, [])
            if not isinstance(objects, list):
                continue
            for obj in objects:
                if not isinstance(obj, dict) or not isinstance(obj.get("id"), str):
                    continue
                for field in ("file", "background", "url", "text", "label"):
                    if not isinstance(obj.get(field), str):
                        continue
                    if field in {"text", "label"}:
                        links = text_links(self.storage, obj[field])
                        records = [(link["raw"], link, None) for link in links]
                    else:
                        records = [(obj[field], None, obj.get("subpath") if field == "file" else None)]
                    for occurrence, (raw, link, fragment) in enumerate(records, 1):
                        policy = False
                        if diagnostics["structure"] != "supported":
                            if link:
                                _, separator, heading = link["destination"].partition("#")
                                fragment = "#" + heading if separator else None
                            reason, candidates = "source_parse_incomplete", []
                        elif link:
                            reason, candidates, fragment = self.text_reference(path, link)
                        elif field == "url":
                            valid = valid_url(raw)
                            reason, candidates = ("external_url" if valid else "forbidden_url"), []
                            policy = not valid
                        else:
                            reason, candidates = self.resolve(raw, fragment)
                            policy = reason == "forbidden_path"
                        diagnostics["references"].append(dict(
                            canvas=path, entity=entity, id=obj["id"], field=field,
                            occurrence=occurrence, raw=raw, fragment=fragment,
                            classification=CONTRACT["x-reference-reasons"][reason]["classification"],
                            reason=reason, candidates=candidates, policy_forbidden=policy))
        return document, diagnostics


def partial(diagnostics):
    return (diagnostics["structure"] != "supported"
            or any(CONTRACT["x-reference-reasons"][r["reason"]]["partial"]
                   for r in diagnostics["references"]))


def context(request, command):
    validate(request, "Request")
    if (not os.path.isabs(request["vault_root"]) or ".." in request["vault_root"].split("/")
            or request["workspace"] is not None and (
                not os.path.isabs(request["workspace"]) or ".." in request["workspace"].split("/"))):
        raise Failure("invalid_input", 1)
    if ((command in {"inspect", "read"}) != (request["intent"] == "inspect")
            or command == "layout" and (request["intent"] not in {"create", "edit"} or request["layout"] is None)
            or command != "layout" and request["layout"] is not None
            or command in {"layout", "plan", "apply"} and request["workspace"] is None):
        raise Failure("invalid_input", 1)
    for scope in request["read_scopes"]:
        safe_path(scope["path"], dot=scope["kind"] == "directory")
    if request["write_target"] is not None:
        safe_path(request["write_target"])
        if not request["write_target"].endswith(".canvas"):
            raise Failure("invalid_input", 1)
    seen, set_fields = {}, {}
    for mutation in request["mutations"]:
        entity, identifier, action, fields = (mutation[k] for k in ("entity", "id", "action", "fields"))
        if entity == "document":
            valid = identifier is None and action == "set" and bool(fields) and set(fields) <= VIRTUAL
        else:
            allowed = (COMMON | set().union(*EXTRA.values()) if entity == "node" else EDGE) - {"id", "type"}
            valid = (identifier is not None and (action == "set" and bool(fields) and set(fields) <= allowed
                                                or action in {"add", "remove"} and not fields))
        key = entity, identifier
        previous = seen.setdefault(key, [])
        disjoint_set = (action == "set" and all(a == "set" for a in previous)
                        and not (set_fields.get(key, set()) & set(fields)))
        retype_pair = entity == "node" and previous == ["remove"] and action == "add"
        if not valid or previous and not (retype_pair or disjoint_set):
            raise Failure("invalid_input", 1)
        previous.append(action)
        if action == "set":
            set_fields.setdefault(key, set()).update(fields)
    bindings = [(m["entity"], m["id"]) for m in request["markings"]]
    if len(bindings) != len(set(bindings)) or any(not t.strip() for t in request["protected_terms"]):
        raise Failure("invalid_input", 1)
    if not request["consent"]["model_context"] or (
            command in {"layout", "plan", "apply"} and not request["consent"]["workspace_copies"]):
        raise Failure("consent_required")


def private_metadata(metadata, mode, directory=False):
    if (metadata.st_uid != os.geteuid() or stat.S_IMODE(metadata.st_mode) != mode
            or not (stat.S_ISDIR(metadata.st_mode) if directory else stat.S_ISREG(metadata.st_mode))):
        raise Failure("scope_refused")


@contextmanager
def private_parent(request, path):
    workspace = request["workspace"]
    path = os.fspath(path)
    root = os.path.normpath(request["vault_root"])
    if (not workspace or not os.path.isabs(workspace) or not os.path.isabs(path)
            or ".." in path.split("/") or ".." in workspace.split("/")
            or os.path.commonpath([root, workspace]) in {root, os.path.normpath(workspace)}
            or os.path.commonpath([workspace, path]) != workspace or path == workspace):
        raise Failure("scope_refused")
    storage = backend()
    descriptor = storage.directory(workspace)
    try:
        private_metadata(os.fstat(descriptor), 0o700, True)
        parts = os.path.relpath(path, workspace).split("/")
        for part in parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
            private_metadata(os.fstat(descriptor), 0o700, True)
        yield descriptor, parts[-1]
    except OSError as error:
        if error.errno in {errno.ELOOP, errno.ENOTDIR, errno.EACCES}:
            raise Failure("scope_refused") from None
        raise
    finally:
        os.close(descriptor)


def private_read(request, path, maximum=CONTROL_MAX):
    with private_parent(request, path) as (parent, name):
        descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        with os.fdopen(descriptor, "rb") as stream:
            metadata = os.fstat(stream.fileno())
            private_metadata(metadata, 0o600)
            if maximum is not None and metadata.st_size > maximum:
                raise Failure("limit_exceeded")
            data = stream.read() if maximum is None else stream.read(maximum + 1)
            if maximum is not None and len(data) > maximum:
                raise Failure("limit_exceeded")
            return data


def private_write(request, path, data, *, replace=False):
    with private_parent(request, path) as (parent, name):
        stage = "." + name + ".tmp" if replace else name
        try:
            descriptor = os.open(stage, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                                 0o600, dir_fd=parent)
        except FileExistsError:
            raise Failure("workspace_conflict", path=str(Path(path).with_name(stage))) from None
        with os.fdopen(descriptor, "wb") as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if replace:
            os.replace(stage, name, src_dir_fd=parent, dst_dir_fd=parent)
        os.fsync(parent)


def private_mkdir(request, path):
    with private_parent(request, path) as (parent, name):
        os.mkdir(name, 0o700, dir_fd=parent)
        os.chmod(name, 0o700, dir_fd=parent, follow_symlinks=False)
        os.fsync(parent)


def changed_delta(request, before, after):
    mutations = request["mutations"]
    permissions = {}
    for mutation in mutations:
        permissions.setdefault((mutation["entity"], mutation["id"], mutation["action"]), set()).update(mutation["fields"])
    proofread = request["intent"] == "proofread"
    refusal = "protected_change" if proofread else "unrequested_change"
    delta, strings = [], []
    removed_nodes = {n["id"] for n in before.get("nodes", [])} - {n["id"] for n in after.get("nodes", [])}
    if request["intent"] == "create":
        return [], []
    if proofread:
        for mutation in mutations:
            entity = mutation["entity"]
            objects = {o["id"]: o for o in before.get(entity + "s", [])} if entity != "document" else {}
            obj = objects.get(mutation["id"])
            if (obj is None or mutation["action"] != "set"
                    or any(not (f == "text" and obj.get("type") == "text"
                                or f == "label" and (entity == "edge" or obj.get("type") == "group"))
                           or not isinstance(obj.get(f), str) for f in mutation["fields"])):
                raise Failure("protected_change")
    for mutation in mutations:
        if mutation["entity"] != "document":
            collection = mutation["entity"] + "s"
            old = {o["id"]: o for o in before.get(collection, [])}
            new = {o["id"]: o for o in after.get(collection, [])}
            if mutation["action"] in {"set", "remove"} and mutation["id"] not in old:
                raise Failure("invalid_input", 1)
            if mutation["action"] == "add" and mutation["id"] in old:
                if not ((mutation["entity"], mutation["id"], "remove") in permissions
                        and mutation["id"] in new and old[mutation["id"]].get("type") != new[mutation["id"]].get("type")):
                    raise Failure("invalid_input", 1)
    def change(entity, identifier, action, field=None, dependency=False):
        delta.append(dict(entity=entity, id=identifier, action=action, field=field, dependency=dependency))
    for collection in ("nodes", "edges"):
        old, new = before.get(collection, []), after.get(collection, [])
        entity = collection[:-1]
        old_ids, new_ids = [o["id"] for o in old], [o["id"] for o in new]
        if (collection in before) != (collection in after):
            field = collection + "_presence"
            dependency = (collection not in before and bool(new)
                          and all((entity, i, "add") in permissions for i in new_ids))
            if not dependency and field not in permissions.get(("document", None, "set"), set()):
                raise Failure(refusal)
            change("document", None, "set", field, dependency)
        if [i for i in old_ids if i in new_ids] != [i for i in new_ids if i in old_ids]:
            field = collection + "_order"
            if field not in permissions.get(("document", None, "set"), set()):
                raise Failure(refusal)
            change("document", None, "set", field)
    for collection in ("nodes", "edges"):
        entity = collection[:-1]
        old = {o["id"]: o for o in before.get(collection, [])}
        new = {o["id"]: o for o in after.get(collection, [])}
        for identifier, obj in old.items():
            if identifier not in new:
                dependency = entity == "edge" and bool({obj["fromNode"], obj["toNode"]} & removed_nodes)
                if proofread or (entity, identifier, "remove") not in permissions and not dependency:
                    raise Failure(refusal)
                change(entity, identifier, "remove", dependency=dependency)
                continue
            final = new[identifier]
            if entity == "node" and obj["type"] != final["type"]:
                if proofread or not all((entity, identifier, a) in permissions for a in ("remove", "add")):
                    raise Failure(refusal)
                change(entity, identifier, "remove")
                change(entity, identifier, "add")
                continue
            for field in sorted(obj.keys() | final.keys()):
                if (field in obj) == (field in final) and obj.get(field) == final.get(field):
                    continue
                if field not in permissions.get((entity, identifier, "set"), set()):
                    raise Failure(refusal)
                if proofread:
                    valid = (field == "text" and obj.get("type") == "text"
                             or field == "label" and (entity == "edge" or obj.get("type") == "group"))
                    if not valid or not isinstance(obj.get(field), str) or not isinstance(final.get(field), str):
                        raise Failure("protected_change")
                    strings.append((entity, identifier, field, obj[field], final[field]))
                change(entity, identifier, "set", field)
        for identifier in new:
            if identifier not in old:
                if proofread or (entity, identifier, "add") not in permissions:
                    raise Failure(refusal)
                change(entity, identifier, "add")
    if proofread and not strings:
        raise Failure("protected_change")
    return delta, strings


def marking_gate(request, before, after, delta):
    old, _ = effective(before)
    current, carriers = effective(after)
    proofread = request["intent"] == "proofread"
    needed = set(current) if request["intent"] == "create" else {
        (d["entity"], d["id"]) for d in delta
        if d["action"] == "add" or d["action"] == "set" and d["field"] in SEMANTIC}
    if proofread:
        needed = set()
    for key in old.keys() & current.keys():
        if old[key] != current[key]:
            if proofread:
                raise Failure("protected_change")
            needed.add(key)
            delta.append(dict(entity=key[0], id=key[1], action="set",
                              field="effective_category", dependency=True))
    if proofread:
        for collection in ("nodes", "edges"):
            final = {o["id"]: o for o in after.get(collection, [])}
            for obj in before.get(collection, []):
                field = "text" if obj.get("type") == "text" else "label"
                if prefix(obj.get(field)) != prefix(final[obj["id"]].get(field)):
                    raise Failure("protected_change")
    bindings = {(m["entity"], m["id"]): m for m in request["markings"]}
    if any(key not in current for key in bindings):
        raise Failure("invalid_input", 1)
    for key in needed | bindings.keys():
        binding = bindings.get(key)
        if (binding is None or current[key] not in PREFIXES
                or binding["category"] != current[key]
                or (binding["carrier_entity"], binding["carrier_id"], binding["carrier_field"]) not in carriers[key]):
            raise Failure("marking_required")
    positions = {("document", None): -1}
    for offset, collection in ((0, "nodes"), (1000000000, "edges")):
        order = list(dict.fromkeys(o["id"] for o in before.get(collection, []) + after.get(collection, [])))
        positions.update({(collection[:-1], identifier): offset + i for i, identifier in enumerate(order)})
    # Stable sorting retains the adjacent remove/add pair.
    delta.sort(key=lambda d: (positions[(d["entity"], d["id"])],
                              d["field"] or ""))


def review_gate(request, before, candidate, review_bytes, strings, storage):
    try:
        review = strict_json(review_bytes)
        validate(review, "Review")
    except (ValueError, ValidationError, UnicodeError, RecursionError):
        raise Failure("invalid_input", 1) from None
    if (review["before_sha256"] != (digest(before) if before is not None else None)
            or review["after_sha256"] != digest(candidate)):
        raise Failure("stale_review")
    if not all(review["diagram_checks"].values()):
        raise Failure("review_rejected")
    if request["intent"] != "proofread":
        if review["semantic_checks"] is not None:
            raise Failure("invalid_input", 1)
        return
    mechanism = gate()
    records = review["semantic_checks"]
    if not isinstance(records, list) or len(records) != len(strings):
        raise Failure("review_rejected")
    indexed = {(r["entity"], r["id"], r["field"]): r for r in records}
    if len(indexed) != len(records) or set(indexed) != {s[:3] for s in strings}:
        raise Failure("review_rejected")
    for entity, identifier, field, original, edited in strings:
        record = indexed[(entity, identifier, field)]
        initial, final = original.encode("utf-8"), edited.encode("utf-8")
        if (record["before_sha256"] != digest(initial) or record["after_sha256"] != digest(final)
                or not all(record["checks"].values())):
            raise Failure("review_rejected")
        converted = {k: record[k] for k in ("before_sha256", "after_sha256", "checks")}
        converted["reviewer"] = review["reviewer"]
        outcome = mechanism.check_bytes(initial, final, request["protected_terms"], converted)
        # Parse as a body, not as a note: text cards have no frontmatter.
        def syntax(text):
            masked, incomplete, comments = storage.masked_body(text)
            _, _, all_raw = storage.extract_links(text, masked, 0)
            lines = text.splitlines(keepends=True)
            headings = ["".join(lines[token.map[0]:token.map[1]])
                        for token in storage.MARKDOWN.parse(masked)
                        if token.type == "heading_open" and token.map]
            return dict(
                incomplete=incomplete, comments=comments, links=all_raw, headings=headings,
                callouts=re.findall(r"^[ >]*\[![^\]\n]+\][+-]?", text, re.M),
                definitions=re.findall(r"^[ ]{0,3}\[[^\]\n]+\]:[^\n]*(?:\n[ \t]+[^\n]+)*", text, re.M),
                block_ids=re.findall(r"(?<!\S)\^[A-Za-z0-9-]+(?=\s|$)", masked),
                tags=re.findall(r"(?<![\w\\])#[\w/-]+", masked))
        if outcome["status"] != "passed" or syntax(original) != syntax(edited):
            raise Failure("protected_change")


def implementation_hash(proofread):
    paths = [Path(__file__), Path(__file__).with_suffix(".py.lock"), SKILL / "SKILL.md",
             SKILL.parent / "obsidian-vault/scripts/vault.py",
             SKILL.parent / "obsidian-vault/scripts/vault.py.lock"]
    if proofread:
        gate()
        paths.append(SKILL.parent / "japanese-prose/scripts/invariants.py")
    try:
        return digest(canonical({"proofread_gate": proofread,
                                 "files": {str(p.relative_to(SKILL.parent)): digest(p.read_bytes()) for p in paths}}))
    except OSError:
        raise Failure("dependency_missing", 4) from None


def storage_check(session, parent, target, metadata):
    storage = session.storage
    try:
        storage.write_capabilities()
        storage.local_filesystem(parent)
        if os.path.realpath(f"/proc/self/fd/{parent}") != str(Path(session.vault.root) / posixpath.dirname(target)):
            raise Failure("storage_capability", 4)
        if metadata is not None:
            with os.fdopen(os.open(posixpath.basename(target), os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent), "rb") as stream:
                storage.metadata_supported(metadata, stream.fileno())
                if os.readlink(f"/proc/self/fd/{stream.fileno()}") != str(Path(session.vault.root) / target):
                    raise Failure("storage_capability", 4)
    except storage.Failure:
        raise Failure("storage_capability", 4) from None


def validate_change(session, before, candidate, review_bytes):
    request, storage = session.request, session.storage
    target = request["write_target"]
    if before is None:
        initial, old_diag = {}, None
    else:
        initial, old_diag = session.diagnose(before, target)
        if old_diag["structure"] != "supported":
            raise Failure("source_not_editable")
    final, diagnostics = session.diagnose(candidate, target)
    if diagnostics["structure"] != "supported":
        raise Failure("candidate_not_editable")
    if any(r["policy_forbidden"] for d in (old_diag, diagnostics) if d for r in d["references"]):
        raise Failure("forbidden_reference")
    if before is not None and not request["allow_formatting"]:
        raise Failure("formatting_consent_required")
    delta, strings = changed_delta(request, initial, final)
    marking_gate(request, initial, final, delta)
    if review_bytes is None:
        raise Failure("review_required")
    review_gate(request, before, candidate, review_bytes, strings, storage)
    if session.exhausted:
        raise Failure("limit_exceeded")
    return delta, diagnostics


def operation_hash(plan):
    return digest(canonical({k: v for k, v in plan.items()
                             if k not in {"operation_id", "artifacts", "stage_target", "state"}}))


ARTIFACT_NAMES = {"before": "before.canvas", "candidate": "candidate.canvas",
                  "review": "semantic-review.json", "diff": "diff.patch",
                  "delta": "delta.json", "diagnostics": "diagnostics.json"}
HASH_NAMES = {"before": "before_sha256", "candidate": "after_sha256",
              "review": "review_sha256", "diff": "diff_sha256",
              "delta": "delta_sha256", "diagnostics": "diagnostics_sha256"}


def target_read(session):
    target = safe_path(session.request["write_target"])
    if not session.vault.allowed(target):
        raise Failure("scope_refused")
    try:
        return session.read(target)
    except FileNotFoundError:
        return None, None


def plan_command(session, request_bytes, args, report):
    request, storage = session.request, session.storage
    with session.vault.parent(request["write_target"]) as (parent, _):
        before, metadata = target_read(session)
        if request["intent"] == "create":
            if before is not None:
                raise Failure("target_exists")
        elif before is None or digest(before) != request["base_sha256"]:
            raise Failure("target_changed")
        candidate = private_read(request, args["--candidate"], request["limits"]["max_file_bytes"])
        if before == candidate:
            report["data"] = dict(plan_path=None, plan_sha256=None, operation_id=None, no_changes=True)
            return
        review = private_read(request, args["--review"]) if "--review" in args else None
        delta, diagnostics = validate_change(session, before, candidate, review)
        storage_check(session, parent, request["write_target"], metadata)
        diff = storage.diff_bytes(before, candidate, request["write_target"])
        maximum = request["limits"]["max_file_bytes"]
        if maximum is not None and len(diff) > maximum:
            raise Failure("limit_exceeded")
        payloads = dict(before=before, candidate=candidate, review=review, diff=diff,
                        delta=canonical(delta), diagnostics=canonical(diagnostics))
        for key in ("review", "delta", "diagnostics"):
            if len(payloads[key]) > CONTROL_MAX:
                raise Failure("limit_exceeded")
        plan = dict(schema_version=1, kind=request["intent"], request_sha256=digest(request_bytes),
                    contract_sha256=digest(CONTRACT_BYTES),
                    implementation_sha256=implementation_hash(request["intent"] == "proofread"),
                    vault_identity=storage.identity(os.fstat(session.vault.fd)),
                    parent_identity=storage.identity(os.fstat(parent)), target=request["write_target"],
                    **{HASH_NAMES[k]: digest(v) if v is not None else None for k, v in payloads.items()})
        operation = operation_hash(plan)
        directory = Path(request["workspace"]) / operation
        plan.update(operation_id=operation, state="validated",
                    stage_target=posixpath.join(posixpath.dirname(plan["target"]), f".kotonoha-{operation}.tmp"),
                    artifacts={k: str(directory / name) if payloads[k] is not None else None
                               for k, name in ARTIFACT_NAMES.items()})
        validate(plan, "Plan")
        encoded = canonical(plan)
        if len(encoded) > CONTROL_MAX:
            raise Failure("limit_exceeded")
        path = directory / "plan.json"
        try:
            private_mkdir(request, directory)
        except FileExistsError:
            try:
                if private_read(request, path) != encoded:
                    raise Failure("workspace_conflict")
                for key, value in payloads.items():
                    if value is not None and private_read(request, plan["artifacts"][key], maximum if key in {"candidate", "before", "diff"} else CONTROL_MAX) != value:
                        raise Failure("workspace_conflict")
                for name in ("result.json", "receipt.json"):
                    try:
                        private_read(request, directory / name)
                    except FileNotFoundError:
                        continue
                    raise Failure("workspace_conflict")
                if set(os.listdir(directory)) != {"plan.json"} | {ARTIFACT_NAMES[k] for k, v in payloads.items() if v is not None}:
                    raise Failure("workspace_conflict")
                with session.vault.parent(plan["stage_target"]) as (stage_parent, stage_name):
                    try:
                        os.stat(stage_name, dir_fd=stage_parent, follow_symlinks=False)
                    except FileNotFoundError:
                        pass
                    else:
                        raise Failure("workspace_conflict")
            except (OSError, storage.Failure):
                raise Failure("workspace_conflict") from None
        else:
            for key, value in payloads.items():
                if value is not None:
                    private_write(request, plan["artifacts"][key], value)
            private_write(request, path, encoded)
        report["data"] = dict(plan_path=str(path), plan_sha256=digest(encoded),
                              operation_id=operation, no_changes=False)
        report["operation_state"] = "validated"
        if partial(diagnostics):
            report.update(status="partial", exit_code=3)


def replay_decision(result, receipt, target, *, create=False, stage=False):
    if result == "corrupt":
        return "replay_mismatch"
    if receipt == "valid":
        return "already_applied" if target == "after" else "replay_mismatch"
    if result == "saved":
        return "replay_mismatch"
    if result in {"pending", "unknown"}:
        return "prior_outcome_unknown"
    if receipt == "invalid":
        return "replay_mismatch"
    if target != "before":
        return "target_exists" if create else "target_changed"
    return "workspace_conflict" if stage else "fresh"


def bound_record(session, path, definition, expected):
    try:
        value = strict_json(private_read(session.request, path))
        validate(value, definition)
        if any(value.get(k) != v for k, v in expected.items()):
            return "invalid", None
        return "valid", value
    except FileNotFoundError:
        return "absent", None
    except (ValueError, ValidationError, OSError, Failure):
        return "invalid", None


def apply_command(session, request_bytes, args, report):
    request, storage = session.request, session.storage
    encoded = private_read(request, args["--plan"])
    if digest(encoded) != args["--approve-plan-sha256"]:
        raise Failure("approval_mismatch")
    try:
        plan = strict_json(encoded)
        validate(plan, "Plan")
    except (ValueError, ValidationError):
        raise Failure("plan_mismatch") from None
    directory = Path(request["workspace"]) / plan["operation_id"]
    expected_artifacts = {k: str(directory / name) if k != "before" or plan["before_sha256"] is not None else None
                          for k, name in ARTIFACT_NAMES.items()}
    stage_target = posixpath.join(posixpath.dirname(request["write_target"]), f".kotonoha-{plan['operation_id']}.tmp")
    if (str(directory / "plan.json") != args["--plan"] or plan["artifacts"] != expected_artifacts
            or plan["request_sha256"] != digest(request_bytes) or plan["contract_sha256"] != digest(CONTRACT_BYTES)
            or plan["implementation_sha256"] != implementation_hash(request["intent"] == "proofread")
            or plan["kind"] != request["intent"] or plan["target"] != request["write_target"]
            or plan["stage_target"] != stage_target or operation_hash(plan) != plan["operation_id"]
            or plan["before_sha256"] != request["base_sha256"]):
        raise Failure("plan_mismatch")
    payloads = {}
    for key, path in expected_artifacts.items():
        maximum = request["limits"]["max_file_bytes"] if key in {"before", "candidate", "diff"} else CONTROL_MAX
        payloads[key] = private_read(request, path, maximum) if path is not None else None
        if (digest(payloads[key]) if payloads[key] is not None else None) != plan[HASH_NAMES[key]]:
            raise Failure("plan_mismatch")
    for key, definition in (("delta", "Delta"), ("diagnostics", "Diagnostics")):
        try:
            validate(strict_json(payloads[key]), definition)
        except (ValueError, ValidationError):
            raise Failure("plan_mismatch") from None
    if storage.diff_bytes(payloads["before"], payloads["candidate"], plan["target"]) != payloads["diff"]:
        raise Failure("plan_mismatch")
    common = dict(schema_version=1, operation_id=plan["operation_id"], request_sha256=plan["request_sha256"],
                  plan_sha256=digest(encoded), target=plan["target"], after_sha256=plan["after_sha256"])
    result_status, result = bound_record(session, directory / "result.json", "OperationResult",
                                         common | {"before_sha256": plan["before_sha256"]})
    receipt_status, _ = bound_record(session, directory / "receipt.json", "Receipt", common | {"verified": True})
    with session.vault.parent(plan["target"]) as (parent, name):
        if (storage.identity(os.fstat(session.vault.fd)) != plan["vault_identity"]
                or storage.identity(os.fstat(parent)) != plan["parent_identity"]):
            raise Failure("plan_mismatch")
        current, metadata = target_read(session)
        state = ("after" if current is not None and digest(current) == plan["after_sha256"]
                 else "before" if current == payloads["before"] else "other")
        stage_name = posixpath.basename(stage_target)
        try:
            os.stat(stage_name, dir_fd=parent, follow_symlinks=False)
            stage = True
        except FileNotFoundError:
            stage = False
        decision = replay_decision("corrupt" if result_status == "invalid" else result["phase"] if result else "absent",
                                   receipt_status, state, create=request["intent"] == "create", stage=stage)
        if decision not in {"fresh", "already_applied"}:
            raise Failure(decision)
        if payloads["before"] is not None:
            session.reserve(plan["target"], payloads["before"])
        session.reserve(plan["target"], payloads["candidate"])
        delta, diagnostics = validate_change(session, payloads["before"], payloads["candidate"], payloads["review"])
        if canonical(delta) != payloads["delta"]:
            raise Failure("plan_mismatch")
        data = dict(target=plan["target"], operation_id=plan["operation_id"], after_sha256=plan["after_sha256"],
                    changed=decision == "fresh", verified=True, diagnostics=diagnostics,
                    approved_diagnostics_sha256=plan["diagnostics_sha256"])
        if decision == "fresh":
            storage_check(session, parent, plan["target"], metadata)
            pending = common | dict(before_sha256=plan["before_sha256"], phase="pending", verified=False)
            private_write(request, directory / "result.json", canonical(pending))
            progress = {"committed": False, "own_stage": False, "cleanup_failed": False}

            def read_at(descriptor, filename):
                fd = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=descriptor)
                with os.fdopen(fd, "rb") as stream:
                    info = os.fstat(stream.fileno())
                    if not stat.S_ISREG(info.st_mode):
                        raise Failure("scope_refused")
                    maximum = request["limits"]["max_file_bytes"]
                    if maximum is not None and info.st_size > maximum:
                        raise Failure("limit_exceeded")
                    value = stream.read() if maximum is None else stream.read(maximum + 1)
                    if maximum is not None and len(value) > maximum:
                        raise Failure("limit_exceeded")
                    session.reserve(plan["target"], value)
                    return value, info

            try:
                storage.commit_bytes(session.vault, parent, name, stage_name, payloads["before"],
                                     payloads["candidate"], metadata, plan["vault_identity"], progress,
                                     read_at=read_at, target=plan["target"])
                private_write(request, directory / "receipt.json", canonical(common | {"verified": True}))
                private_write(request, directory / "result.json",
                              canonical(pending | {"phase": "saved", "verified": True}), replace=True)
            except Exception as error:
                if progress["committed"]:
                    report["data"] = data | {"after_sha256": None, "changed": None, "verified": False}
                    report["write_status"] = "unknown"
                    raise Failure("runtime_error", 1,
                                  path=stage_target if progress["cleanup_failed"] else None) from error
                if progress["cleanup_failed"]:
                    # Keep the pending record and the exact known stage path.
                    # Neither retry nor cleanup may guess ownership after failure.
                    raise Failure("runtime_error", 1, path=stage_target) from error
                if isinstance(error, Failure):
                    raise
                if isinstance(error, storage.Failure):
                    if error.code == "target_exists":
                        try:
                            os.stat(stage_name, dir_fd=parent, follow_symlinks=False)
                        except FileNotFoundError:
                            raise Failure("target_exists") from None
                        raise Failure("workspace_conflict", path=stage_target) from None
                    if error.code == "target_changed":
                        raise Failure("target_changed") from None
                    if error.code == "parent_changed":
                        raise Failure("plan_mismatch") from None
                    if error.exit_code == 4:
                        raise Failure("storage_capability", 4) from None
                raise Failure("runtime_error", 1) from error
        report.update(data=data, write_status="saved", operation_state="saved")
        report["processed"] = [plan["target"]]
        if partial(diagnostics):
            report.update(status="partial", exit_code=3)


def layout_document(document, layout):
    final = copy.deepcopy(document)
    nodes = {n["id"]: n for n in final.get("nodes", [])}
    selected = []
    for identifier in layout["node_ids"]:
        node = nodes.get(identifier)
        if node is None or node["type"] == "group" or min(node["width"], node["height"]) <= 0:
            raise Failure("layout_refused")
        selected.append(node)
    groups = [n for n in nodes.values() if n["type"] == "group"]
    if any(intersects(n, g) for n in selected for g in groups):
        raise Failure("layout_refused")
    width, height = max(n["width"] for n in selected), max(n["height"] for n in selected)
    for index, node in enumerate(selected):
        mode, columns = layout["mode"], layout["columns"]
        column = index if mode == "horizontal" else 0 if mode == "vertical" else index % columns
        row = index if mode == "vertical" else 0 if mode == "horizontal" else index // columns
        node["x"] = layout["origin_x"] + column * (width + layout["gap"])
        node["y"] = layout["origin_y"] + row * (height + layout["gap"])
        if any(abs(node[k]) > SAFE for k in ("x", "y")) or any(intersects(node, g) for g in groups):
            raise Failure("layout_refused")
    return final


def layout_command(session, request_bytes, args, report):
    request = session.request
    candidate = private_read(request, args["--candidate"], request["limits"]["max_file_bytes"])
    document, diagnostics = parse_document(candidate, request["write_target"])
    if diagnostics["structure"] != "supported":
        raise Failure("candidate_not_editable")
    final = layout_document(document, request["layout"])
    encoded = (json.dumps(final, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    maximum = request["limits"]["max_file_bytes"]
    if maximum is not None and len(encoded) > maximum:
        raise Failure("limit_exceeded")
    directory = Path(request["workspace"]) / ("layout-" + digest(request_bytes + candidate))
    try:
        private_mkdir(request, directory)
        path = directory / "candidate.canvas"
        private_write(request, path, encoded)
    except FileExistsError:
        raise Failure("workspace_conflict") from None
    _, diagnostics = parse_document(encoded, request["write_target"])
    report.update(operation_state="proposed", data=dict(
        candidate_path=str(path), candidate_sha256=digest(encoded), changed=encoded != candidate,
        issues=diagnostics["issues"], reference_check="not_performed", render_check="not_performed"))


def inspect_command(session, args, report):
    command = report["command"]
    if "--path" in args:
        path = safe_path(args["--path"])
        if not path.endswith((".canvas", ".md") if command == "read" else (".canvas",)):
            raise Failure("scope_refused")
        if not session.vault.allowed(path):
            raise Failure("scope_refused")
        paths = [path]
    else:
        paths, skipped, _, complete = session.vault.enumerate_authorized((".canvas",))
        report["unprocessed"] = sorted(skipped)
        if not complete:
            report.update(status="partial", exit_code=3)
    documents = []
    for path in paths:
        try:
            data, _ = session.read(path)
        except Failure as error:
            if error.code == "scope_refused":
                raise
            if command == "read":
                raise
            report["issues"].append(issue(error.code, path, category="runtime"))
            report["unprocessed"].append(path)
            report.update(status="partial", exit_code=3)
            continue
        except (OSError, session.storage.Failure):
            if command == "read":
                raise Failure("read_failed", 1) from None
            report["issues"].append(issue("read_failed", path, category="runtime"))
            report["unprocessed"].append(path)
            report.update(status="partial", exit_code=3)
            continue
        diagnostics = session.diagnose(data, path)[1] if path.endswith(".canvas") else None
        if diagnostics and partial(diagnostics):
            report.update(status="partial", exit_code=3)
        report["processed"].append(path)
        if command == "read":
            try:
                content = data.decode("utf-8")
                content.encode("utf-8")
            except UnicodeError:
                content = None
                report.update(status="partial", exit_code=3)
            report["data"] = dict(path=path, sha256=digest(data), bytes=len(data),
                                  content=content, diagnostics=diagnostics)
        else:
            documents.append(dict(path=path, sha256=digest(data), bytes=len(data), diagnostics=diagnostics))
    if command == "inspect":
        report["data"] = {"documents": documents}
    if session.exhausted:
        report.update(status="partial", exit_code=3)
        if not any(i["code"] == "limit_exceeded" for i in report["issues"]):
            report["issues"].append(issue("limit_exceeded", category="runtime"))


def arguments(argv):
    if not argv or argv[0] not in CONTRACT["x-commands"]:
        raise Failure("invalid_input", 1)
    command = argv[0]
    metadata = CONTRACT["x-commands"][command]
    allowed = metadata["required"] + metadata["optional"]
    result = {}
    for index in range(1, len(argv), 2):
        if (index + 1 >= len(argv) or argv[index] not in allowed or argv[index] in result
                or argv[index + 1].startswith("--")):
            raise Failure("invalid_input", 1)
        result[argv[index]] = argv[index + 1]
    if not all(flag in result for flag in metadata["required"]):
        raise Failure("invalid_input", 1)
    return command, result


def request_read(path):
    # Requests are control inputs, not Vault payloads; all parents still refuse symlinks.
    path = os.path.abspath(path)
    descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        parts = Path(path).parts[1:]
        for part in parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=descriptor)
        with os.fdopen(fd, "rb") as stream:
            metadata = os.fstat(stream.fileno())
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > CONTROL_MAX:
                raise Failure("invalid_input", 1)
            data = stream.read(CONTROL_MAX + 1)
            if len(data) > CONTROL_MAX:
                raise Failure("invalid_input", 1)
            return data
    finally:
        os.close(descriptor)


def run(argv):
    command = argv[0] if argv and argv[0] in CONTRACT["x-commands"] else "inspect"
    report = dict(schema_version=1, command=command, status="completed", exit_code=0,
                  write_status="unsaved" if command in {"plan", "apply"} else "not_requested",
                  operation_state="scoped", request_sha256=None, processed=[], unprocessed=[], issues=[], data=None)
    session = None
    try:
        command, args = arguments(argv)
        try:
            data = request_read(args["--request"])
        except OSError:
            raise Failure("invalid_input", 1) from None
        report["request_sha256"] = digest(data)
        try:
            request = request_json(data)
            context(request, command)
        except (ValueError, ValidationError, UnicodeError, RecursionError):
            raise Failure("invalid_input", 1) from None
        storage = backend()
        if request["intent"] == "proofread":
            gate()
        session = Session(request, storage)
        if command in {"plan", "apply"}:
            fcntl.flock(session.vault.fd, fcntl.LOCK_EX)
            (plan_command if command == "plan" else apply_command)(session, data, args, report)
        elif command == "layout":
            layout_command(session, data, args, report)
        else:
            inspect_command(session, args, report)
    except Failure as error:
        report.update(status="failed" if error.exit_code == 1 else "not_performed",
                      exit_code=error.exit_code, operation_state="blocked")
        report["issues"].append(issue(error.code, error.path))
    except Exception as error:
        if session and isinstance(error, session.storage.Failure):
            code = "storage_capability" if error.exit_code == 4 else "scope_refused"
            exit_code = 4 if error.exit_code == 4 else 2
        else:
            code, exit_code = "runtime_error", 1
        report.update(status="failed" if exit_code == 1 else "not_performed",
                      exit_code=exit_code, operation_state="blocked")
        report["issues"].append(issue(code))
    finally:
        if session:
            session.vault.close()
    report["processed"] = sorted(set(report["processed"]))
    report["unprocessed"] = sorted(set(report["unprocessed"]))
    validate(report, "Report")
    return report


def main():
    report = run(sys.argv[1:])
    print(canonical(report).decode("utf-8"))
    return report["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
