import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

async function collectTests(dir, results = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectTests(resolved, results);
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      results.push(resolved);
    }
  }
  return results;
}

const testsDir = path.resolve(process.cwd(), ".dist-tests");
const tests = await collectTests(testsDir);

if (tests.length === 0) {
  console.log("No compiled storage-service tests found.");
  process.exit(0);
}

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--test", ...tests], {
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Test process exited with code ${code ?? 1}`));
  });
  child.on("error", reject);
});
