import type { TemplateRecord, TemplateView } from "./templates.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toTemplateView(record: TemplateRecord | null): TemplateView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    code: record.code,
    name: record.name,
    templateType: record.templateType,
    status: record.status,
    version: record.version,
    publishedVersion: record.publishedVersion,
    description: record.description,
    subject: record.subject,
    body: record.body,
    layout: record.layout,
    sections: (record.sections ?? []).map((section) => ({ ...section })),
    fields: record.fields.map((field) => ({ ...field, rules: field.rules ? { ...field.rules } : undefined, options: field.options ? [...field.options] : undefined })),
    requiredSystemKeys: [...record.requiredSystemKeys],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    publishedAt: iso(record.publishedAt),
    archivedAt: iso(record.archivedAt),
  };
}
