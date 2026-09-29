const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const cli = path.join(repositoryRoot, "bin", "kotonoha.js");

function createTemporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kotonoha-test-"));
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
  assert.match(installedSkill, /## 6\. Doctype checklist summary/);
  assert.match(
    installedSkill,
    /\| Internal technical proposal \| technical-proposal \|/,
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
  }

  for (const template of ["technical-proposal.md", "rfi.md", "rfp.md"]) {
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
});
