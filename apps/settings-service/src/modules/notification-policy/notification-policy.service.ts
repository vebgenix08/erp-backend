import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import { toNotificationPolicyView } from "./notification-policy.mapper";
import type { NotificationPolicyServiceContext } from "./notification-policy.model";
import { notificationPolicyPermissions } from "./notification-policy.permissions";
import { defaultNotificationPolicy, notificationPolicyRepository, type NotificationPolicyRepository } from "./notification-policy.repository";
import { validateNotificationPolicy } from "./notification-policy.validator";

type Context = NotificationPolicyServiceContext | RequestContext;
function tenantId(context: Context) { requireAuth(context.authContext); return requireTenantId(context.tenantContext); }
export async function getNotificationPolicy(context: Context, deps: { repository?: NotificationPolicyRepository } = {}) { requirePermission(context.authContext, notificationPolicyPermissions.read); const tenant = tenantId(context); return toNotificationPolicyView(await (deps.repository ?? notificationPolicyRepository).get(tenant) ?? defaultNotificationPolicy(tenant)); }
export async function updateNotificationPolicy(input: unknown, context: Context, deps: { repository?: NotificationPolicyRepository } = {}) { requirePermission(context.authContext, notificationPolicyPermissions.update); return toNotificationPolicyView(await (deps.repository ?? notificationPolicyRepository).save(tenantId(context), validateNotificationPolicy(input))); }
