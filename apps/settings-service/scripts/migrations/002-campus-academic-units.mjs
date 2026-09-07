import { getMongoConnection } from "@school-erp/mongodb";

const rawPlan = process.env.CAMPUS_ACADEMIC_UNIT_MIGRATION_JSON;
if (!rawPlan) {
  throw new Error(
    "CAMPUS_ACADEMIC_UNIT_MIGRATION_JSON is required; refusing to guess boards or affiliations",
  );
}

const plan = JSON.parse(rawPlan);
if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
  throw new Error("CAMPUS_ACADEMIC_UNIT_MIGRATION_JSON must be an object keyed by campus ID");
}

const connection = await getMongoConnection(process.env);
const settingsDb = connection.client.db(connection.dbName);
const campuses = settingsDb.collection("settings_campuses");
const units = settingsDb.collection("settings_campus_academic_units");

const session = connection.client.startSession();
try {
  await session.withTransaction(async () => {
    for (const [campusId, configuredUnits] of Object.entries(plan)) {
      if (!Array.isArray(configuredUnits) || configuredUnits.length === 0) {
        throw new Error(`at least one academic unit is required for ${campusId}`);
      }
      const campus = await campuses.findOne({ _id: campusId }, { session });
      if (!campus) throw new Error(`campus not found: ${campusId}`);

      for (const configured of configuredUnits) {
        const { name, type, curriculumOrAffiliationId } = configured;
        if (!name || !["SCHOOL", "PU", "DEGREE"].includes(type) || !curriculumOrAffiliationId) {
          throw new Error(`invalid academic unit migration entry for ${campusId}`);
        }
        const unitKey = `${campusId}:${type}:${curriculumOrAffiliationId}`.toLowerCase();
        const existing = await units.findOne({ tenantId: campus.tenantId, unitKey }, { session });
        const academicUnitId = existing?._id ?? `unit_${crypto.randomUUID()}`;
        if (!existing) {
          const timestamp = new Date();
          await units.insertOne(
            {
              _id: academicUnitId,
              id: academicUnitId,
              tenantId: campus.tenantId,
              campusId,
              code: `UNIT-${academicUnitId.slice(-6).toUpperCase()}`,
              name,
              type,
              curriculumOrAffiliationId,
              unitKey,
              status: "ACTIVE",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            { session },
          );
        }
      }
      await campuses.updateOne(
        { _id: campusId },
        { $unset: { campusType: "" }, $set: { updatedAt: new Date() } },
        { session },
      );
    }
  });
} finally {
  await session.endSession();
  await connection.client.close();
}

console.log("Campus academic-unit migration completed");
