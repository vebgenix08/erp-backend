import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryAccessRepository } from "../../access/access.repository";
import { createRole, listRoles } from "../../roles/roles.service";
import { InMemoryUserRepository, type UserRepository } from "../../users/users.repository";
import { InMemoryEmployeeInviteAttemptRepository } from "../employee-invite-attempts.repository";
import type { StaffIdentityGateway } from "../employees.model";
import { InMemoryEmployeeRepository } from "../employees.repository";
import { createEmployee, deactivateEmployee, endEmployment, listEmployeePage, listEmployees, reactivateEmployee, resendEmployeeInvite, updateEmployee } from "../employees.service";

function context(): RequestContext {
  return {
    requestId: "req", path: "graphql", method: "POST", headers: {}, query: {}, body: {}, params: {},
    tenantContext: { tenantId: "employee-test-tenant", source: "request", resolvedAt: new Date() },
    authContext: { source: "request", authenticatedAt: new Date(), user: { id: "admin", email: "admin@example.com", role: "TENANT_ADMIN", source: "request", permissions: ["identity.employee.read", "identity.employee.create", "identity.employee.update", "identity.employee.invite", "identity.employee.end"] } },
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

test("employee profile and employment details can be updated", async () => {
  const repository = new InMemoryEmployeeRepository();
  const created = await createEmployee(base, context(), { repository });
  const updated = await updateEmployee(created.id, {
    fullName: "Ananya R. Rao",
    phone: "+91 98765 43210",
    employmentType: "PART_TIME",
    designation: "Senior Mathematics Teacher",
    department: "Mathematics",
    primaryCampusId: "campus-east",
    campusIds: ["campus-main", "campus-east"],
    joiningDate: "2026-06-15T00:00:00.000Z",
    profilePhotoFileId: "file_employee_portrait",
  }, context(), { repository });
  assert.equal(updated.fullName, "Ananya R. Rao");
  assert.equal(updated.employmentType, "PART_TIME");
  assert.equal(updated.primaryCampusId, "campus-east");
  assert.deepEqual(updated.campusIds, ["campus-main", "campus-east"]);
  assert.equal(updated.joiningDate, "2026-06-15T00:00:00.000Z");
  assert.equal(updated.profilePhotoFileId, "file_employee_portrait");
});

test("employee directory applies filters and pagination in the repository",async()=>{const repository=new InMemoryEmployeeRepository();for(let index=0;index<5;index+=1)await createEmployee({...base,email:`teacher${index}@example.com`,fullName:`Teacher ${String(index+1).padStart(2,"0")}`},context(),{repository});const page=await listEmployeePage(context(),{repository},{campusId:"campus-main",status:"ACTIVE",page:2,pageSize:2,sortBy:"fullName",sortDirection:"ASC"});assert.equal(page.total,5);assert.equal(page.totalPages,3);assert.equal(page.items[0]?.fullName,"Teacher 03");assert.equal(page.summary.teaching,5);});

test("employee can be deactivated and reactivated with Cognito login state",async()=>{const repository=new InMemoryEmployeeRepository();const created=await createEmployee(base,context(),{repository});await repository.update("employee-test-tenant",created.id,{loginStatus:"ACTIVE",email:"ananya.rao@example.com"});let disabled=false,enabled=false;const gateway:StaffIdentityGateway={invite:async()=>({username:"staff"}),resend:async()=>{},get:async()=>({username:"staff"}),disable:async()=>{disabled=true;},enable:async()=>{enabled=true;}};const inactive=await deactivateEmployee(created.id,context(),{repository,identityGateway:gateway});assert.equal(inactive.status,"INACTIVE");assert.equal(inactive.loginStatus,"DISABLED");assert.equal(disabled,true);const active=await reactivateEmployee(created.id,context(),{repository,identityGateway:gateway});assert.equal(active.status,"ACTIVE");assert.equal(active.loginStatus,"ACTIVE");assert.equal(enabled,true);});
test("employment termination disables login and cannot be reactivated",async()=>{const repository=new InMemoryEmployeeRepository();const created=await createEmployee(base,context(),{repository});await repository.update("employee-test-tenant",created.id,{loginStatus:"ACTIVE",email:"ananya.rao@example.com"});let disabled=false;const gateway:StaffIdentityGateway={invite:async()=>({username:"staff"}),resend:async()=>{},get:async()=>({username:"staff"}),disable:async()=>{disabled=true;},enable:async()=>{}};const ended=await endEmployment(created.id,"Employment contract completed",context(),{repository,identityGateway:gateway});assert.equal(ended.status,"ENDED");assert.equal(ended.loginStatus,"DISABLED");assert.equal(ended.endReason,"Employment contract completed");assert.equal(disabled,true);await assert.rejects(()=>reactivateEmployee(created.id,context(),{repository,identityGateway:gateway}),/ended employment/i)});

test("employee update rejects a primary campus outside campus access", async () => {
  const repository = new InMemoryEmployeeRepository();
  const created = await createEmployee(base, context(), { repository });
  await assert.rejects(
    updateEmployee(created.id, { primaryCampusId: "campus-east", campusIds: ["campus-main"] }, context(), { repository }),
    { name: "ValidationError" },
  );
});

test("employee campus changes synchronize active campus-scoped role assignments", async () => {
  const repository = new InMemoryEmployeeRepository();
  const accessRepository = new InMemoryAccessRepository();
  const created = await createEmployee(base, context(), { repository });
  await repository.update("employee-test-tenant", created.id, { userId: "erp-user-1" });
  await accessRepository.assignRole("employee-test-tenant", "erp-user-1", "teacher-role", { scopeType: "CAMPUS", campusIds: ["campus-main"] });
  await updateEmployee(created.id, { primaryCampusId: "campus-east", campusIds: ["campus-main", "campus-east"] }, context(), { repository, accessRepository });
  const assignment = (await accessRepository.listAssignments("employee-test-tenant"))[0]!;
  assert.deepEqual(assignment.scope.campusIds, ["campus-main", "campus-east"]);
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
    listPage: (...args) => realUsers.listPage(...args),
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
