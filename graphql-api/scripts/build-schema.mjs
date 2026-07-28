import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["schema/root.graphql", "schema/modules/identity.graphql", "schema/modules/admissions.graphql", "schema/modules/settings.graphql", "schema/modules/academics.graphql", "schema/modules/finance.graphql", "schema/modules/platform.graphql"];
const chunks = await Promise.all(sources.map((file) => readFile(path.join(root, file), "utf8")));
const schema = `${chunks.join("\n\n").trim()}\n`;

for (const required of ["type Query", "type Mutation", "schema {"]) {
  if (!schema.includes(required)) throw new Error(`GraphQL schema is missing ${required}`);
}

if (!process.argv.includes("--check")) {
  await mkdir(path.join(root, "generated"), { recursive: true });
  await writeFile(path.join(root, "generated/schema.graphql"), schema, "utf8");
}
