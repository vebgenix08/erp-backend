import { createTenantMongoCollection, getMongoConnection } from "@school-erp/mongodb";

interface TenantDocument {
  _id: string;
  tenantId: string;
  [key: string]: unknown;
}

interface Scope {
  campusId: string;
  academicYearId: string;
  from: string;
  to: string;
}

export async function readIdentityDashboardSlice(tenantId: string, scope: Scope) {
  const connection = await getMongoConnection();
  const db = connection.client.db(connection.dbName);
  const employees = createTenantMongoCollection(
    db.collection<TenantDocument>("identity_employees"),
  );
  const assignments = createTenantMongoCollection(
    db.collection<TenantDocument>("identity_user_role_assignments"),
  );
  const bindings = createTenantMongoCollection(
    db.collection<TenantDocument>("identity_role_permissions"),
  );
  const users = createTenantMongoCollection(db.collection<TenantDocument>("identity_users"));
  const [activeStaff, failedStaffInvites, recentAssignments, recentBindings] = await Promise.all([
    employees.countDocuments({
      tenantId,
      status: "ACTIVE",
      campusIds: scope.campusId,
    }),
    employees.countDocuments({
      tenantId,
      campusIds: scope.campusId,
      loginStatus: "FAILED",
    }),
    assignments.find({ tenantId }).sort({ updatedAt: -1 }).limit(5).toArray(),
    bindings.find({ tenantId }).sort({ updatedAt: -1 }).limit(5).toArray(),
  ]);
  const userIds = recentAssignments
    .map((item) => item.userId)
    .filter((value): value is string => typeof value === "string" && Boolean(value));
  const userRows = userIds.length
    ? await users.find({ tenantId, id: { $in: userIds } }).toArray()
    : [];
  const labels = new Map(
    userRows.map((user) => [String(user.id), String(user.name ?? user.email ?? "Tenant user")]),
  );
  const recentSecurityChanges = [
    ...recentAssignments.map((item) => ({
      id: String(item.id ?? item._id),
      change: item.isActive === false ? "Role assignment revoked" : "Role assignment updated",
      subject: labels.get(String(item.userId)) ?? "Tenant user",
      occurredAt: new Date(item.updatedAt as Date),
      status: item.isActive === false ? "REVOKED" : "ACTIVE",
    })),
    ...recentBindings.map((item) => ({
      id: String(item.id ?? item._id),
      change: "Role permission updated",
      subject: String(item.permission ?? "Permission"),
      occurredAt: new Date(item.updatedAt as Date),
      status: "ACTIVE",
    })),
  ]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, 5);
  return { activeStaff, failedStaffInvites, recentSecurityChanges };
}
