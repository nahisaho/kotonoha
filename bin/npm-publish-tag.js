"use strict";

function publishTagForVersion(version) {
  return version.includes("-") ? "next" : "latest";
}

if (require.main === module) {
  const { version } = require("../package.json");
  process.stdout.write(`${publishTagForVersion(version)}\n`);
}

module.exports = { publishTagForVersion };
