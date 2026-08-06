import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { ConflictError, NotFoundError, ValidationError } from "@school-erp/errors";
import { issueConfiguredNumber, type NumberingContext } from "@school-erp/numbering";
import { requireTenantId } from "@school-erp/tenancy";
import { accessRepository, type AccessRepository } from "../access/access.repository";
import type { AccessScope } from "../access/access.model";
import { listRoles } from "../roles/roles.service";
import { userRepository, type UserRepository } from "../users/users.repository";
import { employeeInviteAttemptRepository, type EmployeeInviteAttemptRepository } from "./employee-invite-attempts.repository";
import { employeeDeliveryEventRepository, type EmployeeDeliveryEventRepository } from "./employee-delivery-events.repository";
import { toEmployeeView } from "./employees.mapper";
import type { EmployeeListFilter, EmployeeRecord, StaffIdentityGateway } from "./employees.model";
import { employeePermissions } from "./employees.permissions";
import { employeeRepository, type EmployeeRepository } from "./employees.repository";
import { validateEmployeeCreate, validateEmployeeFilter, validateEmployeeUpdate } from "./employees.validator";

export interface EmployeeServiceDeps {
  repository?: EmployeeRepository;
  accessRepository?: AccessRepository;
  userRepository?: UserRepository | Promise<UserRepository>;
  inviteAttemptRepository?: EmployeeInviteAttemptRepository;
  identityGateway?: StaffIdentityGateway;
  now?: () => Date;
  inviteRetryLimit?: number;
  inviteRetryCooldownMs?: number;
  numberIssuer?: (context: NumberingContext) => Promise<string>;
  deliveryEventRepository?: EmployeeDeliveryEventRepository | Promise<EmployeeDeliveryEventRepository>;
}

type RoleView = NonNullable<Awaited<ReturnType<typeof listRoles>>[number]>;
type IdentityResult = {
  username: string;
  subject?: string | undefined;
  tenantId?: string | undefined;
  roleCode?: string | undefined;
};

function tenant(context: RequestContext) {
  requireAuth(context.authContext);
  return requireTenantId(context.tenantContext);
}

function actor(context: RequestContext) {
  return requireAuth(context.authContext).user!.id;
}

function makeEmployeeId() {
  return `employee_${crypto.randomUUID()}`;
}

async function resolveRoles(context: RequestContext, roleIds: string[]): Promise<RoleView[]> {
  const roles = await listRoles(context.tenantContext);
  const selected = roleIds
    .map((roleId) => roles.find((role) => role?.id === roleId))
    .filter((role): role is RoleView => Boolean(role));
  if (selected.length !== roleIds.length) {
    throw new ValidationError([{ field: "roleIds", message: "one or more roles are invalid" }]);
  }
  return selected;
}

function assignmentScope(employee: EmployeeRecord): AccessScope {
  return employee.pendingScopeType === "TENANT"
    ? { scopeType: "TENANT" }
    : { scopeType: "CAMPUS", campusIds: employee.campusIds };
}

async function recordInviteAttempt(
  deps: EmployeeServiceDeps,
  employee: EmployeeRecord,
  status: "SENT" | "FAILED",
  createdBy: string,
  createdAt: Date,
  error?: string,
) {
  if (!employee.email) return;
  await (deps.inviteAttemptRepository ?? employeeInviteAttemptRepository).append({
    id: `employee_invite_${crypto.randomUUID()}`,
    tenantId: employee.tenantId,
    employeeId: employee.id,
    email: employee.email,
    attemptNumber: employee.inviteAttempts + 1,
    status,
    provider: "COGNITO",
    ...(error ? { error } : {}),
    createdBy,
    createdAt,
  });
}

async function reconcileErpIdentity(
  employee: EmployeeRecord,
  identity: IdentityResult,
  roles: RoleView[],
  deps: EmployeeServiceDeps,
) {
  if (!employee.email) throw new ConflictError("employee login email is missing");
  const users = await (deps.userRepository ?? userRepository);
  const assignments = deps.accessRepository ?? accessRepository;
  let user = await users.getByEmail(employee.tenantId, employee.email);
  if (!user) {
    user = await users.create(employee.tenantId, {
      authUserId: identity.subject ?? identity.username,
      email: employee.email,
      name: employee.fullName,
      status: "INVITED",
    });
  } else if (!user.authUserId || user.status !== "ACTIVE") {
    user = await users.update(employee.tenantId, user.id, {
      authUserId: identity.subject ?? identity.username,
      status: user.status === "ACTIVE" ? "ACTIVE" : "INVITED",
    });
  }
  if (!user) throw new Error("ERP identity reconciliation failed");

  const existingAssignments = await assignments.listAssignments(employee.tenantId);
  const activeRoleIds = new Set(
    existingAssignments.filter((item) => item.userId === user!.id && item.isActive).map((item) => item.roleId),
  );
  for (const role of roles) {
    if (!activeRoleIds.has(role.id)) {
      await assignments.assignRole(employee.tenantId, user.id, role.id, assignmentScope(employee));
    }
  }
  return user;
}

async function completeInviteProvisioning(
  employee: EmployeeRecord,
  identity: IdentityResult,
  roles: RoleView[],
  now: Date,
  context: RequestContext,
  deps: EmployeeServiceDeps,
) {
  const user = await reconcileErpIdentity(employee, identity, roles, deps);
  const updated = await (deps.repository ?? employeeRepository).update(employee.tenantId, employee.id, {
    userId: user.id,
    cognitoUsername: identity.username,
    loginStatus: user.status === "ACTIVE" ? "ACTIVE" : "INVITED",
    inviteAttempts: employee.inviteAttempts + 1,
    lastInviteAttemptAt: now,
    invitedAt: now,
    inviteError: undefined,
    updatedBy: actor(context),
  });
  if (!updated) throw new NotFoundError("employee not found during invite reconciliation");
  return updated;
}

export async function listEmployees(context: RequestContext, deps: EmployeeServiceDeps = {}, filter?: EmployeeListFilter) {
  requirePermission(context.authContext, employeePermissions.read);
  return (await (deps.repository ?? employeeRepository).list(tenant(context), validateEmployeeFilter(filter))).map(toEmployeeView);
}
export async function listEmployeePage(context: RequestContext, deps: EmployeeServiceDeps = {}, filter?: EmployeeListFilter) {
  requirePermission(context.authContext, employeePermissions.read);
  const page = await (deps.repository ?? employeeRepository).listPage(tenant(context), validateEmployeeFilter(filter));
  return { ...page, items: page.items.map(toEmployeeView) };
}

export async function getEmployee(employeeId: string, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.read);
  const value = await (deps.repository ?? employeeRepository).get(tenant(context), employeeId);
  if (!value) throw new NotFoundError("employee not found");
  return toEmployeeView(value);
}

export async function listEmployeeInviteAttempts(employeeId: string, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.read);
  const tenantId = tenant(context);
  const employee = await (deps.repository ?? employeeRepository).get(tenantId, employeeId);
  if (!employee) throw new NotFoundError("employee not found");
  return (await (deps.inviteAttemptRepository ?? employeeInviteAttemptRepository).list(tenantId, employeeId)).map((value) => ({
    ...value,
    createdAt: value.createdAt.toISOString(),
  }));
}
export async function listEmployeeInviteDeliveryEvents(employeeId:string,context:RequestContext,deps:EmployeeServiceDeps={}){
  requirePermission(context.authContext,employeePermissions.read);
  const tenantId=tenant(context),employee=await(deps.repository??employeeRepository).get(tenantId,employeeId);
  if(!employee)throw new NotFoundError("employee not found");
  if(!employee.email)return[];
  const repository=await(deps.deliveryEventRepository??employeeDeliveryEventRepository());
  return(await repository.listByRecipient(employee.email,50)).map(item=>({id:item.id,messageId:item.messageId,eventType:item.eventType,occurredAt:item.occurredAt.toISOString(),recipients:item.recipients}));
}

export async function createEmployee(input: unknown, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.create);
  const payload = validateEmployeeCreate(input);
  const repository = deps.repository ?? employeeRepository;
  const tenantId = tenant(context);
  const now = (deps.now ?? (() => new Date()))();
  if (payload.email && await repository.findByEmail(tenantId, payload.email)) {
    throw new ConflictError("employee email already exists");
  }

  let selectedRoles: RoleView[] = [];
  if (payload.loginEnabled) {
    requirePermission(context.authContext, employeePermissions.invite);
    if (!deps.identityGateway) throw new Error("staff identity gateway is required");
    selectedRoles = await resolveRoles(context, payload.roleIds);
  }

  const id = makeEmployeeId();
  const employeeCode = deps.numberIssuer
    ? await deps.numberIssuer({ tenantId, stream: "EMPLOYEE", idempotencyKey: id })
    : deps.repository
      ? await repository.nextCode(tenantId)
      : await issueConfiguredNumber({ tenantId, stream: "EMPLOYEE", idempotencyKey: id });
  const record: EmployeeRecord = {
    id,
    tenantId,
    employeeCode,
    fullName: payload.fullName,
    ...(payload.email ? { email: payload.email.toLowerCase() } : {}),
    ...(payload.phone ? { phone: payload.phone } : {}),
    staffCategory: payload.staffCategory,
    staffType: payload.staffType,
    employmentType: payload.employmentType,
    ...(payload.designation ? { designation: payload.designation } : {}),
    ...(payload.department ? { department: payload.department } : {}),
    primaryCampusId: payload.primaryCampusId,
    campusIds: payload.campusIds,
    joiningDate: payload.joiningDate,
    status: "ACTIVE",
    loginStatus: "NONE",
    inviteAttempts: 0,
    ...(payload.loginEnabled ? { pendingRoleIds: payload.roleIds, pendingScopeType: payload.scopeType } : {}),
    ...(payload.externalHrCode ? { externalHrCode: payload.externalHrCode } : {}),
    ...(payload.profilePhotoFileId ? { profilePhotoFileId: payload.profilePhotoFileId } : {}),
    ...(payload.templateId ? { templateId: payload.templateId } : {}),
    ...(payload.templateVersion ? { templateVersion: payload.templateVersion } : {}),
    ...(payload.customFields ? { customFields: payload.customFields } : {}),
    createdBy: actor(context),
    updatedBy: actor(context),
    createdAt: now,
    updatedAt: now,
  };
  let saved = await repository.create(record);
  if (!payload.loginEnabled) return toEmployeeView(saved);

  let deliveryRecorded = false;
  try {
    const identity = await deps.identityGateway!.invite({
      email: payload.email!,
      fullName: payload.fullName,
      tenantId,
      roleCode: selectedRoles[0]!.code,
    });
    await recordInviteAttempt(deps, saved, "SENT", actor(context), now);
    deliveryRecorded = true;
    saved = await completeInviteProvisioning(saved, identity, selectedRoles, now, context, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed";
    if (!deliveryRecorded) await recordInviteAttempt(deps, saved, "FAILED", actor(context), now, message);
    saved = (await repository.update(tenantId, saved.id, {
      loginStatus: "FAILED",
      inviteAttempts: 1,
      lastInviteAttemptAt: now,
      inviteError: message,
      updatedBy: actor(context),
    }))!;
  }
  return toEmployeeView(saved);
}

export async function resendEmployeeInvite(employeeId: string, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.invite);
  const repository = deps.repository ?? employeeRepository;
  const tenantId = tenant(context);
  const employee = await repository.get(tenantId, employeeId);
  if (!employee) throw new NotFoundError("employee not found");
  if (!employee.email || !["INVITED", "FAILED"].includes(employee.loginStatus)) {
    throw new ConflictError("employee invite cannot be resent");
  }
  if (employee.inviteAttempts >= (deps.inviteRetryLimit ?? 5)) {
    throw new ConflictError("employee invite retry limit reached");
  }
  const now = (deps.now ?? (() => new Date()))();
  if (employee.lastInviteAttemptAt && now.getTime() - employee.lastInviteAttemptAt.getTime() < (deps.inviteRetryCooldownMs ?? 60_000)) {
    throw new ConflictError("wait before resending the employee invite");
  }
  if (!deps.identityGateway) throw new Error("staff identity gateway is required");

  try {
    const roles = await resolveRoles(context, employee.pendingRoleIds ?? []);
    if (!roles.length) throw new ConflictError("employee invite has no pending role assignment");
    let identity: IdentityResult;
    try {
      identity = await deps.identityGateway.get(employee.email);
      if (identity.tenantId && identity.tenantId !== tenantId) {
        throw new ConflictError("email is already assigned to another tenant");
      }
      if (identity.roleCode && identity.roleCode !== roles[0]!.code) {
        throw new ConflictError("existing login role does not match the employee role");
      }
      await deps.identityGateway.resend(employee.email);
    } catch (lookupError) {
      const errorName = lookupError instanceof Error ? lookupError.name : "";
      if (errorName !== "UserNotFoundException") throw lookupError;
      identity = await deps.identityGateway.invite({
        email: employee.email,
        fullName: employee.fullName,
        tenantId,
        roleCode: roles[0]!.code,
      });
    }
    await recordInviteAttempt(deps, employee, "SENT", actor(context), now);
    return toEmployeeView(await completeInviteProvisioning(employee, identity, roles, now, context, deps));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed";
    await recordInviteAttempt(deps, employee, "FAILED", actor(context), now, message);
    return toEmployeeView((await repository.update(tenantId, employee.id, {
      loginStatus: "FAILED",
      inviteAttempts: employee.inviteAttempts + 1,
      lastInviteAttemptAt: now,
      inviteError: message,
      updatedBy: actor(context),
    }))!);
  }
}

export async function updateEmployee(employeeId: string, input: unknown, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.update);
  const tenantId = tenant(context);
  const repository = deps.repository ?? employeeRepository;
  const current = await repository.get(tenantId, employeeId);
  if (!current) throw new NotFoundError("employee not found");
  const update = validateEmployeeUpdate(input);
  const nextCategory = update.staffCategory ?? current.staffCategory;
  const nextType = update.staffType ?? current.staffType;
  const teachingTypes = new Set(["PRINCIPAL", "VICE_PRINCIPAL", "DEAN", "HOD", "TEACHER", "LECTURER", "LAB_FACULTY", "OTHER"]);
  const nonTeachingTypes = new Set(["ADMIN_STAFF", "SUPPORT_STAFF", "OTHER"]);
  if ((nextCategory === "TEACHING" && !teachingTypes.has(nextType)) || (nextCategory === "NON_TEACHING" && !nonTeachingTypes.has(nextType))) {
    throw new ValidationError([{ field: "staffType", message: "staff type is not valid for the selected staff category" }]);
  }
  const campusIds = update.campusIds ?? current.campusIds;
  const primaryCampusId = update.primaryCampusId ?? current.primaryCampusId;
  if (!campusIds.includes(primaryCampusId)) {
    throw new ValidationError([{ field: "primaryCampusId", message: "primary campus must be included in campus access" }]);
  }
  const result = await repository.update(tenantId, employeeId, { ...update, updatedBy: actor(context) });
  if (!result) throw new NotFoundError("employee not found");
  if (current.userId && update.campusIds) {
    const assignments = deps.accessRepository ?? accessRepository;
    const activeCampusAssignments = (await assignments.listAssignments(tenantId)).filter(
      (item) => item.userId === current.userId && item.isActive && item.scope.scopeType === "CAMPUS",
    );
    for (const assignment of activeCampusAssignments) {
      await assignments.updateAssignmentScope(tenantId, assignment.id, { scopeType: "CAMPUS", campusIds });
    }
  }
  if (current.userId && update.fullName) {
    await (await (deps.userRepository ?? userRepository)).update(tenantId, current.userId, { name: update.fullName });
  }
  return toEmployeeView(result);
}

export async function endEmployment(employeeId: string, reason: string, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.end);
  if (!reason.trim()) throw new ValidationError([{ field: "reason", message: "reason is required" }]);
  const repository = deps.repository ?? employeeRepository;
  const tenantId = tenant(context);
  const employee = await repository.get(tenantId, employeeId);
  if (!employee) throw new NotFoundError("employee not found");
  const now = (deps.now ?? (() => new Date()))();
  if (employee.loginStatus !== "NONE" && employee.email) {
    if (!deps.identityGateway) throw new Error("staff identity gateway is required to disable employee login");
    await deps.identityGateway.disable(employee.email);
  }
  return toEmployeeView((await repository.update(tenantId, employee.id, {
    status: "ENDED",
    endedAt: now,
    endReason: reason.trim(),
    loginStatus: employee.loginStatus === "NONE" ? "NONE" : "DISABLED",
    updatedBy: actor(context),
  }))!);
}

export async function deactivateEmployee(employeeId: string, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.update);
  const repository = deps.repository ?? employeeRepository;
  const tenantId = tenant(context);
  const employee = await repository.get(tenantId, employeeId);
  if (!employee) throw new NotFoundError("employee not found");
  if (employee.status === "ENDED") throw new ConflictError("ended employment cannot be deactivated");
  if (employee.status === "INACTIVE") return toEmployeeView(employee);
  if (employee.email && employee.loginStatus !== "NONE") {
    if (!deps.identityGateway) throw new Error("staff identity gateway is required to disable employee login");
    await deps.identityGateway.disable(employee.email);
  }
  if (employee.userId) await (await (deps.userRepository ?? userRepository)).update(tenantId, employee.userId, { status: "INACTIVE" });
  const updated = await repository.update(tenantId, employee.id, {
    status: "INACTIVE",
    loginStatus: employee.loginStatus === "NONE" ? "NONE" : "DISABLED",
    updatedBy: actor(context),
  });
  if (!updated) throw new NotFoundError("employee not found");
  return toEmployeeView(updated);
}

export async function reactivateEmployee(employeeId: string, context: RequestContext, deps: EmployeeServiceDeps = {}) {
  requirePermission(context.authContext, employeePermissions.update);
  const repository = deps.repository ?? employeeRepository;
  const tenantId = tenant(context);
  const employee = await repository.get(tenantId, employeeId);
  if (!employee) throw new NotFoundError("employee not found");
  if (employee.status === "ENDED") throw new ConflictError("ended employment cannot be reactivated");
  if (employee.status === "ACTIVE") return toEmployeeView(employee);
  if (employee.email && employee.loginStatus === "DISABLED") {
    if (!deps.identityGateway?.enable) throw new Error("staff identity gateway is required to enable employee login");
    await deps.identityGateway.enable(employee.email);
  }
  if (employee.userId) await (await (deps.userRepository ?? userRepository)).update(tenantId, employee.userId, { status: "ACTIVE" });
  const updated = await repository.update(tenantId, employee.id, {
    status: "ACTIVE",
    loginStatus: employee.loginStatus === "DISABLED" ? "ACTIVE" : employee.loginStatus,
    updatedBy: actor(context),
  });
  if (!updated) throw new NotFoundError("employee not found");
  return toEmployeeView(updated);
}

export async function activateEmployeeLogin(tenantId: string, email: string, deps: EmployeeServiceDeps = {}) {
  const repository = deps.repository ?? employeeRepository;
  const employee = await repository.findByEmail(tenantId, email);
  if (!employee || employee.loginStatus === "ACTIVE") return employee ? toEmployeeView(employee) : null;
  const updated = await repository.update(tenantId, employee.id, { loginStatus: "ACTIVE" });
  const users = await (deps.userRepository ?? userRepository);
  if (employee.userId) await users.update(tenantId, employee.userId, { status: "ACTIVE" });
  return updated ? toEmployeeView(updated) : null;
}
