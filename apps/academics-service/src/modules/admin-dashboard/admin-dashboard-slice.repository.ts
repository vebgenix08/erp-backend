import { createTenantMongoCollection, getMongoConnection } from "@school-erp/mongodb";

interface TenantDocument {
  _id: string;
  tenantId: string;
  [key: string]: unknown;
}

export interface DashboardScopeInput {
  campusId: string;
  academicYearId: string;
  from: string;
  to: string;
}

export async function readAcademicsDashboardSlice(tenantId: string, scope: DashboardScopeInput) {
  const connection = await getMongoConnection();
  const db = connection.client.db(connection.dbName);
  const enrollments = createTenantMongoCollection(
    db.collection<TenantDocument>("academics_enrollments"),
  );
  const classes = createTenantMongoCollection(db.collection<TenantDocument>("academics_classes"));
  const match = {
    tenantId,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
    status: "ACTIVE",
  };
  const [activeStudents, missingSections, studentIds, classRows] = await Promise.all([
    enrollments.countDocuments(match),
    enrollments.countDocuments({
      ...match,
      $or: [{ sectionId: { $exists: false } }, { sectionId: null }, { sectionId: "" }],
    }),
    enrollments.distinct("studentId", match),
    enrollments
      .aggregate<{ _id: string | null; count: number }>([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: ["$classId", null] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray(),
  ]);
  const classIds = classRows
    .map((row) => row._id)
    .filter((value): value is string => Boolean(value));
  const classDocuments = classIds.length
    ? await classes
        .find({
          tenantId,
          $or: [{ _id: { $in: classIds } }, { id: { $in: classIds } }],
        })
        .toArray()
    : [];
  const classNames = Object.fromEntries(
    classDocuments.map((item) => [
      String(item.id ?? item._id),
      String(item.name ?? "Unknown class"),
    ]),
  );
  return {
    activeStudents,
    studentsMissingSections: missingSections,
    enrolledStudentIds: studentIds.map(String),
    classNames,
    studentClassDistribution: classRows.map((row) => ({
      key: row._id ?? "UNASSIGNED",
      label: row._id ? (classNames[row._id] ?? "Unknown class") : "Unassigned",
      count: row.count,
    })),
  };
}
