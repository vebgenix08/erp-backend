import type { RequestContext } from "@school-erp/api";
import { ConflictError } from "@school-erp/errors";
import { requirePlatformPermission } from "../../middleware";
import { platformPermissions } from "../../permissions";
import { appendAuditLog, type AuditLogServiceDeps } from "../audit-logs/audit-logs.service";
import {
  createFirstAdminBootstrap,
  getFirstAdminBootstrap,
  type FirstAdminBootstrapServiceDeps,
} from "../bootstrap/bootstrap.service";
import { createTenantRepository, type TenantRepository } from "../tenants/tenants.repository";
import type { ProvisionTenantResult } from "./provisioning.model";
import { validateProvisionTenantInput } from "./provisioning.validator";

export interface ProvisioningServiceDeps {
  tenants?: TenantRepository | Promise<TenantRepository>;
  bootstrap?: FirstAdminBootstrapServiceDeps;
  auditLogs?: AuditLogServiceDeps;
}

function internalTenantCode(slug: string) {
  return `TEN-${slug.replace(/-/g, "").toUpperCase().slice(0, 16)}`;
}

export async function provisionTenant(
  input: Record<string, unknown>,
  context: RequestContext,
  deps: ProvisioningServiceDeps = {},
): Promise<ProvisionTenantResult> {
  requirePlatformPermission(context, platformPermissions.tenants.create);
  const payload = validateProvisionTenantInput(input);
  const tenants = await (deps.tenants ?? createTenantRepository());
  let tenant = await tenants.getByClientRequestId(payload.clientRequestId);

  if (!tenant) {
    if (await tenants.getBySlug(payload.slug)) throw new ConflictError("tenant slug must be unique");
    try {
      tenant = await tenants.create({
        clientRequestId: payload.clientRequestId,
        name: payload.organizationName,
        slug: payload.slug,
        code: internalTenantCode(payload.slug),
        type: "INSTITUTION",
        contactEmail: payload.primaryAdminEmail,
      });
    } catch (error) {
      tenant = await tenants.getByClientRequestId(payload.clientRequestId);
      if (!tenant) throw error;
    }
    tenant = (await tenants.update(tenant.id, { status: "ONBOARDING" })) ?? tenant;
  }

  const existingBootstrap = await getFirstAdminBootstrap(tenant.id, context, deps.bootstrap);
  let bootstrap = existingBootstrap;
  if (!bootstrap) {
    try {
      bootstrap = await createFirstAdminBootstrap(
        {
          tenantId: tenant.id,
          adminName: payload.primaryAdminFullName,
          adminEmail: payload.primaryAdminEmail,
        },
        context,
        deps.bootstrap,
      );
    } catch (error) {
      bootstrap = await getFirstAdminBootstrap(tenant.id, context, deps.bootstrap);
      if (!bootstrap) throw error;
    }
  }

  if (!existingBootstrap) {
    await appendAuditLog(
      {
        actorId: context.authContext?.user?.id,
        tenantId: tenant.id,
        action: "TENANT_PROVISIONED",
        entityType: "TENANT",
        entityId: tenant.id,
        details: { slug: payload.slug, inviteStatus: bootstrap.status },
      },
      deps.auditLogs,
    );
  }

  return {
    tenantId: tenant.id,
    organizationName: tenant.name,
    slug: tenant.slug ?? payload.slug,
    onboardingStatus: "ADMIN_ACTIVATION",
    primaryAdminInviteStatus: bootstrap.status,
    warnings:
      bootstrap.status === "FAILED"
        ? [{ code: "INVITE_FAILED", message: "Tenant was created but the administrator invite must be retried." }]
        : [],
  };
}
