import { getMongoConnection } from "@school-erp/mongodb";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const rawPlan = process.env.SUBJECT_PLANNING_MIGRATION_JSON
  || (process.env.SUBJECT_PLANNING_MIGRATION_PATH ? await readFile(process.env.SUBJECT_PLANNING_MIGRATION_PATH, "utf8") : undefined);
if (!rawPlan) throw new Error("SUBJECT_PLANNING_MIGRATION_JSON or SUBJECT_PLANNING_MIGRATION_PATH is required; refusing to guess curriculum, academic year, periods, credits, or MIXED components");
const plan = JSON.parse(rawPlan);
if (!plan || typeof plan !== "object" || Array.isArray(plan)) throw new Error("SUBJECT_PLANNING_MIGRATION_JSON must be an object keyed by legacy subject ID");
const apply = process.env.APPLY_MIGRATION === "true";
const connection = await getMongoConnection(process.env);
const db = connection.client.db(process.env.ACADEMICS_MONGODB_DB_NAME || "academics-service_dev");
const collections = Object.fromEntries([
  "academics_subjects", "teaching_assignments", "subject_catalogue", "curriculum_subjects", "subject_components",
  "academic_year_subject_plans", "teaching_groups", "subject_offerings", "teaching_assignments_v2", "academic_responsibilities",
].map((name) => [name, db.collection(name)]));
const report = { mode: apply ? "APPLY" : "DRY_RUN", subjects: 0, catalogue: 0, curriculumSubjects: 0, components: 0, plans: 0, groups: 0, offerings: 0, assignments: 0, responsibilities: 0, deferred: [], errors: [] };
const required = (value, field, subjectId) => { if (value === undefined || value === null || value === "") throw new Error(`${subjectId}: ${field} is required`); return value; };
const id = (prefix, key) => `${prefix}_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
const session = connection.client.startSession();
try {
  const legacySubjects = await collections.academics_subjects.find({ status: "ACTIVE" }).toArray();
  for (const subject of legacySubjects) {
    try {
      const configured = required(plan[subject._id], "migration configuration", subject._id);
      if (configured.decision === "DEFER") {
        report.deferred.push({ subjectId: subject._id, name: subject.name, reason: required(configured.reason, "defer reason", subject._id) });
        continue;
      }
      if (configured.decision !== "MIGRATE") throw new Error(`${subject._id}: decision must be MIGRATE or DEFER`);
      const components = required(configured.components, "components", subject._id);
      if (!Array.isArray(components) || !components.length) throw new Error(`${subject._id}: components must be a non-empty array`);
      if (subject.subjectType === "MIXED" && components.length < 2) throw new Error(`${subject._id}: MIXED subjects require explicit split components`);
      for (const component of components) {
        required(component.componentType, "components.componentType", subject._id);
        required(component.plannedPeriodsPerWeek, "components.plannedPeriodsPerWeek", subject._id);
      }
      if (subject.credits !== undefined && configured.creditsMeaning !== "CREDITS" && configured.creditsMeaning !== "WEEKLY_PERIODS" && configured.creditsMeaning !== "IGNORE") throw new Error(`${subject._id}: creditsMeaning must explicitly classify the legacy credits field`);
      for (const field of ["academicUnitId", "curriculumId", "programId", "academicLevelId", "academicYearId"]) required(configured[field], field, subject._id);
      report.subjects += 1;
      if (!apply) continue;
      await session.withTransaction(async () => {
        const now = new Date(), actor = configured.migratedBy || "system:migration", normalizedName = subject.name.trim().toLowerCase();
        let catalogue = await collections.subject_catalogue.findOne({ tenantId: subject.tenantId, normalizedName }, { session });
        if (!catalogue) {
          const catalogueId = id("subject_catalogue", `${subject.tenantId}:${normalizedName}`);
          catalogue = { _id: catalogueId, id: catalogueId, tenantId: subject.tenantId, code: `SUB-${catalogueId.slice(-6).toUpperCase()}`, name: subject.name, normalizedName, status: "ACTIVE", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1, migrationKey: `legacy-subject:${subject._id}` };
          await collections.subject_catalogue.insertOne(catalogue, { session }); report.catalogue += 1;
        }
        const curriculumNaturalKey = [configured.academicUnitId, configured.curriculumId, configured.programId, configured.academicLevelId, catalogue.id].join("|");
        const existingCurriculum = await collections.curriculum_subjects.findOne({ tenantId: subject.tenantId, naturalKey: curriculumNaturalKey, status: "ACTIVE" }, { session });
        const curriculumSubjectId = existingCurriculum?.id || existingCurriculum?._id || id("curriculum_subject", subject._id);
        if (!existingCurriculum) {
          const curriculumResult = await collections.curriculum_subjects.updateOne({ _id: curriculumSubjectId }, { $setOnInsert: { _id: curriculumSubjectId, id: curriculumSubjectId, tenantId: subject.tenantId, naturalKey: curriculumNaturalKey, academicUnitId: configured.academicUnitId, curriculumId: configured.curriculumId, programId: configured.programId, academicLevelId: configured.academicLevelId, subjectCatalogueId: catalogue.id, subjectCategory: configured.subjectCategory || "CORE", isMandatory: configured.isMandatory !== false, ...(configured.creditsMeaning === "CREDITS" ? { credits: subject.credits } : {}), status: "ACTIVE", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1, migrationKey: `legacy-subject:${subject._id}` } }, { upsert: true, session }); report.curriculumSubjects += curriculumResult.upsertedCount;
        }
        const componentPlans = [];
        for (const component of components) {
          const componentId = id("subject_component", `${subject._id}:${component.componentType}`);
          const componentResult = await collections.subject_components.updateOne({ _id: componentId }, { $setOnInsert: { _id: componentId, id: componentId, tenantId: subject.tenantId, curriculumSubjectId, componentType: component.componentType, baselinePeriodsPerWeek: component.plannedPeriodsPerWeek, workloadMultiplier: component.workloadMultiplier || 1, preferredSessionLength: component.preferredSessionLength || 1, requiresConsecutivePeriods: component.requiresConsecutivePeriods === true, status: "ACTIVE", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1, migrationKey: `legacy-subject:${subject._id}` } }, { upsert: true, session }); report.components += componentResult.upsertedCount;
          componentPlans.push({ subjectComponentId: componentId, plannedPeriodsPerWeek: component.plannedPeriodsPerWeek, preferredSessionLength: component.preferredSessionLength || 1, isOverride: false });
        }
        const planId = id("subject_plan", `${subject._id}:${configured.academicYearId}`);
        const planResult = await collections.academic_year_subject_plans.updateOne({ _id: planId }, { $setOnInsert: { _id: planId, id: planId, tenantId: subject.tenantId, campusId: subject.campusId, academicYearId: configured.academicYearId, academicUnitId: configured.academicUnitId, curriculumId: configured.curriculumId, programId: configured.programId, academicLevelId: configured.academicLevelId, curriculumSubjectId, appliesToAllSections: true, componentPlans, status: "ACTIVE", activatedAt: now, activatedBy: actor, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1, migrationKey: `legacy-subject:${subject._id}` } }, { upsert: true, session }); report.plans += planResult.upsertedCount;
        const legacyAssignments = await collections.teaching_assignments.find({ tenantId: subject.tenantId, subjectId: subject._id, status: "ACTIVE" }, { session }).toArray();
        for (const assignment of legacyAssignments) {
          if (assignment.role === "SECTION_INCHARGE") {
            const responsibilityId = id("academic_responsibility", assignment._id);
            const responsibilityResult = await collections.academic_responsibilities.updateOne({ _id: responsibilityId }, { $setOnInsert: { _id: responsibilityId, id: responsibilityId, tenantId: subject.tenantId, employeeId: assignment.employeeId, academicYearId: assignment.academicYearId, campusId: assignment.campusId, responsibilityType: "SECTION_INCHARGE", programId: assignment.programId, academicLevelId: configured.academicLevelId, sectionId: assignment.sectionId, effectiveFrom: assignment.createdAt || now, status: "ACTIVE", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1, migrationKey: `legacy-assignment:${assignment._id}` } }, { upsert: true, session }); report.responsibilities += responsibilityResult.upsertedCount; continue;
          }
          const groupId = id("teaching_group", `${assignment.academicYearId}:${assignment.sectionId}`);
          const groupResult = await collections.teaching_groups.updateOne({ _id: groupId }, { $setOnInsert: { _id: groupId, id: groupId, tenantId: subject.tenantId, campusId: assignment.campusId, academicYearId: assignment.academicYearId, academicUnitId: configured.academicUnitId, curriculumId: configured.curriculumId, programId: assignment.programId, academicLevelId: configured.academicLevelId, type: "SECTION", name: configured.sectionNames?.[assignment.sectionId] || assignment.sectionId, code: configured.sectionCodes?.[assignment.sectionId] || assignment.sectionId, homeSectionId: assignment.sectionId, effectiveFrom: assignment.createdAt || now, status: "ACTIVE", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1 } }, { upsert: true, session }); report.groups += groupResult.upsertedCount;
          for (const component of components) {
            const componentId = id("subject_component", `${subject._id}:${component.componentType}`), offeringId = id("subject_offering", `${subject._id}:${assignment.sectionId}:${component.componentType}`);
            const offeringResult = await collections.subject_offerings.updateOne({ _id: offeringId }, { $setOnInsert: { _id: offeringId, id: offeringId, tenantId: subject.tenantId, campusId: assignment.campusId, academicYearId: assignment.academicYearId, subjectPlanId: planId, curriculumSubjectId, subjectComponentId: componentId, teachingGroupId: groupId, requiredPeriodsPerWeek: component.plannedPeriodsPerWeek, preferredSessionLength: component.preferredSessionLength || 1, requiresConsecutivePeriods: component.requiresConsecutivePeriods === true, effectiveFrom: assignment.createdAt || now, readinessStatus: "INCOMPLETE", status: "ACTIVE", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1 } }, { upsert: true, session }); report.offerings += offeringResult.upsertedCount;
            const newAssignmentId = id("teaching_assignment", `${assignment._id}:${component.componentType}`);
            const overrideReason = required(configured.assignmentEligibilityOverrideReason, "assignmentEligibilityOverrideReason", subject._id);
            const assignmentResult = await collections.teaching_assignments_v2.updateOne({ _id: newAssignmentId }, { $setOnInsert: { _id: newAssignmentId, id: newAssignmentId, tenantId: subject.tenantId, subjectOfferingId: offeringId, employeeId: assignment.employeeId, assignmentRole: component.componentType === "PRACTICAL" || component.componentType === "LAB" ? "PRACTICAL_INSTRUCTOR" : "PRIMARY", effectiveFrom: assignment.createdAt || now, eligibilityStatus: "OVERRIDDEN", eligibilityOverrideReason: overrideReason, eligibilityOverriddenBy: actor, status: "ACTIVE", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor, version: 1, migrationKey: `legacy-assignment:${assignment._id}` } }, { upsert: true, session }); report.assignments += assignmentResult.upsertedCount;
          }
        }
      });
    } catch (error) { report.errors.push(error instanceof Error ? error.message : String(error)); }
  }
} finally { await session.endSession(); await connection.client.close(); }
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
