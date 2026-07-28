import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryAccessRepository } from "../../access/access.repository";
import { createRole, listRoles } from "../../roles/roles.service";
import { InMemoryUserRepository, type UserRepository } from "../../users/users.repository";
import { InMemoryEmployeeInviteAttemptRepository } from "../employee-invite-attempts.repository";
import type { StaffIdentityGateway } from "../employees.model";
import { InMemoryEmployeeRepository } from "../employees.repository";
import { createEmployee, listEmployees, resendEmployeeInvite } from "../employees.service";

function context(): RequestContext {
  return {
    requestId: "req", path: "graphql", method: "POST", headers: {}, query: {}, body: {}, params: {},
    tenantContext: { tenantId: "employee-test-tenant", source: "request", resolvedAt: new Date() },
    authContext: { source: "request", authenticatedAt: new Date(), user: { id: "admin", email: "admin@example.com", role: "TENANT_ADMIN", source: "request", permissions: ["identity.employee.read", "identity.employee.create", "identity.employee.invite"] } },
  } as RequestContext;
}
const base = { fullName: "Ananya Rao", email: "ananya.rao@example.com", staffCategory: "TEACHING", staffType: "TEACHER", employmentType: "FULL_TIME", primaryCampusId: "campus-main", campusIds: ["campus-main"], joiningDate: "2026-07-21", loginEnabled: false, roleIds: [], scopeType: "CAMPUS" };

test("employee can be created without ERP login", async () => {
  const repository = new InMemoryEmployeeRepository();
  const result = await createEmployee(base, context(), { repository });
  assert.equal(result.employeeCode, "EMP-000001");
  assert.equal(result.loginStatus, "NONE");
  assert.equal((await listEmployees(context(), { repository })).length, 1);
});

test("invite failure preserves employee for recovery", async () => {
  const repository = new InMemoryEmployeeRepository();
  const role = await createRole(context().tenantContext, { code: "TEACHER", name: "Teacher" });
  const gateway: StaffIdentityGateway = { invite: async () => { throw new Error("provider unavailable"); }, resend: async () => {}, get: async()=>({username:"user"}), disable: async () => {} };
  const result = await createEmployee({ ...base, loginEnabled: true, roleIds: [role!.id] }, context(), { repository, identityGateway: gateway, accessRepository: new InMemoryAccessRepository() });
  assert.equal(result.loginStatus, "FAILED");
  assert.equal((await listEmployees(context(), { repository })).length, 1);
});

test("failed staff invite can be resent", async () => {
  const repository = new InMemoryEmployeeRepository();
  const role = (await listRoles(context().tenantContext)).find((item) => item?.code === "ACCOUNTANT");
  let fail = true;
  const gateway: StaffIdentityGateway = { invite: async () => { if (fail) throw new Error("temporary"); return { username: "user" }; }, resend: async () => { fail = false; }, get:async()=>({username:"user"}), disable: async () => {} };
  const failed = await createEmployee({ ...base, email: "finance@example.com", staffCategory: "NON_TEACHING", staffType: "ADMIN_STAFF", loginEnabled: true, roleIds: [role!.id] }, context(), { repository, identityGateway: gateway, accessRepository: new InMemoryAccessRepository() });
  const resent = await resendEmployeeInvite(failed.id, context(), { repository, identityGateway: gateway, inviteRetryCooldownMs: 0 });
  assert.equal(resent.loginStatus, "INVITED");
  assert.equal(resent.inviteAttempts, 2);
});

test("resend refuses a Cognito identity owned by another tenant", async () => {
  const repository = new InMemoryEmployeeRepository();
  const role = (await listRoles(context().tenantContext)).find((item) => item?.code === "TEACHER")!;
  const gateway: StaffIdentityGateway = {
    invite: async () => { throw new Error("User account already exists"); },
    get: async () => ({ username: "shared@example.com", tenantId: "another-tenant", roleCode: "TEACHER" }),
    resend: async () => { throw new Error("resend must not be called"); },
    disable: async () => {},
  };
  const failed = await createEmployee(
    { ...base, email: "shared@example.com", loginEnabled: true, roleIds: [role.id] },
    context(),
    { repository, identityGateway: gateway, accessRepository: new InMemoryAccessRepository() },
  );

  const retried = await resendEmployeeInvite(failed.id, context(), {
    repository,
    identityGateway: gateway,
    accessRepository: new InMemoryAccessRepository(),
    inviteRetryCooldownMs: 0,
  });

  assert.equal(retried.loginStatus, "FAILED");
  assert.match(retried.inviteError ?? "", /another tenant/i);
});

test("retry reconciles Cognito success after ERP identity write failure", async () => {
  const repository = new InMemoryEmployeeRepository();
  const accessRepository = new InMemoryAccessRepository();
  const inviteAttemptRepository = new InMemoryEmployeeInviteAttemptRepository();
  const realUsers = new InMemoryUserRepository();
  let failCreate = true;
  const users: UserRepository = {
    list: (...args) => realUsers.list(...args),
    getById: (...args) => realUsers.getById(...args),
    getByEmail: (...args) => realUsers.getByEmail(...args),
    getByAuthUserId: (...args) => realUsers.getByAuthUserId(...args),
    create: async (...args) => {
      if (failCreate) { failCreate = false; throw new Error("temporary database write failure"); }
      return realUsers.create(...args);
    },
    update: (...args) => realUsers.update(...args),
    delete: (...args) => realUsers.delete(...args),
  };
  const role = (await listRoles(context().tenantContext)).find((item) => item?.code === "TEACHER")!;
  const gateway: StaffIdentityGateway = {
    invite: async () => ({ username: "cognito-teacher", subject: "cognito-subject" }),
    get: async () => ({ username: "cognito-teacher", subject: "cognito-subject" }),
    resend: async () => {},
    disable: async () => {},
  };
  const failed = await createEmployee({ ...base, loginEnabled: true, roleIds: [role.id] }, context(), {
    repository, accessRepository, inviteAttemptRepository, identityGateway: gateway, userRepository: users,
  });
  assert.equal(failed.loginStatus, "FAILED");

  const recovered = await resendEmployeeInvite(failed.id, context(), {
    repository, accessRepository, inviteAttemptRepository, identityGateway: gateway, userRepository: users,
    inviteRetryCooldownMs: 0,
  });
  assert.equal(recovered.loginStatus, "INVITED");
  assert.ok(recovered.userId);
  assert.equal((await realUsers.list("employee-test-tenant")).length, 1);
  assert.equal((await accessRepository.listAssignments("employee-test-tenant")).length, 1);
  assert.equal((await inviteAttemptRepository.list("employee-test-tenant", failed.id)).length, 2);
});
