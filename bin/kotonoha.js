#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const packageJson = require("../package.json");

function printUsage() {
  console.log(`Usage:
  kotonoha install [--target <directory>] [--skill <name|all>] [--force]

Options:
  --target <directory>  Skill directory root (default: .github/skills)
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
  let target = ".github/skills";
  let skill = "all";
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--force") {
      force = true;
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

  return { target, skill, force };
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
  const targetRoot = path.resolve(process.cwd(), options.target);

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

  const existingDestinations = selectedSkills
    .map((skill) => path.join(targetRoot, skill))
    .filter((destination) => fs.existsSync(destination));

  if (existingDestinations.length > 0 && !options.force && !installAll) {
    fail(
      `${existingDestinations.join(", ")} already exists; rerun with --force to replace selected skills`,
    );
    return;
  }

  fs.mkdirSync(targetRoot, { recursive: true });
  for (const skill of selectedSkills) {
    const source = path.join(skillsRoot, skill);
    const destination = path.join(targetRoot, skill);
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
      fs.cpSync(source, temporaryDestination, { recursive: true });
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
