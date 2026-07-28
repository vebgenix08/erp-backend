import type { RequestContext } from "@school-erp/api";
import {
  activateTenant,
  confirmTenantDeletion,
  requestTenantDeletion,
  suspendTenant,
  type TenantServiceDeps,
} from "../tenants.service";

export const activateTenantUseCase = (id: string, context: RequestContext, deps?: TenantServiceDeps) => activateTenant(id, context, deps);
export const suspendTenantUseCase = (id: string, context: RequestContext, deps?: TenantServiceDeps) => suspendTenant(id, context, deps);
export const requestTenantDeletionUseCase = (id: string, reason: string, context: RequestContext, deps?: TenantServiceDeps) => requestTenantDeletion(id, reason, context, deps);
export const confirmTenantDeletionUseCase = (id: string, context: RequestContext, deps?: TenantServiceDeps) => confirmTenantDeletion(id, context, deps);
