import { getMongoConnection } from "@school-erp/mongodb";

const connection = await getMongoConnection(process.env);
const db = connection.client.db(connection.dbName);

const commonCollections = [
  "curriculum_subjects",
  "subject_components",
  "academic_year_subject_plans",
  "academics_classes",
  "academics_sections",
  "section_subject_exceptions",
  "subject_choice_groups",
  "student_subject_choices",
  "teaching_groups",
  "teaching_group_memberships",
  "subject_batches",
  "subject_batch_memberships",
  "subject_offerings",
  "parallel_timetable_blocks",
  "employee_campus_assignments",
  "teacher_subject_eligibility",
  "teaching_assignments_v2",
  "academic_responsibilities",
  "teacher_availability",
  "teacher_workload_policies",
  "rooms",
  "campus_travel_rules",
  "timetable_period_sets",
  "timetable_period_slots",
  "timetable_versions",
  "timetable_entries",
  "timetable_constraints",
  "timetable_validation_runs",
  "timetable_conflicts",
  "timetable_day_patterns",
  "timetable_temporary_overrides",
  "timetable_generation_runs",
  "attendance_sessions",
  "assessment_definitions",
  "marks_sheets",
];

const workloadIndexes = [
  ["timetable_versions", { tenantId: 1, academicYearId: 1, status: 1, updatedAt: -1 }],
  ["teaching_assignments_v2", { tenantId: 1, employeeId: 1, status: 1, academicYearId: 1 }],
  ["subject_offerings", { tenantId: 1, academicYearId: 1, status: 1 }],
  ["teacher_availability", { tenantId: 1, employeeId: 1, academicYearId: 1, status: 1 }],
  ["employee_campus_assignments", { tenantId: 1, employeeId: 1, status: 1 }],
  ["academic_responsibilities", { tenantId: 1, employeeId: 1, academicYearId: 1, status: 1 }],
  ["subject_batches", { tenantId: 1, academicYearId: 1, status: 1 }],
  ["timetable_entries", { tenantId: 1, status: 1, timetableVersionId: 1 }],
  ["timetable_period_slots", { tenantId: 1, status: 1, periodSetId: 1, sequence: 1 }],
];

try {
  for (const name of commonCollections) {
    const collection = db.collection(name);
    await collection.createIndex({ tenantId: 1, status: 1 });
    await collection.createIndex({ tenantId: 1, updatedAt: -1 });
  }
  for (const [name, keys] of workloadIndexes) {
    await db.collection(name).createIndex(keys);
  }
  console.log(
    JSON.stringify({
      commonCollections: commonCollections.length,
      workloadIndexes: workloadIndexes.length,
    }),
  );
} finally {
  await connection.client.close();
}
