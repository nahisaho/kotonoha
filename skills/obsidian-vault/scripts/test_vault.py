# /// script
# requires-python = "==3.12.*"
# dependencies = ["markdown-it-py>=3,<5", "PyYAML>=6,<7", "jsonschema>=4,<5"]
# ///
"""Independent acceptance fixtures and focused transaction regressions."""

import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import vault


ROOT = Path(__file__).resolve().parents[3]
CASES = json.loads((ROOT / "docs/obsidian/acceptance-cases.json").read_text())


class VaultTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="kotonoha-obsidian-")
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name)
        self.root = self.home / "vault"
        self.root.mkdir()
        self.workspace = self.home / "workspace"
        self.workspace.mkdir(mode=0o700)
        for note in CASES["fixture"]["notes"]:
            self.write(note["path"], note["content"])
        padding = CASES["fixture"]["padding"]
        for index in range(padding["first_index"], padding["first_index"] + padding["count"]):
            self.write(padding["path_format"].format(index=index),
                       padding["content_format"].format(index=index))
        self.request = copy.deepcopy(CASES["scenario_defaults"]["request"])
        self.request.update(vault_root=str(self.root), workspace=str(self.workspace))
        self.request_path = self.workspace / "request.json"

    def write(self, path, content):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content.encode() if isinstance(content, str) else content)

    def invoke(self, command, *args):
        self.request_path.write_text(json.dumps(self.request, ensure_ascii=False))
        report = vault.run([command, "--request", str(self.request_path), *map(str, args)])
        vault.validate(report, "Report")
        return report

    def snapshot(self):
        return {str(path.relative_to(self.root)): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file() and not path.is_symlink()}

    def edit_plan(self, *, review=True):
        self.request.update(intent="proofread", write_target="Notes/draft.md")
        before = (self.root / "Notes/draft.md").read_bytes()
        after = before.replace("ではでは".encode(), "では".encode())
        self.request["base_sha256"] = vault.digest(before)
        self.candidate = self.workspace / "input.md"
        self.candidate.write_bytes(after)
        arguments = ["--candidate", self.candidate]
        if review:
            self.review_path = self.workspace / "review.json"
            self.review_path.write_text(json.dumps({
                "before_sha256": vault.digest(before), "after_sha256": vault.digest(after),
                "reviewer": "Fixture reviewer, not a real semantic acceptance review",
                "checks": {name: True for name in vault.CHECKS},
            }))
            arguments += ["--review", self.review_path]
        return self.invoke("plan", *arguments)

    def apply_plan(self, report):
        data = report["data"]
        return self.invoke("apply", "--plan", data["plan_path"],
                           "--approve-plan-sha256", data["plan_sha256"])

    def test_exact_full_fixture_and_repeatability(self):
        initial = self.snapshot()
        first = self.invoke("inspect")
        self.assertEqual(first["status"], "partial")
        self.assertEqual(first["exit_code"], 3)
        self.assertEqual(len(first["coverage"]["processed"]), 100)
        self.assertEqual(first["coverage"]["unprocessed"], [])
        self.assertEqual(first["data"]["links"], CASES["expected_links"])
        self.assertEqual(first["data"]["observations"], CASES["expected_observations"])
        self.assertEqual(first["data"]["external_url_count"], 1)
        self.assertEqual(self.invoke("inspect"), first)
        self.assertEqual(self.snapshot(), initial)

    def test_partial_domains_and_visible_duplicates(self):
        self.request["read_scopes"] = [
            {"kind": "directory", "path": name} for name in ("Notes", "Targets")
        ]
        report = self.invoke("inspect")
        links = {link["raw"]: link for link in report["data"]["links"]
                 if link["source_path"] == "Notes/source.md"}
        for expected in CASES["partial_scope"]["overrides"]:
            self.assertEqual(links[expected["raw"]]["classification"], expected["classification"])
            self.assertEqual(links[expected["raw"]]["reason"], expected["reason"])
        self.request["read_scopes"] = [
            {"kind": "directory", "path": name} for name in ("Notes", "DupA", "DupB")
        ]
        report = self.invoke("inspect")
        same = next(link for link in report["data"]["links"] if link["raw"] == "[[Same]]")
        self.assertEqual(same["classification"], "ambiguous")
        self.assertEqual(same["candidates"], ["DupA/Same.md", "DupB/Same.md"])

    def test_masked_examples(self):
        self.request["read_scopes"] = [{"kind": "file", "path": "Notes/masks.md"}]
        report = self.invoke("inspect")
        self.assertEqual((report["status"], report["exit_code"]), ("completed", 0))
        self.assertEqual(report["data"]["links"], [])

    def test_inline_code_cannot_consume_other_blocks(self):
        for text in (
            "# T\n\nUse `a stray tick.\n\nSee [[Missing]] here.\n\nAnother ` tick.\n",
            "# T\n\nStray ` tick.\n\n```md\ncode\n```\n\n[[Missing]]\n\nAnother ` tick.\n",
            "# T\n\nStray ` tick.\n\n## Heading\n\n[[Missing]]\n\nAnother ` tick.\n",
        ):
            with self.subTest(text=text):
                note = vault.parse_note("note.md", text.encode())
                self.assertFalse(note["fatal"])
                self.assertEqual([link["raw"] for link in note["links"]], ["[[Missing]]"])
        valid = vault.parse_note("note.md", b"# T\n\n`inline\n[[CodeExample]]`\n\n[[Visible]]\n")
        self.assertEqual([link["raw"] for link in valid["links"]], ["[[Visible]]"])
        self.write("Targets/Unique.md", "# Unique\n\nStray ` tick.\n\n## 詳細\n\nAnother ` tick.\n")
        report = self.invoke("inspect")
        link = next(link for link in report["data"]["links"] if link["raw"] == "[[Targets/Unique#詳細]]")
        self.assertEqual(link["reason"], "heading_found")

    def test_inline_masks_cannot_invent_indented_code_blocks(self):
        for text in (
            "`x` [[Z]]\n",
            "# T\n\n`code` and [[Z]]\n",
            "`a\nb [[Y]] c` [[Z]]\n",
            "%% comment %% [[Z]]\n",
            "%% comment\ncontinued %% [[Z]]\n",
        ):
            with self.subTest(text=text):
                note = vault.parse_note("note.md", text.encode())
                self.assertFalse(note["fatal"])
                self.assertEqual([link["raw"] for link in note["links"]], ["[[Z]]"])
        note = vault.parse_note("note.md", b"- item `a\n- `b` [[L]]\n")
        self.assertEqual([link["raw"] for link in note["links"]], ["[[L]]"])

    def test_concrete_parse_and_precedence_arrangements(self):
        for name in ("unclosed_frontmatter", "duplicate_yaml_key_rejected",
                     "nested_yaml_rejected", "syntax_before_scope",
                     "encoding_before_scope", "unmatched_inline_backtick"):
            with self.subTest(name=name):
                arrangement = CASES["arrangements"][name]
                path = arrangement["replace_note"]["path"]
                original = (self.root / path).read_bytes()
                self.write(path, arrangement["replace_note"]["content"])
                report = self.invoke("inspect")
                self.write(path, original)
                expected = arrangement["expected"]
                for key in ("status", "exit_code"):
                    if key in expected:
                        self.assertEqual(report[key], expected[key])
                if "parses_complete" in expected:
                    self.assertEqual(report["coverage"]["parses_complete"], expected["parses_complete"])
                if "issue_codes_contains" in expected:
                    self.assertTrue(set(expected["issue_codes_contains"]) <= {item["code"] for item in report["issues"]})
                link_expected = arrangement.get("expected_link")
                if link_expected:
                    actual = next(link for link in report["data"]["links"]
                                  if link["raw"] == link_expected["raw"])
                    for key, value in link_expected.items():
                        self.assertEqual(actual[key], value)
                if name == "unclosed_frontmatter":
                    for raw in ("[[Unique]]", "[[Targets/Unique]]", "[[Targets/Unique#詳細]]"):
                        actual = next(link for link in report["data"]["links"] if link["raw"] == raw)
                        self.assertEqual(actual["reason"], "target_parse_incomplete")

    def test_fatal_source_does_not_fabricate_links(self):
        self.write("Notes/source.md", "# Source\n\n%% [[UnclosedComment]]\n")
        report = self.invoke("inspect")
        self.assertFalse(report["coverage"]["parses_complete"])
        self.assertFalse(any(link["source_path"] == "Notes/source.md"
                             for link in report["data"]["links"]))

    def test_read_failure_and_symlink_invalidate_negative_evidence(self):
        original = vault.Vault.read

        def fail(instance, path, maximum=None):
            if path == "Targets/Unique.md":
                raise PermissionError()
            return original(instance, path, maximum)

        with patch.object(vault.Vault, "read", fail):
            report = self.invoke("inspect")
        self.assertFalse(report["coverage"]["reads_complete"])
        for raw in ("[[Unique]]", "[[Targets/Unique]]"):
            link = next(link for link in report["data"]["links"] if link["raw"] == raw)
            self.assertEqual(link["reason"], "scope_incomplete")
        outside = self.home / "secret.md"
        outside.write_text("Secret must not be read")
        (self.root / "Ghost.md").symlink_to(outside)
        report = self.invoke("inspect")
        ghost = next(link for link in report["data"]["links"] if link["raw"] == "[[Ghost]]")
        self.assertEqual(ghost["reason"], "scope_incomplete")
        denied = self.invoke("read", "--path", "Ghost.md")
        self.assertEqual(denied["exit_code"], 2)

    def test_limits_and_consent(self):
        self.request["read_scopes"] = [{"kind": "directory", "path": "Padding"}]
        self.request["limits"]["max_files"] = 2
        report = self.invoke("inspect")
        self.assertEqual(report["coverage"]["processed"], ["Padding/note-001.md", "Padding/note-002.md"])
        self.assertEqual(len(report["coverage"]["unprocessed"]), 78)
        self.assertEqual(report["exit_code"], 3)
        self.request["consent"]["model_context"] = False
        with patch.object(vault.Vault, "read", side_effect=AssertionError("Unauthorized read")):
            self.assertEqual(self.invoke("inspect")["exit_code"], 2)

    def test_unsupported_metadata_and_non_utf8_are_explicit(self):
        (self.root / "Notes/alias.md").hardlink_to(self.root / "Notes/draft.md")
        blocked = self.edit_plan()
        self.assertEqual(blocked["exit_code"], 4)
        self.assertEqual(blocked["issues"][0]["code"], "capability_missing")
        self.write("Notes/invalid.md", b"\xff")
        self.assertEqual(self.invoke("read", "--path", "Notes/invalid.md")["issues"][0]["code"],
                         "unsupported_format")
        self.assertEqual(self.invoke("read", "--path", "Notes/missing.md")["issues"][0]["code"],
                         "read_failed")

    def test_completed_note_variables_and_unauthorized_writes(self):
        self.request.update(intent="create", write_target="Notes/new.md", deliverable="note")
        candidate = self.workspace / "template.md"
        candidate.write_text("# {{title}}\n")
        self.assertEqual(self.invoke("plan", "--candidate", candidate)["issues"][0]["code"],
                         "gate_blocked")
        self.request["deliverable"] = "template"
        self.assertEqual(self.invoke("plan", "--candidate", candidate)["exit_code"], 0)
        for target in ("../outside.md", ".obsidian/private.md", "Notes/plain.txt"):
            self.request["write_target"] = target
            before = self.snapshot()
            self.assertEqual(self.invoke("plan", "--candidate", candidate)["exit_code"], 2)
            self.assertEqual(self.snapshot(), before)

    def test_approved_edit_replay_and_external_change(self):
        initial = self.snapshot()
        planned = self.edit_plan()
        self.assertEqual(planned["status"], "completed")
        self.assertEqual(self.snapshot(), initial)
        saved = self.apply_plan(planned)
        self.assertEqual((saved["status"], saved["write_status"]), ("completed", "saved"))
        self.assertTrue(saved["data"]["changed"])
        current = self.snapshot()
        self.assertEqual([name for name in current if current[name] != initial[name]], ["Notes/draft.md"])
        replayed = self.apply_plan(planned)
        self.assertFalse(replayed["data"]["changed"])
        self.assertEqual(replayed["issues"][0]["code"], "already_applied")
        self.write("Notes/draft.md", initial["Notes/draft.md"])
        blocked = self.apply_plan(planned)
        self.assertEqual(blocked["exit_code"], 2)
        self.assertEqual(blocked["issues"][0]["code"], "target_changed")
        self.assertEqual((self.root / "Notes/draft.md").read_bytes(), initial["Notes/draft.md"])

    def test_noop_and_missing_semantic_review(self):
        result = self.edit_plan(review=False)
        self.assertEqual(result["exit_code"], 2)
        self.assertEqual(result["issues"][0]["code"], "semantic_review_required")
        self.candidate.write_bytes((self.root / "Notes/draft.md").read_bytes())
        result = self.invoke("plan", "--candidate", self.candidate)
        self.assertEqual(result["exit_code"], 0)
        self.assertTrue(result["data"]["no_changes"])
        self.assertIsNone(result["data"]["plan_path"])
        (self.root / "Notes/linked.md").hardlink_to(self.root / "Notes/draft.md")
        with patch.object(vault, "write_capabilities", side_effect=AssertionError("No write needed")):
            self.assertTrue(self.invoke("plan", "--candidate", self.candidate)["data"]["no_changes"])

    def test_plan_respects_explicit_byte_limit(self):
        self.edit_plan()
        self.request["limits"]["max_file_bytes"] = 1
        result = self.invoke("plan", "--candidate", self.candidate, "--review", self.review_path)
        self.assertEqual(result["exit_code"], 2)
        self.assertEqual(result["issues"][0]["code"], "limit_reached")

    def test_stale_original_approval_and_stage_conflict(self):
        planned = self.edit_plan()
        original = (self.root / "Notes/draft.md").read_bytes()
        self.write("Notes/draft.md", original + b"external")
        self.assertEqual(self.apply_plan(planned)["issues"][0]["code"], "target_changed")
        self.write("Notes/draft.md", original)
        bad = self.invoke("apply", "--plan", planned["data"]["plan_path"],
                          "--approve-plan-sha256", "0" * 64)
        self.assertEqual(bad["issues"][0]["code"], "plan_not_approved")
        plan = json.loads(Path(planned["data"]["plan_path"]).read_bytes())
        self.write(plan["stage_target"], "Keep existing stage")
        blocked = self.apply_plan(planned)
        self.assertEqual(blocked["issues"][0]["code"], "target_exists")
        self.assertEqual((self.root / plan["stage_target"]).read_text(), "Keep existing stage")

    def test_parent_identity_change(self):
        planned = self.edit_plan()
        (self.root / "Notes").rename(self.root / "OldNotes")
        (self.root / "Notes").mkdir()
        self.write("Notes/draft.md", (self.root / "OldNotes/draft.md").read_bytes())
        result = self.apply_plan(planned)
        self.assertEqual(result["issues"][0]["code"], "parent_changed")

    def test_protected_mutations_block_even_with_attestation(self):
        fixture = CASES["protected_edit_fixture"]
        before = fixture["content"].encode()
        for mutation in fixture["mutations"]:
            with self.subTest(case=mutation["case"]):
                after = before.replace(*(value.encode() for value in mutation["replace"]))
                review = {
                    "before_sha256": vault.digest(before), "after_sha256": vault.digest(after),
                    "reviewer": "Artificial fixture; not a semantic guarantee",
                    "checks": {key: True for key in vault.CHECKS},
                }
                with self.assertRaises(vault.Failure) as blocked:
                    vault.edit_gate(before, after, [], review)
                self.assertEqual(blocked.exception.code, "gate_blocked")

    def test_create_and_conflict_without_replacement(self):
        self.request.update(intent="create", write_target="Notes/new.md", deliverable="note")
        candidate = self.workspace / "new.md"
        candidate.write_text("# 作成ノート\n\n2026-10-19\n")
        planned = self.invoke("plan", "--candidate", candidate)
        self.assertEqual(planned["exit_code"], 0)
        saved = self.apply_plan(planned)
        self.assertEqual(saved["exit_code"], 0)
        self.assertEqual((self.root / "Notes/new.md").read_bytes(), candidate.read_bytes())
        mask = os.umask(0)
        os.umask(mask)
        self.assertEqual((self.root / "Notes/new.md").stat().st_mode & 0o777, 0o666 & ~mask)
        self.assertEqual(self.invoke("plan", "--candidate", candidate)["issues"][0]["code"], "target_exists")

    def test_precommit_and_postcommit_failure(self):
        planned = self.edit_plan()
        original = (self.root / "Notes/draft.md").read_bytes()
        replace = os.replace

        def fail_commit(source, target, **kwargs):
            if "src_dir_fd" in kwargs:
                raise OSError("Injected precommit failure")
            return replace(source, target, **kwargs)

        with patch.object(vault.os, "replace", fail_commit):
            result = self.apply_plan(planned)
        self.assertEqual((result["status"], result["write_status"]), ("failed", "unsaved"))
        self.assertEqual((self.root / "Notes/draft.md").read_bytes(), original)
        self.assertFalse(list((self.root / "Notes").glob(".kotonoha-*")))
        actual = vault.replace_private

        def fail_receipt(path, data):
            if path.name == "receipt.json":
                raise OSError("Injected postcommit failure")
            return actual(path, data)

        with patch.object(vault, "replace_private", fail_receipt):
            result = self.apply_plan(planned)
        self.assertEqual((result["status"], result["write_status"]), ("failed", "unknown"))
        self.assertNotEqual((self.root / "Notes/draft.md").read_bytes(), original)
        self.assertEqual(self.apply_plan(planned)["issues"][0]["code"], "commit_outcome_uncertain")

    def test_cli_shapes_and_control_failures(self):
        self.request_path.write_text(json.dumps(self.request))
        result = subprocess.run(
            [sys.executable, str(Path(vault.__file__)), "read", "--request",
             str(self.request_path), "--path", "Notes/draft.md"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["data"]["path"], "Notes/draft.md")
        self.assertEqual(vault.run(["apply"])["exit_code"], 1)
        self.request_path.write_text('{"schema_version":1,"schema_version":1}')
        self.assertEqual(vault.run(["inspect", "--request", str(self.request_path)])["exit_code"], 1)
        self.assertEqual(self.invoke("read", "--path", "../escape.md")["exit_code"], 2)
        self.assertEqual(self.invoke("read", "--path", ".obsidian/private.md")["exit_code"], 2)

    def test_decorated_heading_never_becomes_plain_after_masking(self):
        for heading in ("`code`", "Text %% comment %%", "==marked==", r"escaped\_text", "&amp;"):
            with self.subTest(heading=heading):
                self.write("Targets/Unique.md", "# Unique\n\n## " + heading + "\n")
                report = self.invoke("inspect")
                missing = next(link for link in report["data"]["links"]
                               if link["raw"] == "[[Targets/Unique#Missing]]")
                self.assertEqual(missing["reason"], "unsupported_heading")
                self.assertNotEqual(missing["classification"], "unresolved")

    def test_nested_markdown_labels_are_protected(self):
        before = b"# Test\n\n[a [b] c](https://example.com/path)\n"
        after = before.replace(b"[b]", b"[d]")
        review = {"before_sha256": vault.digest(before), "after_sha256": vault.digest(after),
                  "reviewer": "Artificial fixture", "checks": {key: True for key in vault.CHECKS}}
        with self.assertRaises(vault.Failure) as blocked:
            vault.edit_gate(before, after, [], review)
        self.assertEqual(blocked.exception.code, "gate_blocked")

    def test_escaped_link_examples_and_no_final_newline_diff(self):
        self.write("Notes/source.md", "# Source\n\n\\[[Example]]\n\\[x](missing.md)\n[[Targets/Unique]]\n")
        report = self.invoke("inspect")
        links = [link for link in report["data"]["links"] if link["source_path"] == "Notes/source.md"]
        self.assertEqual([link["raw"] for link in links], ["[[Targets/Unique]]"])
        diff = vault.diff_bytes(b"before", b"after", "note.md").decode()
        self.assertIn("-before\n\\ No newline at end of file\n", diff)
        self.assertIn("+after\n\\ No newline at end of file\n", diff)

    def test_create_race_does_not_replace_external_file(self):
        self.request.update(intent="create", write_target="Notes/new.md", deliverable="note")
        candidate = self.workspace / "new.md"
        candidate.write_text("# New\n")
        planned = self.invoke("plan", "--candidate", candidate)
        create = vault.exclusive_create

        def race(parent, stage_name, name):
            self.write("Notes/new.md", b"External winner\n")
            return create(parent, stage_name, name)

        with patch.object(vault, "exclusive_create", race):
            blocked = self.apply_plan(planned)
        self.assertEqual((blocked["status"], blocked["exit_code"]), ("not_performed", 2))
        self.assertEqual((self.root / "Notes/new.md").read_bytes(), b"External winner\n")
        self.assertFalse(list((self.root / "Notes").glob(".kotonoha-*")))

    def test_stale_base_and_hash_bound_review(self):
        self.edit_plan()
        original = (self.root / "Notes/draft.md").read_bytes()
        self.write("Notes/draft.md", original + b"External change\n")
        result = self.invoke("plan", "--candidate", self.candidate, "--review", self.review_path)
        self.assertEqual(result["issues"][0]["code"], "target_changed")
        self.write("Notes/draft.md", original)
        review = json.loads(self.review_path.read_bytes())
        for alteration in ({"after_sha256": "0" * 64},
                           {"checks": {**review["checks"], "actors": False}},
                           {"checks": {**review["checks"], "actors": "true"}}):
            with self.subTest(alteration=alteration):
                self.review_path.write_text(json.dumps(review | alteration))
                result = self.invoke("plan", "--candidate", self.candidate, "--review", self.review_path)
                self.assertEqual(result["issues"][0]["code"], "semantic_review_required")

    def test_receipt_missing_or_invalid_does_not_trigger_second_write(self):
        planned = self.edit_plan()
        self.assertEqual(self.apply_plan(planned)["exit_code"], 0)
        operation = Path(planned["data"]["plan_path"]).parent
        receipt = operation / "receipt.json"
        receipt.unlink()
        result = self.apply_plan(planned)
        self.assertEqual(result["issues"][0]["code"], "commit_outcome_uncertain")
        receipt.write_text('{"verified": false}')
        self.assertEqual(self.apply_plan(planned)["issues"][0]["code"], "commit_outcome_uncertain")

    def test_concurrent_actual_cli_serializes_same_operation(self):
        planned = self.edit_plan()
        arguments = [sys.executable, vault.__file__, "apply", "--request", str(self.request_path),
                     "--plan", planned["data"]["plan_path"],
                     "--approve-plan-sha256", planned["data"]["plan_sha256"]]
        children = [subprocess.Popen(arguments, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     text=True) for _ in range(2)]
        results = []
        for child in children:
            stdout, stderr = child.communicate(timeout=30)
            self.assertEqual(child.returncode, 0, stderr)
            results.append(json.loads(stdout))
        self.assertEqual(sorted(result["data"]["changed"] for result in results), [False, True])
        self.assertTrue(all(result["data"]["verified"] for result in results))

    def test_installed_offline_launcher_and_single_skill_dependency_failure(self):
        installed = self.home / "installed skills"
        subprocess.run(["node", str(ROOT / "bin/kotonoha.js"), "install", "--target", str(installed)],
                       check=True, capture_output=True)
        executable = installed / "obsidian-vault/scripts/vault.py"
        self.request_path.write_text(json.dumps(self.request))
        command = ["uv", "run", "--offline", "--locked", "--python", "3.12", str(executable)]
        result = subprocess.run(command + ["inspect", "--request", str(self.request_path)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 3, result.stderr)
        self.assertEqual(json.loads(result.stdout)["data"]["links"], CASES["expected_links"])
        single = self.home / "single"
        subprocess.run(["node", str(ROOT / "bin/kotonoha.js"), "install", "--skill", "obsidian-vault",
                        "--target", str(single)], check=True, capture_output=True)
        self.edit_plan()
        result = subprocess.run(
            ["uv", "run", "--offline", "--locked", "--python", "3.12",
             str(single / "obsidian-vault/scripts/vault.py"), "plan", "--request",
             str(self.request_path), "--candidate", str(self.candidate),
             "--review", str(self.review_path)], capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 4, result.stderr)
        self.assertEqual(json.loads(result.stdout)["issues"][0]["code"], "dependency_missing")


if __name__ == "__main__":
    unittest.main()
