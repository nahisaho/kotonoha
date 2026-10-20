#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const packageJson = require("../package.json");
const agentTargets = {
  copilot: ".github/skills",
  claude: ".claude/skills",
};

function printUsage() {
  console.log(`Usage:
  kotonoha install [--agent <copilot|claude|all>] [--target <directory>] [--skill <name|all>] [--force]

Options:
  --agent <name|all>    Agent to install for (default: copilot)
                       copilot: .github/skills; claude: .claude/skills; all: both
  --target <directory>  Override the skill root for one agent; cannot combine with --agent all
  --skill <name|all>    Skill to install (default: all)
  --force               Replace existing selected skill installations
  --help                 Show this help
  --version              Show the installed kotonoha version`);
}

function fail(message) {
  console.error(`kotonoha: ${message}`);
  process.exitCode = 1;
}

function parseInstallOptions(args) {
  let agent = "copilot";
  let target;
  let skill = "all";
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--force") {
      force = true;
      continue;
    }

    if (argument === "--agent") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--agent requires copilot, claude, or all");
      }
      agent = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--agent=")) {
      const value = argument.slice("--agent=".length);
      if (!value) {
        throw new Error("--agent requires copilot, claude, or all");
      }
      agent = value;
      continue;
    }

    if (argument === "--target") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--target requires a directory");
      }
      target = value;
      index += 1;
      continue;
    }

    if (argument === "--skill") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--skill requires a skill name or all");
      }
      skill = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--skill=")) {
      const value = argument.slice("--skill=".length);
      if (!value) {
        throw new Error("--skill requires a skill name or all");
      }
      skill = value;
      continue;
    }

    if (argument.startsWith("--target=")) {
      const value = argument.slice("--target=".length);
      if (!value) {
        throw new Error("--target requires a directory");
      }
      target = value;
      continue;
    }

    throw new Error(`unknown option: ${argument}`);
  }

  if (agent !== "all" && !Object.hasOwn(agentTargets, agent)) {
    throw new Error(`unknown agent: ${agent}; available agents: copilot, claude, all`);
  }
  if (agent === "all" && target !== undefined) {
    throw new Error("--target cannot be combined with --agent all; install each agent separately to use custom directories");
  }

  return { agent, target, skill, force };
}

function install(args) {
  let options;
  try {
    options = parseInstallOptions(args);
  } catch (error) {
    fail(error.message);
    return;
  }

  const skillsRoot = path.resolve(__dirname, "..", "skills");
  const agents = options.agent === "all" ? Object.keys(agentTargets) : [options.agent];
  const targetRoots = agents.map((agent) =>
    path.resolve(process.cwd(), options.target ?? agentTargets[agent]),
  );

  if (!fs.existsSync(skillsRoot)) {
    fail(`packaged skills not found at ${skillsRoot}`);
    return;
  }

  const availableSkills = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(skillsRoot, entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
  const selectedSkills =
    options.skill === "all" ? availableSkills : [options.skill];
  const installAll = options.skill === "all";

  for (const skill of selectedSkills) {
    if (!availableSkills.includes(skill)) {
      fail(
        `unknown skill: ${skill}; available skills: ${availableSkills.join(", ")}`,
      );
      return;
    }
  }

  const destinations = targetRoots.flatMap((targetRoot) =>
    selectedSkills.map((skill) => ({
      skill,
      targetRoot,
      destination: path.join(targetRoot, skill),
    })),
  );
  const existingDestinations = destinations
    .filter(({ destination }) => fs.existsSync(destination))
    .map(({ destination }) => destination);

  if (existingDestinations.length > 0 && !options.force && !installAll) {
    fail(
      `${existingDestinations.join(", ")} already exists; rerun with --force to replace selected skills`,
    );
    return;
  }

  for (const targetRoot of targetRoots) {
    try {
      fs.mkdirSync(targetRoot, { recursive: true });
    } catch (error) {
      fail(`failed to prepare skill root ${targetRoot}: ${error.message}`);
      return;
    }
  }
  for (const { skill, targetRoot, destination } of destinations) {
    const source = path.join(skillsRoot, skill);
    if (fs.existsSync(destination) && !options.force) {
      console.log(
        `Skipped ${skill} (${destination} already exists; use --force to replace)`,
      );
      continue;
    }

    const temporaryDestination = path.join(
      targetRoot,
      `.kotonoha-${skill}-${process.pid}-${Date.now()}`,
    );
    try {
      fs.cpSync(source, temporaryDestination, {
        recursive: true,
        filter: (sourcePath) => path.basename(sourcePath) !== "node_modules",
      });
      if (options.force) {
        fs.rmSync(destination, { recursive: true, force: true });
      }
      fs.renameSync(temporaryDestination, destination);
    } catch (error) {
      fs.rmSync(temporaryDestination, { recursive: true, force: true });
      fail(`failed to install ${skill}: ${error.message}`);
      return;
    }
    console.log(`Installed ${skill} to ${destination}`);
  }
}

const [command, ...args] = process.argv.slice(2);

if (command === "install") {
  install(args);
} else if (command === "--version" || command === "-v") {
  console.log(packageJson.version);
} else if (command === "--help" || command === "-h" || command === undefined) {
  printUsage();
} else {
  fail(`unknown command: ${command}`);
}
