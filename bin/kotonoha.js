#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const packageJson = require("../package.json");

function printUsage() {
  console.log(`Usage:
  kotonoha install [--target <directory>] [--force]

Options:
  --target <directory>  Skill directory root (default: .github/skills)
  --force               Replace an existing tech-writer installation
  --help                 Show this help
  --version              Show the installed kotonoha version`);
}

function fail(message) {
  console.error(`kotonoha: ${message}`);
  process.exitCode = 1;
}

function parseInstallOptions(args) {
  let target = ".github/skills";
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

  return { target, force };
}

function install(args) {
  let options;
  try {
    options = parseInstallOptions(args);
  } catch (error) {
    fail(error.message);
    return;
  }

  const source = path.resolve(__dirname, "..", "skills", "tech-writer");
  const targetRoot = path.resolve(process.cwd(), options.target);
  const destination = path.join(targetRoot, "tech-writer");

  if (!fs.existsSync(source)) {
    fail(`packaged skill not found at ${source}`);
    return;
  }

  if (fs.existsSync(destination)) {
    if (!options.force) {
      fail(
        `${destination} already exists; rerun with --force to replace it`,
      );
      return;
    }
    fs.rmSync(destination, { recursive: true, force: true });
  }

  fs.mkdirSync(targetRoot, { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
  console.log(`Installed tech-writer to ${destination}`);
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
