import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

async function collectTests(dir, results = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectTests(resolved, results);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) results.push(resolved);
  }
  return results;
}

const tests = await collectTests(path.resolve(process.cwd(), ".dist-tests"));
if (tests.length === 0) process.exit(0);

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--test", ...tests], { stdio: "inherit" });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Tests exited with code ${code ?? 1}`)));
  child.on("error", reject);
});
