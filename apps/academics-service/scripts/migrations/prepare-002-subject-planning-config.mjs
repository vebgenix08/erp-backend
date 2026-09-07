import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getMongoConnection } from "@school-erp/mongodb";

const connection = await getMongoConnection(process.env);
const academics = connection.client.db(connection.dbName);
const rawReferences =
  process.env.SUBJECT_PLANNING_REFERENCE_JSON ||
  (process.env.SUBJECT_PLANNING_REFERENCE_PATH
    ? await readFile(process.env.SUBJECT_PLANNING_REFERENCE_PATH, "utf8")
    : undefined);
if (!rawReferences) {
  throw new Error("SUBJECT_PLANNING_REFERENCE_JSON or SUBJECT_PLANNING_REFERENCE_PATH is required");
}
const references = JSON.parse(rawReferences);
if (!Array.isArray(references.academicUnits) || !Array.isArray(references.academicYears)) {
  throw new Error("subject-planning references require academicUnits and academicYears arrays");
}
const output = resolve(
  process.env.SUBJECT_PLANNING_CONFIG_PATH || "scripts/migrations/output/dev-subject-planning.json",
);
try {
  const [subjects, programs, sections] = await Promise.all([
    academics.collection("academics_subjects").find({ status: "ACTIVE" }).toArray(),
    academics.collection("academics_programs").find({ status: "ACTIVE" }).toArray(),
    academics.collection("academics_sections").find({ status: "ACTIVE" }).toArray(),
  ]);
  const units = references.academicUnits;
  const years = references.academicYears;
  const programById = new Map(programs.map((item) => [item._id, item]));
  const unitById = new Map(units.map((item) => [item._id, item]));
  const yearByTenant = new Map(years.map((item) => [item.tenantId, item]));
  const sectionNames = Object.fromEntries(sections.map((item) => [item._id, item.name]));
  const sectionCodes = Object.fromEntries(sections.map((item) => [item._id, item.code]));
  const config = {};
  for (const subject of subjects) {
    const program = programById.get(subject.programId),
      unit = unitById.get(program?.academicUnitId),
      year = yearByTenant.get(subject.tenantId);
    const reason =
      !program || !unit || !year
        ? "Academic hierarchy or active academic year could not be resolved"
        : subject.subjectType === "MIXED"
          ? "MIXED delivery requires a human-approved theory/practical split"
          : typeof subject.credits !== "number" ||
              !Number.isFinite(subject.credits) ||
              subject.credits < 1
            ? "Legacy delivery value is missing and weekly periods cannot be inferred"
            : null;
    if (reason) {
      config[subject._id] = { decision: "DEFER", reason };
      continue;
    }
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
      assignmentEligibilityOverrideReason:
        "Legacy teaching assignment preserved; subject eligibility requires tenant-admin verification",
      components: [
        {
          componentType: "THEORY",
          plannedPeriodsPerWeek: subject.credits,
          workloadMultiplier: 1,
          preferredSessionLength: 1,
        },
      ],
      sectionNames,
      sectionCodes,
      migratedBy: "system:migration-002",
    };
  }
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const decisions = Object.values(config);
  console.log(
    JSON.stringify(
      {
        output,
        total: decisions.length,
        migrate: decisions.filter((item) => item.decision === "MIGRATE").length,
        defer: decisions.filter((item) => item.decision === "DEFER").length,
      },
      null,
      2,
    ),
  );
} finally {
  await connection.client.close();
}
