import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type TemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type TemplateType = "FORM" | "EMAIL" | "PRINT";
export type TemplateFieldType = "text" | "textarea" | "number" | "email" | "phone" | "date" | "select" | "checkbox" | "radio" | "document";
export type TemplateFieldScope = "ENQUIRY" | "APPLICATION" | "BOTH";

export interface TemplateFieldRule {
  minLength?: number | undefined;
  maxLength?: number | undefined;
  pattern?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
}

export interface TemplateSection {
  key: string;
  label: string;
  order: number;
  description?: string | undefined;
}

export interface TemplateField {
  key: string;
  label: string;
  type: TemplateFieldType;
  order: number;
  required: boolean;
  visible: boolean;
  defaultValue?: string | number | boolean | null | undefined;
  options?: string[] | undefined;
  group?: string | undefined;
  description?: string | undefined;
  placeholder?: string | undefined;
  section?: string | undefined;
  scope?: TemplateFieldScope | undefined;
  rules?: TemplateFieldRule | undefined;
}

export interface TemplateRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  templateType: TemplateType;
  status: TemplateStatus;
  version: number;
  publishedVersion?: number | undefined;
  description?: string | undefined;
  subject?: string | undefined;
  body?: string | undefined;
  layout?: string | undefined;
  sections: TemplateSection[];
  fields: TemplateField[];
  requiredSystemKeys: string[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date | undefined;
  archivedAt?: Date | undefined;
}

export interface TemplateCreateInput {
  code: string;
  name: string;
  templateType: TemplateType;
  description?: string | undefined;
  subject?: string | undefined;
  body?: string | undefined;
  layout?: string | undefined;
  sections?: TemplateSection[] | undefined;
  fields?: TemplateField[] | undefined;
  requiredSystemKeys?: string[] | undefined;
}

export interface TemplateUpdateInput {
  code?: string | undefined;
  name?: string | undefined;
  templateType?: TemplateType | undefined;
  description?: string | undefined;
  subject?: string | undefined;
  body?: string | undefined;
  layout?: string | undefined;
  sections?: TemplateSection[] | undefined;
  fields?: TemplateField[] | undefined;
  requiredSystemKeys?: string[] | undefined;
}

export interface TemplateListFilter {
  search?: string | undefined;
  status?: TemplateStatus | undefined;
  templateType?: TemplateType | undefined;
}

export interface TemplateView {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  templateType: TemplateType;
  status: TemplateStatus;
  version: number;
  publishedVersion?: number | undefined;
  description?: string | undefined;
  subject?: string | undefined;
  body?: string | undefined;
  layout?: string | undefined;
  sections: TemplateSection[];
  fields: TemplateField[];
  requiredSystemKeys: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | undefined;
  archivedAt?: string | undefined;
}

export interface TemplateServiceContext {
  tenantContext: TenantContext;
  authContext: AuthContext;
  requestId: string;
}
