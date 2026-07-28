import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import { academicYearRepository, type AcademicYearRepository } from "../academic-years/academic-years.repository";
import { campusRepository, type CampusRepository } from "../campuses/campuses.repository";
import { institutionRepository, type InstitutionRepository } from "../institution/institution.repository";
import { templateRepository, type TemplateRepository } from "../templates/templates.repository";
import type { ReadinessItemView, TenantReadinessView } from "./readiness.model";
import { readinessPermissions } from "./readiness.permissions";

export interface ReadinessServiceDeps {
  institution?: InstitutionRepository;
  campuses?: CampusRepository;
  academicYears?: AcademicYearRepository;
  templates?: TemplateRepository | Promise<TemplateRepository>;
  now?: () => Date;
}

export async function getTenantReadiness(context: RequestContext, deps: ReadinessServiceDeps = {}): Promise<TenantReadinessView> {
  requireAuth(context.authContext);
  requirePermission(context.authContext, readinessPermissions.read);
  const tenantId = requireTenantId(context.tenantContext);
  const templates = await (deps.templates ?? templateRepository);
  const [profile, campuses, years, publishedTemplates] = await Promise.all([
    (deps.institution ?? institutionRepository).getById(tenantId, "institution"),
    (deps.campuses ?? campusRepository).list(tenantId, { status: "ACTIVE" }),
    (deps.academicYears ?? academicYearRepository).list(tenantId, { status: "ACTIVE" }),
    templates.list(tenantId, { status: "PUBLISHED" }),
  ]);
  const items: ReadinessItemView[] = [
    { key: "INSTITUTION_PROFILE", label: "Institution profile", status: profile?.name.trim() ? "READY" : "ACTION_REQUIRED", blocking: true, route: "/admin/setup/institution", detail: profile?.name.trim() ? "Institution identity is configured." : "Add the institution name and contact details." },
    { key: "ACTIVE_CAMPUS", label: "Campus setup", status: campuses.length ? "READY" : "ACTION_REQUIRED", blocking: true, route: "/admin/setup/campuses", detail: campuses.length ? `${campuses.length} active campus${campuses.length === 1 ? "" : "es"}.` : "Create and activate at least one campus." },
    { key: "ACTIVE_ACADEMIC_YEAR", label: "Academic year", status: years.length === 1 ? "READY" : "ACTION_REQUIRED", blocking: true, route: "/admin/setup/academic-years", detail: years.length === 1 ? `${years[0]?.name} is the operating year.` : "Exactly one operating academic year is required." },
    { key: "PUBLISHED_TEMPLATE", label: "Published template", status: publishedTemplates.length ? "READY" : "OPTIONAL", blocking: false, route: "/admin/setup/templates", detail: publishedTemplates.length ? `${publishedTemplates.length} template${publishedTemplates.length === 1 ? " is" : "s are"} published.` : "Publish templates before opening admissions or communication workflows." },
  ];
  const required = items.filter((item) => item.blocking);
  const completedRequired = required.filter((item) => item.status === "READY").length;
  return { ready: completedRequired === required.length, completedRequired, totalRequired: required.length, percentage: Math.round((completedRequired / required.length) * 100), items, evaluatedAt: (deps.now?.() ?? new Date()).toISOString() };
}
