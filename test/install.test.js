const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { publishTagForVersion } = require("../bin/npm-publish-tag.js");

const repositoryRoot = path.resolve(__dirname, "..");
const cli = path.join(repositoryRoot, "bin", "kotonoha.js");

test("bundled Skill descriptions fit the host discovery limit", () => {
  const skillsRoot = path.join(repositoryRoot, "skills");
  for (const directory of fs.readdirSync(skillsRoot)) {
    const file = path.join(skillsRoot, directory, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    const block = content.match(/^description: >-\r?\n((?:  .*\r?\n)+)/m);
    assert.ok(block, `${directory} should have a folded description`);
    const description = block[1].trim().split(/\r?\n/).map((line) => line.trim()).join(" ");
    assert.ok(
      description.length > 0 && description.length <= 1024,
      `${directory} description has ${description.length} characters; host discovery accepts 1-1024`,
    );
  }
});

test("tech-writer workflow section references stay aligned", () => {
  const skill = fs.readFileSync(
    path.join(repositoryRoot, "skills", "tech-writer", "SKILL.md"),
    "utf8",
  );

  assert.match(skill, /## 5\. Optimize Japanese prose/);
  assert.match(skill, /## 6\. Rubber-duck review loop/);
  assert.match(skill, /## 7\. Doctype checklist summary/);
  assert.match(skill, /§1–§6 workflow/);
  assert.match(skill, /review status required by §6/);
  assert.match(skill, /doctype checklist \(§7\)/);
});

test("consulting-analyst defines framework safeguards and handoff artifacts", () => {
  const skillRoot = path.join(
    repositoryRoot,
    "skills",
    "consulting-analyst",
  );
  const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");

  assert.match(skill, /Use no more than three primary\s+frameworks/);
  assert.match(skill, /Never upgrade an assumption to a finding/);
  assert.match(skill, /Supported` cites at least one `Fact` or `Estimate`/);
  assert.match(skill, /decision-analysis\.md` only when/);
  assert.match(skill, /analysis incomplete/);
  for (const template of [
    "analysis-brief.md",
    "issue-tree.md",
    "hypothesis-evidence-ledger.md",
    "decision-analysis.md",
    "synthesis-handoff.md",
  ]) {
    assert.ok(
      fs.existsSync(path.join(skillRoot, "assets", "templates", template)),
      `missing consulting template ${template}`,
    );
  }
  for (const reference of [
    "framework-selection.md",
    "evidence-and-hypotheses.md",
    "handoff-contract.md",
  ]) {
    assert.ok(
      fs.existsSync(path.join(skillRoot, "references", reference)),
      `missing consulting reference ${reference}`,
    );
  }
  const brief = fs.readFileSync(
    path.join(skillRoot, "assets", "templates", "analysis-brief.md"),
    "utf8",
  );
  const ledger = fs.readFileSync(
    path.join(
      skillRoot,
      "assets",
      "templates",
      "hypothesis-evidence-ledger.md",
    ),
    "utf8",
  );
  const decision = fs.readFileSync(
    path.join(skillRoot, "assets", "templates", "decision-analysis.md"),
    "utf8",
  );
  const handoff = fs.readFileSync(
    path.join(skillRoot, "assets", "templates", "synthesis-handoff.md"),
    "utf8",
  );
  assert.match(brief, /SRC-001/);
  assert.doesNotMatch(brief, /EVD-001/);
  assert.match(ledger, /SRC-001/);
  assert.match(ledger, /Assumptions may guide analysis but do not count/);
  assert.match(decision, /weights must sum to 100%/);
  assert.match(decision, /Use one row per option and criterion/);
  assert.match(decision, /Equal weights/);
  assert.match(handoff, /Issue IDs/);
  assert.match(handoff, /Hypothesis IDs/);
  assert.match(handoff, /Analysis status` is `Incomplete/);
  const techWriter = fs.readFileSync(
    path.join(repositoryRoot, "skills", "tech-writer", "SKILL.md"),
    "utf8",
  );
  const presentationPlanner = fs.readFileSync(
    path.join(repositoryRoot, "skills", "presentation-planner", "SKILL.md"),
    "utf8",
  );
  assert.match(techWriter, /Never turn an\s+incomplete handoff/);
  assert.match(presentationPlanner, /If the handoff status is `Incomplete`/);
});

test("Blueprint and White Paper doctypes include templates and routing", () => {
  const skill = fs.readFileSync(
    path.join(repositoryRoot, "skills", "tech-writer", "SKILL.md"),
    "utf8",
  );
  const expectedFiles = [
    ["references", "doctypes", "blueprint.md"],
    ["references", "doctypes", "white-paper.md"],
    ["assets", "templates", "blueprint.md"],
    ["assets", "templates", "white-paper.md"],
  ];

  assert.match(skill, /\| Blueprint .* \| blueprint \|/);
  assert.match(skill, /\| White Paper .* \| white-paper \|/);
  assert.match(skill, /planning horizon,\n   approval authority, and baseline evidence for a Blueprint/);
  assert.match(skill, /central\n   claim, evidence standard, and publisher or sponsor conflicts/);
  for (const segments of expectedFiles) {
    assert.ok(
      fs.existsSync(
        path.join(repositoryRoot, "skills", "tech-writer", ...segments),
      ),
      `missing ${segments.join("/")}`,
    );
  }

  const lint = path.join(
    repositoryRoot,
    "skills",
    "tech-writer",
    "scripts",
    "lint.py",
  );
  for (const template of ["blueprint.md", "white-paper.md"]) {
    const templatePath = path.join(
      repositoryRoot,
      "skills",
      "tech-writer",
      "assets",
      "templates",
      template,
    );
    const result = JSON.parse(
      execFileSync("python3", [lint, "--json", templatePath], {
        encoding: "utf8",
      }),
    );
    assert.equal(result.finding_count, 0, `${template} should pass lint`);
  }
});

function assertAnalysisContracts(skillsRoot) {
  function read(skill, ...segments) {
    return fs.readFileSync(path.join(skillsRoot, skill, ...segments), "utf8");
  }
  function assertMarkers(content, markers, label) {
    const normalized = content.replace(/\s+/g, " ");
    for (const marker of markers) {
      assert.ok(normalized.includes(marker), `${label} should include ${marker}`);
    }
  }

  const decision = read(
    "consulting-analyst", "assets", "templates", "decision-analysis.md",
  );
  assert.match(decision, /\| Gap ID \| Intervention ID \| Required intervention \|/);
  assert.match(decision, /\| GAP-001 \| INT-001 \|/);
  assert.match(decision, /\| RSK-001 \| GAP-001 \/ INT-001 \|/);
  const handoff = read(
    "consulting-analyst", "assets", "templates", "synthesis-handoff.md",
  );
  assertMarkers(handoff, [
    "Issue IDs", "Hypothesis IDs", "Related Gap, Intervention, or Criterion IDs",
    "Supporting Finding IDs", "Related Issue and Hypothesis IDs",
    "Q / HYP → FND / EVD → GAP / INT / CRT → ACT",
    "`N/A` with a reason",
  ], "synthesis handoff");
  const contract = read(
    "consulting-analyst", "references", "handoff-contract.md",
  );
  assertMarkers(contract, [
    "`SRC` identifies a source record; `EVD` an analysis evidence record",
    "`INT` an intervention defined in Current–Target–Gap",
    "Actions link to supporting FND IDs, related Q / HYP IDs",
    "Transition risks reference the affected GAP / INT IDs",
    "do not require consulting IDs when no consulting handoff exists",
  ], "handoff contract");
  const ledger = read(
    "consulting-analyst", "assets", "templates", "hypothesis-evidence-ledger.md",
  );
  assertMarkers(ledger, [
    "one evidence row per hypothesis pairing", "explicitly list multiple HYP IDs",
    "separate rows with the same EVD ID",
    "repeated evidence is not independent corroboration",
    "Fact / Estimate / Interpretation",
    "Interpretations do not count as supporting evidence",
    "A `Supported` hypothesis must cite at least one `Fact` or `Estimate` EVD row",
    "whose direction is `Supports` for that hypothesis",
  ], "hypothesis evidence ledger");
  const evidenceRules = read(
    "consulting-analyst", "references", "evidence-and-hypotheses.md",
  );
  assertMarkers(evidenceRules, [
    "one evidence row per hypothesis pairing", "explicitly list multiple HYP IDs",
    "Interpretations do not count as supporting evidence",
    "`Supported` hypothesis requires at least one `Fact` or `Estimate`",
    "marked `Supports` for that hypothesis",
  ], "evidence discipline");

  for (const doctype of ["blueprint", "white-paper"]) {
    const template = read(
      "tech-writer", "assets", "templates", `${doctype}.md`,
    );
    const checklist = read(
      "tech-writer", "references", "doctypes", `${doctype}.md`,
    );
    assertMarkers(template, [
      "Analysis status: Completed / Incomplete / Not performed",
      "Evidence gaps:", "分析ハンドオフ:",
      "`Incomplete`の場合", "不足する証拠と確からしさ",
      "影響する結論・推奨事項を条件付きで記載する",
      "`Not performed`の場合", "分析未実施の範囲と理由",
      "該当しないリンクは理由付き`N/A`",
    ], `${doctype} template`);
    assertMarkers(checklist, [
      "Analysis status: Completed / Incomplete / Not performed",
      "`Evidence gaps`", "For `Incomplete`", "confidence visible",
      "conditional wording", "For `Not performed`",
      "without forcing consulting IDs when no consulting handoff exists",
    ], `${doctype} checklist`);
  }
  const blueprint = read("tech-writer", "assets", "templates", "blueprint.md");
  assert.match(blueprint, /\| 論点 Q IDs \| 仮説 HYP IDs \| 発見 FND IDs \| 証拠 EVD IDs \| ドライバー \| 設計原則 \| 目標能力 \| Gap \| 介入 INT IDs \| 評価基準 CRT IDs \| ワークストリーム \| 指標 \|/);
  assert.match(blueprint, /DRV-001 \| PRN-001 \| CAP-001 \| GAP-001/);
  assert.match(blueprint, /WS-001 \| KPI-001/);
  const whitePaper = read("tech-writer", "assets", "templates", "white-paper.md");
  assert.match(whitePaper, /\| 関連仮説 HYP IDs \|/);
  assert.match(whitePaper, /\| 分析上の発見 FND IDs \|/);
  assert.match(whitePaper, /\| 根拠 \| EVD-001、EVD-002 \|/);
  assert.match(whitePaper, /\| SRC-001 \| <著者、資料名、URL> \|/);
  assert.doesNotMatch(whitePaper, /\| EVD-\d+ \| <著者、資料名、URL> \|/);
  assert.match(whitePaper, /\| EVD-001 \| SRC-001 \| Fact \/ Estimate \/ Interpretation \|/);
  assert.match(whitePaper, /解釈として保持し、仮説を支持する証拠には数えない/);
  assertMarkers(read("tech-writer", "references", "doctypes", "blueprint.md"), [
    "Q / HYP / FND / EVD and GAP / INT / CRT",
  ], "Blueprint checklist");
  assertMarkers(read("tech-writer", "references", "doctypes", "white-paper.md"), [
    "SRC source records separate from EVD analysis evidence",
    "claims and findings link relevant HYP / FND / EVD IDs",
    "interpretations preserved without counting as supporting evidence",
    "`Supported` hypotheses backed by relevant Fact / Estimate evidence",
  ], "White Paper checklist");
}

function assertObsidianAssets(skillsRoot) {
  const relativePaths = [
    "tech-writer/assets/templates/obsidian.md",
    "tech-writer/references/doctypes/obsidian.md",
    "obsidian-vault/SKILL.md",
    "obsidian-vault/references/workflow.md",
    "obsidian-vault/references/execution-contract.json",
    "obsidian-vault/scripts/vault.py",
    "obsidian-vault/scripts/vault.py.lock",
  ];
  for (const relativePath of relativePaths) {
    assert.equal(
      fs.readFileSync(path.join(skillsRoot, relativePath), "utf8"),
      fs.readFileSync(path.join(repositoryRoot, "skills", relativePath), "utf8"),
      `${relativePath} should be installed without changing template syntax`,
    );
  }
}

function assertCanvasAssets(skillsRoot) {
  for (const relativePath of [
    "SKILL.md",
    "references/workflow.md",
    "references/execution-contract.json",
    "scripts/canvas.py",
    "scripts/canvas.py.lock",
    "assets/templates/note-map.canvas",
    "assets/templates/mind-map.canvas",
    "assets/templates/workflow.canvas",
    "assets/templates/comparison.canvas",
  ]) {
    assert.equal(
      fs.readFileSync(path.join(skillsRoot, "obsidian-canvas", relativePath), "utf8"),
      fs.readFileSync(path.join(repositoryRoot, "skills", "obsidian-canvas", relativePath), "utf8"),
      `Canvas ${relativePath} must be installed byte-identically`,
    );
  }
}

function assertBasesAssets(skillsRoot) {
  for (const relativePath of [
    "SKILL.md",
    "references/workflow.md",
    "references/execution-contract.json",
    "scripts/check.cjs",
    "scripts/package.json",
    "scripts/package-lock.json",
    "assets/templates/table.base",
    "assets/templates/cards.base",
    "assets/templates/list.base",
    "assets/templates/kanban.base",
  ]) {
    assert.deepEqual(
      fs.readFileSync(path.join(skillsRoot, "obsidian-bases", relativePath)),
      fs.readFileSync(path.join(repositoryRoot, "skills/obsidian-bases", relativePath)),
      `Bases ${relativePath} must be installed byte-identically`,
    );
  }
  assert.equal(
    fs.existsSync(path.join(skillsRoot, "obsidian-bases/scripts/node_modules")),
    false,
    "dependency preparation must remain an explicit separate operation",
  );
}

test("Obsidian requests route to a core-compatible template that passes structural lint", () => {
  const skillRoot = path.join(repositoryRoot, "skills", "tech-writer");
  const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.match(
    skill,
    /\| Obsidian note \/ vault template \| obsidian \| `references\/doctypes\/obsidian\.md` \|/,
  );
  const reference = fs.readFileSync(
    path.join(skillRoot, "references", "doctypes", "obsidian.md"),
    "utf8",
  );
  const templatePath = path.join(skillRoot, "assets", "templates", "obsidian.md");
  const template = fs.readFileSync(templatePath, "utf8");
  assert.match(reference, /`assets\/templates\/obsidian\.md`/);
  assert.match(template, /^---\naliases: \[\]\ntags: \[\]\ncreated: "\{\{date:YYYY-MM-DD\}\}"/);
  assert.match(template, /^# \{\{title\}\}$/m);
  assert.deepEqual(
    [...template.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]).sort(),
    ["date:YYYY-MM-DD", "title"],
  );
  assert.doesNotMatch(template, /<%|```(?:dataview|dataviewjs|templater)/);
  const result = JSON.parse(
    execFileSync("python3", [
      path.join(skillRoot, "scripts", "lint.py"), "--json", templatePath,
    ], { encoding: "utf8" }),
  );
  assert.equal(result.finding_count, 0);
});

test("analysis contracts preserve IDs, evidence rules, and incomplete status", () => {
  assertAnalysisContracts(path.join(repositoryRoot, "skills"));
});

test("Vault instructions distinguish direct editing from CLI plan-approved saving", () => {
  const vaultRoot = path.join(repositoryRoot, "skills", "obsidian-vault");
  const skill = fs.readFileSync(path.join(vaultRoot, "SKILL.md"), "utf8");
  const workflow = fs.readFileSync(
    path.join(vaultRoot, "references", "workflow.md"),
    "utf8",
  );
  assert.match(skill, /## Direct editing \(default\)/);
  assert.match(skill, /Use host read\/edit tools/);
  assert.match(skill, /Both save modes require explicit target\/change\/write authorization/);
  assert.match(skill, /Read back after saving/);
  assert.match(skill, /Never retry a failed CLI operation as a direct edit without permission/);
  assert.doesNotMatch(skill, /[\u3040-\u30ff\u3400-\u9fff]/u);
  assert.match(workflow, /直接編集でもjapanese-proseの保護検査とハッシュ付き意味レビューを省略しない/);
  const contract = JSON.parse(
    fs.readFileSync(path.join(vaultRoot, "references", "execution-contract.json"), "utf8"),
  );
  assert.equal(Object.hasOwn(contract["x-commands"], "edit"), false);
});

test("Vault working directories prefer user targets over session-state copies", () => {
  const vaultRoot = path.join(repositoryRoot, "skills", "obsidian-vault");
  const skill = fs.readFileSync(path.join(vaultRoot, "SKILL.md"), "utf8");
  const workflow = fs.readFileSync(
    path.join(vaultRoot, "references", "workflow.md"), "utf8",
  );
  assert.match(skill, /Use the user-specified directory, or the current directory at request start/);
  assert.match(skill, /resolve\s+relative targets from the selected working directory/);
  assert.match(skill, /Preserve explicitly\s+Vault-relative and absolute paths/);
  assert.match(skill, /Edit the resolved target itself, not a session-state copy/);
  assert.match(skill, /Never save any\s+operation files in session storage/);
  assert.match(skill, /Working-directory selection grants neither\s+whole-Vault access nor write permission/);
  assert.match(workflow, /相対指定の作業ディレクトリは開始時のカレントから/);
  assert.match(workflow, /CLI計画や添削に必要なVault外の場所を使えなければ、別の場所の指定とコピーへの同意を得るまで停止/);
  assert.match(workflow, /補助ファイルを作る許可は、対象ノートの保存許可ではない/);
  const handoff = fs.readFileSync(
    path.join(repositoryRoot, "skills", "tech-writer", "SKILL.md"), "utf8",
  );
  assert.match(handoff, /user-specified\s+directory, or the current directory at request start/);
  assert.match(handoff, /Do not replace the target with a copy in session-state\s+storage/);
});

test("all Obsidian workflows forbid session storage for auxiliary files and handoffs", () => {
  for (const name of ["obsidian-vault", "obsidian-canvas", "obsidian-bases"]) {
    for (const relative of ["SKILL.md", "references/workflow.md"]) {
      const text = fs.readFileSync(path.join(repositoryRoot, "skills", name, relative), "utf8");
      assert.match(text, /Never save any\s+operation files in session storage|成果物と補助ファイルは、セッション領域へ一切保存しない/);
      assert.match(text, /~\/\.copilot\/session-state\//);
      assert.match(text, /temporary files|一時ファイル/);
      assert.match(text, /resolved locations|実体の保存場所/);
      assert.match(text, /delegated|委譲先/);
      assert.doesNotMatch(text, /unless the user explicitly selects it|ユーザーが保存先として明示しない限り/);
    }
  }
  const handoff = fs.readFileSync(
    path.join(repositoryRoot, "skills/tech-writer/SKILL.md"), "utf8",
  );
  assert.match(handoff, /For Obsidian handoffs, never save any operation files in session storage/);
  assert.match(handoff, /non-session locations and this restriction to every delegated Skill/);
});

test("tech-writer lint detects bold delimiters touching prose", () => {
  const workingDirectory = createTemporaryDirectory();
  const badDocument = path.join(workingDirectory, "bad.md");
  const wideSpaceDocument = path.join(workingDirectory, "wide-space.md");
  const goodDocument = path.join(workingDirectory, "good.md");
  const lint = path.join(
    repositoryRoot,
    "skills",
    "tech-writer",
    "scripts",
    "lint.py",
  );

  fs.writeFileSync(
    badDocument,
    "# Test\n\nこれは**強調**にならない。\n",
  );
  fs.writeFileSync(
    wideSpaceDocument,
    "# Test\n\n" +
      "これは　**「AIが賢く先回りして質問責任を持つ」** といった文書。\n" +
      "これは **「AIが賢く先回りして質問責任を持つ」**　といった文書。\n",
  );
  fs.writeFileSync(
    goodDocument,
    "# Test\n\nこれは **強調** になる。\n\n" +
      "これは **「AIが賢く先回りして質問責任を持つ」** といった文書。\n",
  );

  const badResult = JSON.parse(
    execFileSync("python3", [lint, "--json", badDocument], {
      encoding: "utf8",
    }),
  );
  const goodResult = JSON.parse(
    execFileSync("python3", [lint, "--json", goodDocument], {
      encoding: "utf8",
    }),
  );
  const wideSpaceResult = JSON.parse(
    execFileSync("python3", [lint, "--json", wideSpaceDocument], {
      encoding: "utf8",
    }),
  );

  assert.ok(
    badResult.findings.some((finding) => finding.category === "bold_spacing"),
  );
  assert.equal(
    goodResult.findings.some((finding) => finding.category === "bold_spacing"),
    false,
  );
  assert.equal(
    wideSpaceResult.findings.filter(
      (finding) => finding.category === "bold_spacing",
    ).length,
    2,
  );
});

test("npm publishing routes prereleases away from latest", () => {
  const packageVersion = require("../package.json").version;
  const workflow = fs.readFileSync(
    path.join(repositoryRoot, ".github", "workflows", "npm-publish.yml"),
    "utf8",
  );

  assert.equal(publishTagForVersion("0.1.5-dev.0"), "next");
  assert.equal(publishTagForVersion("0.1.5-beta.1"), "next");
  assert.equal(publishTagForVersion("0.1.5"), "latest");
  assert.equal(
    execFileSync(
      process.execPath,
      [path.join(repositoryRoot, "bin", "npm-publish-tag.js")],
      { encoding: "utf8" },
    ).trim(),
    publishTagForVersion(packageVersion),
  );
  assert.match(workflow, /TAG=\$\(node bin\/npm-publish-tag\.js\)/);
  assert.match(workflow, /npm publish --access public --tag "\$TAG"/);
});

function createTemporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kotonoha-test-"));
}

function contrastRatio(foreground, background) {
  function luminance(hex) {
    const channels = [1, 3, 5].map(
      (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
    );
    const linear = channels.map((value) =>
      value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  const values = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function yamlColor(content, key) {
  const match = content.match(new RegExp(`^  ${key}: "(#[0-9A-F]{6})"$`, "m"));
  assert.ok(match, `missing color token ${key}`);
  return match[1];
}

function yamlChartSequence(content) {
  const match = content.match(
    /^  chart_sequence:\n((?:    - "#[0-9A-F]{6}"\n?)+)/m,
  );
  assert.ok(match, "missing chart_sequence");
  return [...match[1].matchAll(/"(#[0-9A-F]{6})"/g)].map(
    (entry) => entry[1],
  );
}

test("installs all skills into the default project directory", () => {
  const workingDirectory = createTemporaryDirectory();

  execFileSync(process.execPath, [cli, "install"], {
    cwd: workingDirectory,
    stdio: "pipe",
  });
  assertAnalysisContracts(path.join(workingDirectory, ".github", "skills"));
  assertObsidianAssets(path.join(workingDirectory, ".github", "skills"));
  assertCanvasAssets(path.join(workingDirectory, ".github", "skills"));
  assertBasesAssets(path.join(workingDirectory, ".github", "skills"));
  assert.equal(fs.existsSync(path.join(workingDirectory, ".claude")), false);

  assert.ok(
    fs.existsSync(
      path.join(
        workingDirectory,
        ".github",
        "skills",
        "consulting-analyst",
        "SKILL.md",
      ),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(
        workingDirectory,
        ".github",
        "skills",
        "tech-writer",
        "SKILL.md",
      ),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(
        workingDirectory,
        ".github",
        "skills",
        "japanese-prose",
        "SKILL.md",
      ),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(
        workingDirectory,
        ".github",
        "skills",
        "presentation-planner",
        "SKILL.md",
      ),
    ),
  );
});

test("installs identical skill bundles for the selected agents", async (t) => {
  for (const agent of ["copilot", "claude", "all"]) {
    await t.test(agent, (t) => {
      const workingDirectory = createTemporaryDirectory();
      t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
      execFileSync(process.execPath, [cli, "install", "--agent", agent], {
        cwd: workingDirectory,
        stdio: "pipe",
      });
      for (const [name, directory] of [["copilot", ".github"], ["claude", ".claude"]]) {
        const root = path.join(workingDirectory, directory, "skills");
        if (agent !== "all" && agent !== name) {
          assert.equal(fs.existsSync(root), false);
          continue;
        }
        assertAnalysisContracts(root);
        assertObsidianAssets(root);
        assertCanvasAssets(root);
        assertBasesAssets(root);
        const skills = fs.readdirSync(path.join(repositoryRoot, "skills"))
          .filter((skill) => fs.existsSync(path.join(repositoryRoot, "skills", skill, "SKILL.md")))
          .sort();
        assert.deepEqual(fs.readdirSync(root).sort(), skills);
        for (const skill of skills) {
          assert.equal(
            fs.readFileSync(path.join(root, skill, "SKILL.md"), "utf8"),
            fs.readFileSync(path.join(repositoryRoot, "skills", skill, "SKILL.md"), "utf8"),
          );
        }
      }
    });
  }
});

test("a single agent supports equals syntax, skill selection and a custom target", (t) => {
  const workingDirectory = createTemporaryDirectory();
  t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
  execFileSync(process.execPath, [
    cli, "install", "--agent=claude", "--target=custom", "--skill=presentation-planner",
  ], { cwd: workingDirectory, stdio: "pipe" });
  assert.deepEqual(fs.readdirSync(path.join(workingDirectory, "custom")), ["presentation-planner"]);
  assert.equal(fs.existsSync(path.join(workingDirectory, "custom/presentation-planner/SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(workingDirectory, ".github")), false);
  assert.equal(fs.existsSync(path.join(workingDirectory, ".claude")), false);
});

test("invalid agent options fail before creating either agent root", async (t) => {
  for (const [args, message] of [
    [["--agent"], /--agent requires/],
    [["--agent", "--force"], /--agent requires/],
    [["--agent="], /--agent requires/],
    [["--agent", "unknown"], /unknown agent: unknown/],
    [["--agent=toString"], /unknown agent: toString/],
    [["--agent", "all", "--target", "custom"], /--target cannot be combined with --agent all/],
    [["--target=custom", "--agent=all"], /--target cannot be combined with --agent all/],
    [["--agent", "all", "--skill", "unknown-skill"], /unknown skill: unknown-skill/],
  ]) {
    await t.test(args.join(" "), (t) => {
      const workingDirectory = createTemporaryDirectory();
      t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
      const result = spawnSync(process.execPath, [cli, "install", ...args], {
        cwd: workingDirectory, encoding: "utf8",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, message);
      assert.deepEqual(fs.readdirSync(workingDirectory), []);
    });
  }
});

test("both agents preserve existing skills and force updates only the selected agent", (t) => {
  const workingDirectory = createTemporaryDirectory();
  t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
  const roots = [".github/skills", ".claude/skills"].map((root) => path.join(workingDirectory, root));
  for (const root of roots) {
    fs.mkdirSync(path.join(root, "tech-writer"), { recursive: true });
    fs.writeFileSync(path.join(root, "tech-writer/custom.txt"), "keep");
  }
  execFileSync(process.execPath, [cli, "install", "--agent=all"], {
    cwd: workingDirectory, stdio: "pipe",
  });
  for (const root of roots) {
    assert.equal(fs.readFileSync(path.join(root, "tech-writer/custom.txt"), "utf8"), "keep");
    assert.equal(fs.existsSync(path.join(root, "japanese-prose/SKILL.md")), true);
  }
  execFileSync(process.execPath, [cli, "install", "--agent", "claude", "--force"], {
    cwd: workingDirectory, stdio: "pipe",
  });
  assert.equal(fs.existsSync(path.join(roots[1], "tech-writer/custom.txt")), false);
  assert.equal(fs.readFileSync(path.join(roots[0], "tech-writer/custom.txt"), "utf8"), "keep");
});

test("a selected skill conflict on either agent is checked before copying to the other", (t) => {
  const workingDirectory = createTemporaryDirectory();
  t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
  const roots = [".github/skills", ".claude/skills"].map((root) => path.join(workingDirectory, root));
  fs.mkdirSync(path.join(roots[1], "tech-writer"), { recursive: true });
  fs.writeFileSync(path.join(roots[1], "tech-writer/custom.txt"), "preserve");
  const result = spawnSync(process.execPath, [
    cli, "install", "--agent", "all", "--skill", "tech-writer",
  ], { cwd: workingDirectory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exists.*--force/);
  assert.equal(fs.existsSync(roots[0]), false);
  assert.equal(fs.readFileSync(path.join(roots[1], "tech-writer/custom.txt"), "utf8"), "preserve");
  fs.mkdirSync(path.join(roots[1], "unselected"));
  fs.writeFileSync(path.join(roots[1], "unselected/custom.txt"), "keep sibling");
  execFileSync(process.execPath, [
    cli, "install", "--agent", "all", "--skill", "tech-writer", "--force",
  ], { cwd: workingDirectory, stdio: "pipe" });
  for (const root of roots) {
    assert.equal(fs.existsSync(path.join(root, "tech-writer/SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(root, "tech-writer/custom.txt")), false);
  }
  assert.equal(fs.readFileSync(path.join(roots[1], "unselected/custom.txt"), "utf8"), "keep sibling");
  assert.equal(fs.existsSync(path.join(roots[0], "japanese-prose")), false);
});

test("an unusable second agent root stops a forced install before replacing skills", (t) => {
  const workingDirectory = createTemporaryDirectory();
  t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
  const copilot = path.join(workingDirectory, ".github/skills");
  fs.mkdirSync(path.join(copilot, "tech-writer"), { recursive: true });
  fs.writeFileSync(path.join(copilot, "tech-writer/custom.txt"), "preserve");
  fs.mkdirSync(path.join(workingDirectory, ".claude"));
  fs.writeFileSync(path.join(workingDirectory, ".claude/skills"), "not a directory");
  const result = spawnSync(process.execPath, [
    cli, "install", "--agent", "all", "--force",
  ], { cwd: workingDirectory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /kotonoha: failed to prepare skill root/);
  assert.equal(fs.readFileSync(path.join(copilot, "tech-writer/custom.txt"), "utf8"), "preserve");
  assert.deepEqual(fs.readdirSync(copilot), ["tech-writer"]);
  assert.equal(fs.readFileSync(path.join(workingDirectory, ".claude/skills"), "utf8"), "not a directory");
});

test("installs one selected skill", () => {
  const workingDirectory = createTemporaryDirectory();

  execFileSync(
    process.execPath,
    [cli, "install", "--skill", "presentation-planner"],
    {
      cwd: workingDirectory,
      stdio: "pipe",
    },
  );

  assert.ok(
    fs.existsSync(
      path.join(
        workingDirectory,
        ".github",
        "skills",
        "presentation-planner",
        "SKILL.md",
      ),
    ),
  );
  assert.equal(
    fs.existsSync(
      path.join(
        workingDirectory,
        ".github",
        "skills",
        "tech-writer",
      ),
    ),
    false,
  );
});

test("installs obsidian-vault alone without silently adding sibling skills", () => {
  const workingDirectory = createTemporaryDirectory();
  execFileSync(
    process.execPath,
    [cli, "install", "--skill", "obsidian-vault"],
    { cwd: workingDirectory, stdio: "pipe" },
  );
  const root = path.join(workingDirectory, ".github", "skills");
  for (const relativePath of [
    "obsidian-vault/SKILL.md",
    "obsidian-vault/scripts/vault.py",
    "obsidian-vault/scripts/vault.py.lock",
    "obsidian-vault/references/execution-contract.json",
    "obsidian-vault/references/workflow.md",
  ]) {
    assert.equal(
      fs.readFileSync(path.join(root, relativePath), "utf8"),
      fs.readFileSync(path.join(repositoryRoot, "skills", relativePath), "utf8"),
    );
  }
  assert.equal(fs.existsSync(path.join(root, "japanese-prose")), false);
  assert.equal(fs.existsSync(path.join(root, "tech-writer")), false);
});

test("installs Canvas alone while preserving an existing sibling", () => {
  const workingDirectory = createTemporaryDirectory();
  const target = path.join(workingDirectory, "skills");
  const sibling = path.join(target, "obsidian-vault");
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(sibling, "custom.txt"), "keep existing backend");
  execFileSync(process.execPath, [cli, "install", "--target", target, "--skill", "obsidian-canvas"], {
    cwd: workingDirectory, stdio: "pipe",
  });
  assertCanvasAssets(target);
  assert.equal(fs.readFileSync(path.join(sibling, "custom.txt"), "utf8"), "keep existing backend");
  assert.deepEqual(fs.readdirSync(sibling), ["custom.txt"]);
  assert.equal(fs.existsSync(path.join(target, "japanese-prose")), false);
  const aloneTarget = path.join(workingDirectory, "alone");
  execFileSync(process.execPath, [cli, "install", "--target", aloneTarget, "--skill", "obsidian-canvas"], {
    cwd: workingDirectory, stdio: "pipe",
  });
  assertCanvasAssets(aloneTarget);
  assert.equal(fs.existsSync(path.join(aloneTarget, "obsidian-vault")), false);
});

test("installs Bases alone with its lock but without siblings or runtime preparation", (t) => {
  const workingDirectory = createTemporaryDirectory();
  t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
  const root = path.join(workingDirectory, "skills");
  const sibling = path.join(root, "obsidian-vault");
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(sibling, "custom.txt"), "preserve");
  execFileSync(process.execPath, [cli, "install", "--skill", "obsidian-bases", "--target", root], {
    cwd: workingDirectory, stdio: "pipe",
  });
  assertBasesAssets(root);
  assert.deepEqual(fs.readdirSync(root).sort(), ["obsidian-bases", "obsidian-vault"]);
  assert.equal(fs.readFileSync(path.join(sibling, "custom.txt"), "utf8"), "preserve");
  const checker = path.join(root, "obsidian-bases/scripts/check.cjs");
  const result = spawnSync(process.execPath, [checker, "--stdin"], {
    input: JSON.stringify({ schema_version: 1, intent: "inspect", document: "{}", application_version: "1.14.0" }),
    encoding: "utf8",
  });
  assert.equal(result.status, 4);
  const report = JSON.parse(result.stdout);
  assert.equal(report.issues[0].code, "dependency_missing");
  assert.equal(report.write_status, "not_requested");
  assert.equal(fs.existsSync(path.join(root, "obsidian-bases/scripts/node_modules")), false);
});

test("source installation excludes dependency caches at every nested level", (t) => {
  const root = createTemporaryDirectory();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "bin"));
  fs.copyFileSync(cli, path.join(root, "bin/kotonoha.js"));
  fs.copyFileSync(path.join(repositoryRoot, "package.json"), path.join(root, "package.json"));
  const skill = path.join(root, "skills/obsidian-bases");
  fs.mkdirSync(path.join(skill, "scripts/node_modules/local-cache"), { recursive: true });
  fs.mkdirSync(path.join(skill, "nested/node_modules/another-cache"), { recursive: true });
  fs.writeFileSync(path.join(skill, "SKILL.md"), "# Fixture");
  fs.writeFileSync(path.join(skill, "scripts/package-lock.json"), '{"fixture":true}');
  fs.writeFileSync(path.join(skill, "scripts/node_modules/local-cache/private.txt"), "must not copy");
  execFileSync(process.execPath, [path.join(root, "bin/kotonoha.js"), "install", "--target", "installed"], {
    cwd: root, stdio: "pipe",
  });
  const installed = path.join(root, "installed/obsidian-bases");
  assert.equal(fs.existsSync(path.join(installed, "scripts/node_modules")), false);
  assert.equal(fs.existsSync(path.join(installed, "nested/node_modules")), false);
  assert.equal(fs.readFileSync(path.join(installed, "scripts/package-lock.json"), "utf8"), '{"fixture":true}');
});

test("rejects an unknown selected skill", () => {
  const workingDirectory = createTemporaryDirectory();
  const result = spawnSync(
    process.execPath,
    [cli, "install", "--skill", "unknown-skill"],
    {
      cwd: workingDirectory,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown skill: unknown-skill/);
  assert.match(result.stderr, /available skills:/);
});

test("default install adds missing skills without replacing existing ones", () => {
  const workingDirectory = createTemporaryDirectory();
  const target = path.join(workingDirectory, ".github", "skills");
  const techWriter = path.join(target, "tech-writer");

  fs.mkdirSync(techWriter, { recursive: true });
  fs.writeFileSync(path.join(techWriter, "custom.txt"), "keep");

  execFileSync(process.execPath, [cli, "install"], {
    cwd: workingDirectory,
    stdio: "pipe",
  });

  assert.equal(fs.readFileSync(path.join(techWriter, "custom.txt"), "utf8"), "keep");
  assert.ok(
    fs.existsSync(path.join(target, "presentation-planner", "SKILL.md")),
  );
  assert.ok(fs.existsSync(path.join(target, "consulting-analyst", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(target, "japanese-prose", "SKILL.md")));
});

test("refuses to replace an explicitly selected skill without --force", () => {
  const workingDirectory = createTemporaryDirectory();
  const target = path.join(workingDirectory, "custom-skills");

  execFileSync(
    process.execPath,
    [cli, "install", "--target", target, "--skill", "tech-writer"],
    {
      cwd: workingDirectory,
      stdio: "pipe",
    },
  );

  const result = spawnSync(
    process.execPath,
    [cli, "install", "--target", target, "--skill", "tech-writer"],
    {
      cwd: workingDirectory,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exists/);
  assert.match(result.stderr, /--force/);
});

test("--force replaces an existing installation", () => {
  const workingDirectory = createTemporaryDirectory();
  const target = path.join(workingDirectory, "custom-skills");
  const destination = path.join(target, "tech-writer");

  execFileSync(process.execPath, [cli, "install", "--target", target], {
    cwd: workingDirectory,
    stdio: "pipe",
  });
  fs.writeFileSync(path.join(destination, "stale-file.txt"), "stale");

  execFileSync(
    process.execPath,
    [cli, "install", "--target", target, "--force"],
    {
      cwd: workingDirectory,
      stdio: "pipe",
    },
  );

  assert.equal(fs.existsSync(path.join(destination, "stale-file.txt")), false);
  assert.ok(fs.existsSync(path.join(destination, "SKILL.md")));
  assert.ok(
    fs.existsSync(path.join(target, "presentation-planner", "SKILL.md")),
  );
  assert.ok(fs.existsSync(path.join(target, "consulting-analyst", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(target, "japanese-prose", "SKILL.md")));
});

test("the packed npm artifact installs a usable CLI", (t) => {
  const packDirectory = createTemporaryDirectory();
  const consumerDirectory = createTemporaryDirectory();
  t.after(() => fs.rmSync(packDirectory, { recursive: true, force: true }));
  t.after(() => fs.rmSync(consumerDirectory, { recursive: true, force: true }));

  const packOutput = execFileSync(
    "npm",
    ["pack", "--silent", "--pack-destination", packDirectory],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  ).trim();
  const tarball = path.join(packDirectory, packOutput.split(/\r?\n/).at(-1));

  execFileSync("npm", ["init", "-y"], {
    cwd: consumerDirectory,
    stdio: "ignore",
  });
  execFileSync("npm", ["install", "--silent", tarball], {
    cwd: consumerDirectory,
    stdio: "pipe",
  });
  assert.equal(fs.existsSync(path.join(consumerDirectory, ".github")), false);
  assert.equal(fs.existsSync(path.join(consumerDirectory, ".claude")), false);
  assert.ok(
    fs.existsSync(
      path.join(consumerDirectory, "node_modules", "kotonoha", "README-ja.md"),
    ),
  );

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["--no-install", "kotonoha", "install", "--agent", "all"], {
    cwd: consumerDirectory, stdio: "pipe",
  });
  for (const directory of [".github", ".claude"]) {
    const root = path.join(consumerDirectory, directory, "skills");
    assertAnalysisContracts(root);
    assertObsidianAssets(root);
    assertCanvasAssets(root);
    assertBasesAssets(root);
    const help = execFileSync(process.execPath, [
      path.join(root, "obsidian-bases/scripts/check.cjs"), "--help",
    ], { encoding: "utf8" });
    assert.equal(JSON.parse(help).read_only, true);
  }
  execFileSync(
    npx,
    [
      "--no-install",
      "kotonoha",
      "install",
      "--target",
      ".copilot/skills",
    ],
    {
      cwd: consumerDirectory,
      stdio: "pipe",
    },
  );
  assertObsidianAssets(path.join(consumerDirectory, ".copilot", "skills"));
  assertCanvasAssets(path.join(consumerDirectory, ".copilot", "skills"));
  assertBasesAssets(path.join(consumerDirectory, ".copilot", "skills"));
  const installedBasesChecker = path.join(
    consumerDirectory, ".copilot/skills/obsidian-bases/scripts/check.cjs",
  );
  const basesHelp = spawnSync(process.execPath, [installedBasesChecker, "--help"], {
    encoding: "utf8",
  });
  assert.equal(basesHelp.status, 0);
  assert.equal(JSON.parse(basesHelp.stdout).read_only, true);
  const basesMissing = spawnSync(process.execPath, [installedBasesChecker, "--stdin"], {
    input: '{"schema_version":1,"intent":"inspect","document":"{}","application_version":"1.14.0"}',
    encoding: "utf8",
  });
  assert.equal(basesMissing.status, 4);
  assert.equal(JSON.parse(basesMissing.stdout).issues[0].code, "dependency_missing");

  assert.ok(
    fs.existsSync(
      path.join(
        consumerDirectory,
        ".copilot",
        "skills",
        "tech-writer",
        "SKILL.md",
      ),
    ),
  );
  const installedConsultingAnalyst = path.join(
    consumerDirectory,
    ".copilot",
    "skills",
    "consulting-analyst",
  );
  assert.ok(fs.existsSync(path.join(installedConsultingAnalyst, "SKILL.md")));
  const installedConsultingSkill = fs.readFileSync(
    path.join(installedConsultingAnalyst, "SKILL.md"),
    "utf8",
  );
  assert.match(installedConsultingSkill, /Issue Tree \/ logic tree/);
  assert.match(installedConsultingSkill, /analysis incomplete/);
  for (const template of [
    "analysis-brief.md",
    "issue-tree.md",
    "hypothesis-evidence-ledger.md",
    "decision-analysis.md",
    "synthesis-handoff.md",
  ]) {
    assert.ok(
      fs.existsSync(
        path.join(installedConsultingAnalyst, "assets", "templates", template),
      ),
      `${template} should be included in consulting-analyst`,
    );
  }
  for (const reference of [
    "framework-selection.md",
    "evidence-and-hypotheses.md",
    "handoff-contract.md",
  ]) {
    assert.ok(
      fs.existsSync(
        path.join(installedConsultingAnalyst, "references", reference),
      ),
      `${reference} should be included in consulting-analyst`,
    );
  }
  const installedJapaneseProse = path.join(
    consumerDirectory,
    ".copilot",
    "skills",
    "japanese-prose",
  );
  assert.ok(fs.existsSync(path.join(installedJapaneseProse, "SKILL.md")));
  assert.ok(fs.existsSync(path.join(installedJapaneseProse, "NOTICE.md")));
  const installedJapaneseProseSkill = fs.readFileSync(
    path.join(installedJapaneseProse, "SKILL.md"),
    "utf8",
  );
  const installedJapaneseProseNotice = fs.readFileSync(
    path.join(installedJapaneseProse, "NOTICE.md"),
    "utf8",
  );
  assert.match(
    installedJapaneseProseSkill,
    /original\s+kotonoha implementation/,
  );
  assert.match(installedJapaneseProseSkill, /GiNZA/);
  assert.match(
    installedJapaneseProseNotice,
    /does not include source\s+code/,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        consumerDirectory,
        ".copilot",
        "skills",
        "natural-japanese",
      ),
    ),
    false,
  );
  assert.ok(
    fs.existsSync(path.join(installedJapaneseProse, "scripts", "lint.py")),
  );
  assert.equal(
    fs.existsSync(
      path.join(installedJapaneseProse, "scripts", "__pycache__"),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(installedJapaneseProse, "scripts", "semantic.py"),
    ),
    false,
  );
  assert.ok(
    fs.existsSync(
      path.join(
        installedJapaneseProse,
        "references",
        "writing-guidelines.md",
      ),
    ),
  );
  const installedSkill = fs.readFileSync(
    path.join(
      consumerDirectory,
      ".copilot",
      "skills",
      "tech-writer",
      "SKILL.md",
    ),
    "utf8",
  );
  assert.match(installedSkill, /Rubber-duck review loop/);
  assert.match(installedSkill, /write mode only/);
  assert.match(installedSkill, /registered `rubber-duck` agent/);
  assert.match(installedSkill, /at most five rubber-duck rounds/);
  assert.match(installedSkill, /run one[\s\S]*round and finish immediately/);
  assert.match(installedSkill, /review not performed/);
  assert.match(installedSkill, /review did not converge/);
  assert.match(installedSkill, /## 5\. Optimize Japanese prose/);
  assert.match(installedSkill, /Japanese prose optimization completed/);
  assert.match(installedSkill, /Japanese prose optimization not performed/);
  assert.match(installedSkill, /Japanese prose optimization did not converge/);
  assert.match(installedSkill, /## 7\. Doctype checklist summary/);
  const japaneseOptimizationReference = fs.readFileSync(
    path.join(
      consumerDirectory,
      ".copilot",
      "skills",
      "tech-writer",
      "references",
      "japanese-prose-optimization.md",
    ),
    "utf8",
  );
  assert.match(japaneseOptimizationReference, /Freeze these invariants/);
  assert.match(japaneseOptimizationReference, /at most\s+three rounds/);
  assert.match(
    japaneseOptimizationReference,
    /Japanese prose optimization completed/,
  );
  assert.match(
    japaneseOptimizationReference,
    /Japanese prose optimization not performed/,
  );
  assert.match(
    japaneseOptimizationReference,
    /Japanese prose optimization did not converge/,
  );
  assert.match(
    installedSkill,
    /\| Internal technical proposal \| technical-proposal \|/,
  );
  assert.match(
    installedSkill,
    /\| Requirements definition \/ 要件定義書 \| requirements-definition \|/,
  );
  assert.match(
    installedSkill,
    /\| System design \/ システム設計書 \| system-design \|/,
  );
  assert.match(
    installedSkill,
    /\| Test plan \/ テスト計画書 \| test-plan \|/,
  );
  assert.match(
    installedSkill,
    /\| Operations design \/ Runbook \/ 運用設計書 \| operations-runbook \|/,
  );
  assert.match(
    installedSkill,
    /\| Migration plan \/ 移行計画書 \| migration-plan \|/,
  );
  assert.match(
    installedSkill,
    /\| Security design \/ Threat model \/ セキュリティ設計書 \| security-design \|/,
  );
  assert.match(installedSkill, /\| Request for information \/ RFI \| rfi \|/);
  assert.match(installedSkill, /\| Request for proposal \/ RFP \| rfp \|/);

  const installedPresentationSkill = fs.readFileSync(
    path.join(
      consumerDirectory,
      ".copilot",
      "skills",
      "presentation-planner",
      "SKILL.md",
    ),
    "utf8",
  );
  assert.match(installedPresentationSkill, /Responsibility boundary/);
  assert.match(
    installedPresentationSkill,
    /Does\s+NOT implement PPTX generation/,
  );
  assert.match(installedPresentationSkill, /PPTX generation not performed/);
  assert.match(installedPresentationSkill, /## 0\. Route direct PPTX operations away/);
  assert.match(installedPresentationSkill, /presentation-scenario\.md/);
  assert.match(installedPresentationSkill, /five planning artifacts/);

  for (const scenario of [
    "executive-decision.md",
    "technical-briefing.md",
    "data-report.md",
  ]) {
    const scenarioPath = path.join(
      consumerDirectory,
      ".copilot",
      "skills",
      "presentation-planner",
      "assets",
      "scenario-templates",
      scenario,
    );
    assert.ok(
      fs.existsSync(scenarioPath),
      `${scenario} should be included in the installed presentation skill`,
    );
    const scenarioContent = fs.readFileSync(scenarioPath, "utf8");
    assert.match(scenarioContent, /## Scenario arc/);
    assert.match(scenarioContent, /## Scenario acceptance checks/);
  }
  assert.ok(
    fs.existsSync(
      path.join(
        consumerDirectory,
        ".copilot",
        "skills",
        "presentation-planner",
        "references",
        "scenario-templates.md",
      ),
    ),
  );

  for (const design of [
    "executive-proposal.yaml",
    "technical-briefing.yaml",
    "data-report.yaml",
  ]) {
    assert.ok(
      fs.existsSync(
        path.join(
          consumerDirectory,
          ".copilot",
          "skills",
          "presentation-planner",
          "assets",
          "design-templates",
          design,
        ),
      ),
      `${design} should be included in the installed presentation skill`,
    );
    const designContent = fs.readFileSync(
      path.join(
        consumerDirectory,
        ".copilot",
        "skills",
        "presentation-planner",
        "assets",
        "design-templates",
        design,
      ),
      "utf8",
    );
    assert.equal(yamlColor(designContent, "background"), "#FFFFFF");
    assert.equal(yamlColor(designContent, "brand_red"), "#F25022");
    assert.equal(yamlColor(designContent, "brand_green"), "#7FBA00");
    assert.equal(yamlColor(designContent, "brand_blue"), "#00A4EF");
    assert.equal(yamlColor(designContent, "brand_yellow"), "#FFB900");
    assert.ok(
      contrastRatio(
        yamlColor(designContent, "accent"),
        yamlColor(designContent, "surface"),
      ) >= 4.5,
    );
    for (const token of [
      "text_primary",
      "text_secondary",
      "accent",
      "positive",
      "warning",
      "critical",
    ]) {
      for (const surface of ["background", "surface"]) {
        assert.ok(
          contrastRatio(
            yamlColor(designContent, token),
            yamlColor(designContent, surface),
          ) >= 4.5,
          `${design}: ${token} must meet contrast on ${surface}`,
        );
      }
    }
    assert.deepEqual(yamlChartSequence(designContent), [
      "#005A9E",
      "#F25022",
      "#767676",
    ]);
  }
  assert.ok(
    fs.existsSync(
      path.join(
        consumerDirectory,
        ".copilot",
        "skills",
        "presentation-planner",
        "references",
        "customizing-design-templates.md",
      ),
    ),
  );

  for (const template of [
    "requirements-definition.md",
    "system-design.md",
    "test-plan.md",
    "operations-runbook.md",
    "migration-plan.md",
    "security-design.md",
    "technical-proposal.md",
    "blueprint.md",
    "white-paper.md",
    "rfi.md",
    "rfp.md",
    "qiita.md",
  ]) {
    assert.ok(
      fs.existsSync(
        path.join(
          consumerDirectory,
          ".copilot",
          "skills",
          "tech-writer",
          "assets",
          "templates",
          template,
        ),
      ),
      `${template} should be included in the installed skill`,
    );
    assert.ok(
      fs.existsSync(
        path.join(
          consumerDirectory,
          ".copilot",
          "skills",
          "tech-writer",
          "references",
          "doctypes",
          template,
        ),
      ),
      `${template} doctype reference should be included in the installed skill`,
    );
  }

  const requirementsTemplate = fs.readFileSync(
    path.join(
      consumerDirectory,
      ".copilot",
      "skills",
      "tech-writer",
      "assets",
      "templates",
      "requirements-definition.md",
    ),
    "utf8",
  );
  assert.match(requirementsTemplate, /## 機能要件/);
  assert.match(requirementsTemplate, /## 非機能要件/);
  assert.match(requirementsTemplate, /## 受入条件/);
  assert.match(requirementsTemplate, /## 要件トレーサビリティ/);

  const systemDesignTemplate = fs.readFileSync(
    path.join(
      consumerDirectory,
      ".copilot",
      "skills",
      "tech-writer",
      "assets",
      "templates",
      "system-design.md",
    ),
    "utf8",
  );
  assert.match(systemDesignTemplate, /対応する要件定義書/);
  assert.match(systemDesignTemplate, /## セキュリティ設計/);
  assert.match(systemDesignTemplate, /シークレット管理/);
  assert.match(systemDesignTemplate, /## テスト方針と要件トレーサビリティ/);

  const qiitaTemplate = fs.readFileSync(
    path.join(
      consumerDirectory,
      ".copilot",
      "skills",
      "tech-writer",
      "assets",
      "templates",
      "qiita.md",
    ),
    "utf8",
  );
  assert.match(qiitaTemplate, /^# 検証した環境$/m);
  assert.match(qiitaTemplate, /^## <手順の前提または補足>$/m);

  const templateMarkers = {
    "test-plan.md": [
      "## テスト戦略",
      "## 開始条件と終了条件",
      "## テストケースと要件トレーサビリティ",
      "対応セキュリティ試験ID",
    ],
    "operations-runbook.md": [
      "## 監視・ログ・アラート",
      "## 症状別Runbook",
      "## バックアップとリストア",
    ],
    "migration-plan.md": [
      "## リハーサル計画",
      "## Go / No-Go判定",
      "## ロールバック計画",
    ],
    "security-design.md": [
      "## アーキテクチャと信頼境界",
      "## 脅威モデル",
      "## セキュリティトレーサビリティ",
    ],
    "blueprint.md": [
      "## 目標とする能力と将来像",
      "## 移行段階とロードマップ",
      "## トレーサビリティ",
      "Draft / In Review / Approved / Rejected / Deferred / Superseded",
      "承認結果が`Rejected`または`Deferred`の場合",
    ],
    "white-paper.md": [
      "## 調査・分析方法",
      "## 反対意見・代替解釈・限界",
      "## 利害関係と開示",
      "## 証拠台帳",
      "## 公開承認とレビュー記録",
      "Approved for Publication",
      "法務・コンプライアンス・主張レビュー",
      "必須レビューの`Approved`または理由付き`N/A`",
      "顧客名・数値・事例の掲載許諾",
    ],
  };
  for (const [template, markers] of Object.entries(templateMarkers)) {
    const content = fs.readFileSync(
      path.join(
        consumerDirectory,
        ".copilot",
        "skills",
        "tech-writer",
        "assets",
        "templates",
        template,
      ),
      "utf8",
    );
    for (const marker of markers) {
      assert.ok(content.includes(marker), `${template} should include ${marker}`);
    }
  }

  const installedTechWriterDirectory = path.join(
    consumerDirectory,
    ".copilot",
    "skills",
    "tech-writer",
  );
  assertAnalysisContracts(path.dirname(installedTechWriterDirectory));
  const installedDoctypeDirectory = path.join(
    installedTechWriterDirectory,
    "references",
    "doctypes",
  );
  for (const reference of fs.readdirSync(installedDoctypeDirectory)) {
    if (!reference.endsWith(".md")) continue;
    const referenceContent = fs.readFileSync(
      path.join(installedDoctypeDirectory, reference),
      "utf8",
    );
    for (const match of referenceContent.matchAll(/Start from `([^`]+)`/g)) {
      assert.ok(
        fs.existsSync(path.join(installedTechWriterDirectory, match[1])),
        `${reference} should point to an installed template: ${match[1]}`,
      );
    }
  }
});
