import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { ForbiddenError } from "@school-erp/errors";
import { receiptTemplatePermissions } from "./receipt-template.permissions";
import { defaultReceiptTemplate, receiptTemplateRepository, type ReceiptTemplateRepository } from "./receipt-template.repository";
import type { ReceiptTemplateView } from "./receipt-template.model";
import { validateReceiptTemplate } from "./receipt-template.validator";

export interface ReceiptTemplateDependencies { repository?: ReceiptTemplateRepository | Promise<ReceiptTemplateRepository> }
function tenantId(context: RequestContext) { const value = context.tenantContext?.tenantId; if (!value) throw new ForbiddenError("tenant context is required"); return value; }
function actorId(context: RequestContext) { const value = context.authContext?.user?.id; if (!value) throw new ForbiddenError("authentication is required"); return value; }
function requirePermission(context: RequestContext, permission: Permission) { if (!context.authContext?.user?.permissions.includes(permission)) throw new ForbiddenError(`permission ${permission} is required`); }
function view(record: ReturnType<typeof defaultReceiptTemplate>): ReceiptTemplateView { return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }; }
async function repository(deps?: ReceiptTemplateDependencies) { return await (deps?.repository ?? receiptTemplateRepository()); }
export async function getReceiptTemplate(context: RequestContext, deps?: ReceiptTemplateDependencies) { requirePermission(context, receiptTemplatePermissions.read as Permission); const id = tenantId(context); return view((await (await repository(deps)).get(id)) ?? defaultReceiptTemplate(id)); }
export async function saveReceiptTemplate(input: unknown, context: RequestContext, deps?: ReceiptTemplateDependencies) { requirePermission(context, receiptTemplatePermissions.manage as Permission); return view(await (await repository(deps)).save(tenantId(context), actorId(context), validateReceiptTemplate(input))); }
