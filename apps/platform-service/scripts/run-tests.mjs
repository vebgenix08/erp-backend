import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function collectTestFiles(rootDir) {
  const files = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".test.js")) {
      files.push(resolve(fullPath));
    }
  }
  return files;
}

const testRoot = resolve(".dist-tests");
if (!statSync(testRoot, { throwIfNoEntry: false })) {
  console.error(".dist-tests was not generated.");
  process.exit(1);
}

const files = collectTestFiles(testRoot);
if (files.length === 0) {
  console.error("No compiled tenant tests were found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
