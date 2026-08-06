import { getMongoConnection } from "@school-erp/mongodb";

const apply = process.env.APPLY_MIGRATION === "true";
const collisionResolutionIds = new Set((process.env.DEACTIVATE_COLLISION_ENTRY_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
const connection = await getMongoConnection(process.env);
const db = connection.client.db(process.env.ACADEMICS_MONGODB_DB_NAME || "academics-service_dev");
const versions = db.collection("timetable_versions");
const entries = db.collection("timetable_entries");
const assignments = db.collection("teaching_assignments_v2");
const offerings = db.collection("subject_offerings");
const curriculumSubjects = db.collection("curriculum_subjects");
const subjectCatalogue = db.collection("subject_catalogue");
const report = { mode: apply ? "APPLY" : "DRY_RUN", drafts: 0, entries: 0, repairedAssignments: 0, resolvedCollisions: [], missingAssignments: [], collisions: [] };

try {
  const drafts = await versions.find({ status: "DRAFT" }).project({ _id: 1, id: 1, tenantId: 1 }).toArray();
  report.drafts = drafts.length;
  for (const draft of drafts) {
    const timetableVersionId = String(draft.id || draft._id);
    const tenantId = String(draft.tenantId);
    const activeEntries = await entries.find({ tenantId, timetableVersionId, status: "ACTIVE" }).toArray();
    report.entries += activeEntries.length;
    const occupied = new Map();
    for (const entry of activeEntries) {
      const target = entry.sectionId ? `SECTION:${entry.sectionId}` : entry.subjectBatchId ? `BATCH:${entry.subjectBatchId}` : `GROUP:${entry.teachingGroupId}`;
      for (const periodSlotId of Array.isArray(entry.periodSlotIds) ? entry.periodSlotIds : []) {
        const key = `${entry.dayOfWeek}|${periodSlotId}|${target}`;
        const previous = occupied.get(key);
        const current = { entryId: String(entry.id || entry._id), subjectOfferingId: String(entry.subjectOfferingId) };
        if (previous) report.collisions.push({ tenantId, timetableVersionId, dayOfWeek: entry.dayOfWeek, periodSlotId, target, entries: [previous, current] });
        else occupied.set(key, current);
      }
      const current = await assignments.find({ tenantId, subjectOfferingId: entry.subjectOfferingId, status: "ACTIVE" }).sort({ assignmentRole: 1, createdAt: 1, id: 1 }).project({ _id: 1, id: 1 }).toArray();
      const currentIds = current.map((item) => String(item.id || item._id));
      if (!currentIds.length) {
        report.missingAssignments.push({ tenantId, timetableVersionId, entryId: String(entry.id || entry._id), subjectOfferingId: String(entry.subjectOfferingId) });
        continue;
      }
      const storedIds = Array.isArray(entry.teachingAssignmentIds) ? entry.teachingAssignmentIds.map(String).sort() : [];
      if (JSON.stringify(storedIds) === JSON.stringify([...currentIds].sort())) continue;
      report.repairedAssignments += 1;
      if (apply) await entries.updateOne(
        { _id: entry._id, tenantId, timetableVersionId, status: "ACTIVE" },
        { $set: { teachingAssignmentIds: currentIds, updatedAt: new Date(), updatedBy: "system:draft-timetable-reconciliation" }, $inc: { version: 1 } },
      );
    }
  }
  for (const collision of report.collisions) {
    for (const entry of collision.entries) {
      const offering = await offerings.findOne({ tenantId: collision.tenantId, id: entry.subjectOfferingId });
      const curriculum = offering ? await curriculumSubjects.findOne({ tenantId: collision.tenantId, id: offering.curriculumSubjectId }) : null;
      const subject = curriculum ? await subjectCatalogue.findOne({ tenantId: collision.tenantId, id: curriculum.subjectCatalogueId }) : null;
      entry.subjectName = subject?.name || "Unknown subject";
    }
  }
  if (apply && collisionResolutionIds.size) {
    const participants = new Map(report.collisions.flatMap((collision) => collision.entries.map((entry) => [entry.entryId, { collision, entry }])));
    for (const entryId of collisionResolutionIds) {
      const participant = participants.get(entryId);
      if (!participant) throw new Error(`${entryId} is not part of a detected draft timetable collision`);
      const result = await entries.updateOne(
        { tenantId: participant.collision.tenantId, id: entryId, timetableVersionId: participant.collision.timetableVersionId, status: "ACTIVE" },
        { $set: { status: "INACTIVE", deactivatedAt: new Date(), deactivatedBy: "system:draft-timetable-reconciliation", deactivationReason: "Resolved duplicate section period during draft timetable reconciliation", updatedAt: new Date(), updatedBy: "system:draft-timetable-reconciliation" }, $inc: { version: 1 } },
      );
      if (result.modifiedCount !== 1) throw new Error(`${entryId} could not be deactivated`);
      report.resolvedCollisions.push({ entryId, subjectName: participant.entry.subjectName });
    }
    report.collisions = report.collisions.filter((collision) => !collision.entries.some((entry) => collisionResolutionIds.has(entry.entryId)));
  }
} finally {
  await connection.client.close();
}

console.log(JSON.stringify(report, null, 2));
if (report.collisions.length || report.missingAssignments.length) process.exitCode = 2;
