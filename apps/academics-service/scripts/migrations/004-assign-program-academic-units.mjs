import { readFile } from "node:fs/promises";
import { getMongoConnection } from "@school-erp/mongodb";

const rawPlan =
  process.env.PROGRAM_ACADEMIC_UNIT_MIGRATION_JSON ||
  (process.env.PROGRAM_ACADEMIC_UNIT_MIGRATION_PATH
    ? await readFile(process.env.PROGRAM_ACADEMIC_UNIT_MIGRATION_PATH, "utf8")
    : undefined);
if (!rawPlan) {
  throw new Error(
    "PROGRAM_ACADEMIC_UNIT_MIGRATION_JSON or PROGRAM_ACADEMIC_UNIT_MIGRATION_PATH is required",
  );
}
const plan = JSON.parse(rawPlan);
if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
  throw new Error("program academic-unit migration plan must be keyed by programId");
}

const apply = process.env.APPLY_MIGRATION === "true";
const connection = await getMongoConnection(process.env);
try {
  const programs = connection.client.db(connection.dbName).collection("academics_programs");
  const report = { mode: apply ? "APPLY" : "DRY_RUN", matched: 0, updated: 0, missing: [] };
  for (const [programId, academicUnitId] of Object.entries(plan)) {
    if (typeof academicUnitId !== "string" || !academicUnitId.trim()) {
      throw new Error(`academicUnitId is required for ${programId}`);
    }
    const program = await programs.findOne({ _id: programId });
    if (!program) {
      report.missing.push(programId);
      continue;
    }
    report.matched += 1;
    if (apply) {
      const result = await programs.updateOne(
        { _id: programId, tenantId: program.tenantId },
        { $set: { academicUnitId: academicUnitId.trim(), updatedAt: new Date() } },
      );
      report.updated += result.modifiedCount;
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.missing.length) process.exitCode = 2;
} finally {
  await connection.client.close();
}
