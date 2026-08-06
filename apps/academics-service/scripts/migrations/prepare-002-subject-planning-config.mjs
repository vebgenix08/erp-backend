import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getMongoConnection } from "@school-erp/mongodb";

const connection = await getMongoConnection(process.env);
const academics = connection.client.db(process.env.ACADEMICS_MONGODB_DB_NAME || "academics-service_dev");
const settings = connection.client.db(process.env.SETTINGS_MONGODB_DB_NAME || "settings-service_dev");
const output = resolve(process.env.SUBJECT_PLANNING_CONFIG_PATH || "scripts/migrations/output/dev-subject-planning.json");
try {
  const [subjects, programs, units, years, sections] = await Promise.all([
    academics.collection("academics_subjects").find({ status: "ACTIVE" }).toArray(),
    academics.collection("academics_programs").find({ status: "ACTIVE" }).toArray(),
    settings.collection("settings_campus_academic_units").find({ status: "ACTIVE" }).toArray(),
    settings.collection("settings_academic_years").find({ status: "ACTIVE" }).toArray(),
    academics.collection("academics_sections").find({ status: "ACTIVE" }).toArray(),
  ]);
  const programById = new Map(programs.map((item) => [item._id, item]));
  const unitById = new Map(units.map((item) => [item._id, item]));
  const yearByTenant = new Map(years.map((item) => [item.tenantId, item]));
  const sectionNames = Object.fromEntries(sections.map((item) => [item._id, item.name]));
  const sectionCodes = Object.fromEntries(sections.map((item) => [item._id, item.code]));
  const config = {};
  for (const subject of subjects) {
    const program = programById.get(subject.programId), unit = unitById.get(program?.academicUnitId), year = yearByTenant.get(subject.tenantId);
    const reason = !program || !unit || !year
      ? "Academic hierarchy or active academic year could not be resolved"
      : subject.subjectType === "MIXED"
        ? "MIXED delivery requires a human-approved theory/practical split"
        : typeof subject.credits !== "number" || !Number.isFinite(subject.credits) || subject.credits < 1
          ? "Legacy delivery value is missing and weekly periods cannot be inferred"
          : null;
    if (reason) { config[subject._id] = { decision: "DEFER", reason }; continue; }
    config[subject._id] = {
      decision: "MIGRATE",
      academicUnitId: program.academicUnitId,
      curriculumId: unit.curriculumOrAffiliationId,
      programId: subject.programId,
      academicLevelId: subject.classId,
      academicYearId: year._id,
      creditsMeaning: "WEEKLY_PERIODS",
      subjectCategory: "CORE",
      isMandatory: true,
      assignmentEligibilityOverrideReason: "Legacy teaching assignment preserved; subject eligibility requires tenant-admin verification",
      components: [{ componentType: "THEORY", plannedPeriodsPerWeek: subject.credits, workloadMultiplier: 1, preferredSessionLength: 1 }],
      sectionNames,
      sectionCodes,
      migratedBy: "system:migration-002",
    };
  }
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const decisions = Object.values(config);
  console.log(JSON.stringify({ output, total: decisions.length, migrate: decisions.filter((item) => item.decision === "MIGRATE").length, defer: decisions.filter((item) => item.decision === "DEFER").length }, null, 2));
} finally {
  await connection.client.close();
}
