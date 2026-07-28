import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const directory = path.resolve(process.cwd(), ".dist-tests", "tests");
const files = (await readdir(directory)).filter((file) => file.endsWith(".test.js")).map((file) => path.join(directory, file));
if (!files.length) throw new Error("No cognito-sync tests found");
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--test", ...files], { stdio: "inherit" });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Tests exited with ${code ?? 1}`)));
  child.on("error", reject);
});
