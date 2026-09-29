const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { publishTagForVersion } = require("../bin/npm-publish-tag.js");

const repositoryRoot = path.resolve(__dirname, "..");
const cli = path.join(repositoryRoot, "bin", "kotonoha.js");

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
        "presentation-planner",
        "SKILL.md",
      ),
    ),
  );
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
});

test("the packed npm artifact installs a usable CLI", () => {
  const packDirectory = createTemporaryDirectory();
  const consumerDirectory = createTemporaryDirectory();

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

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
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
    "rfi.md",
    "rfp.md",
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
