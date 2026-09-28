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

test("installs tech-writer into the default project directory", () => {
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
});

test("refuses to replace an existing installation without --force", () => {
  const workingDirectory = createTemporaryDirectory();
  const target = path.join(workingDirectory, "custom-skills");

  execFileSync(process.execPath, [cli, "install", "--target", target], {
    cwd: workingDirectory,
    stdio: "pipe",
  });

  const result = spawnSync(
    process.execPath,
    [cli, "install", "--target", target],
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
});
