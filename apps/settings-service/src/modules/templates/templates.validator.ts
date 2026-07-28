import { BadRequestError } from "@school-erp/errors";
import type { TemplateCreateInput, TemplateField, TemplateFieldType, TemplateListFilter, TemplateSection, TemplateStatus, TemplateUpdateInput } from "./templates.model";

const allowedStatuses: TemplateStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const allowedTypes = ["FORM", "EMAIL", "PRINT"] as const;
const allowedFieldTypes: TemplateFieldType[] = ["text", "textarea", "number", "email", "phone", "date", "select", "checkbox", "radio", "document"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new BadRequestError(`${label} must be an array`);
  }
  const result = value.map((item) => asString(item)).filter(Boolean);
  return [...new Set(result)];
}

function validateField(input: unknown): TemplateField {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("template field must be an object");
  }
  const value = input as Record<string, unknown>;
  const key = asString(value.key);
  const label = asString(value.label);
  const type = asString(value.type).toLowerCase() as TemplateFieldType;
  const orderRaw = value.order;

  if (!key) throw new BadRequestError("template field key is required");
  if (!/^[a-zA-Z0-9_.-]+$/.test(key)) throw new BadRequestError("template field key is invalid");
  if (!label) throw new BadRequestError("template field label is required");
  if (!allowedFieldTypes.includes(type)) throw new BadRequestError("template field type is invalid");
  if (typeof orderRaw !== "number" || !Number.isFinite(orderRaw)) throw new BadRequestError("template field order is required");

  const options = Array.isArray(value.options) ? value.options.map((option) => asString(option)).filter(Boolean) : undefined;
  const rules = value.rules && typeof value.rules === "object" && !Array.isArray(value.rules)
    ? (value.rules as Record<string, unknown>)
    : undefined;

  return {
    key,
    label,
    type,
    order: Math.floor(orderRaw),
    required: Boolean(value.required),
    visible: value.visible !== false,
    defaultValue: value.defaultValue as string | number | boolean | null | undefined,
    options: options && options.length > 0 ? options : undefined,
    group: asString(value.group) || undefined,
    description: asString(value.description) || undefined,
    placeholder: asString(value.placeholder) || undefined,
    section: asString(value.section) || "additional",
    scope: (["ENQUIRY", "APPLICATION", "BOTH"] as const).includes(asString(value.scope).toUpperCase() as "ENQUIRY" | "APPLICATION" | "BOTH")
      ? asString(value.scope).toUpperCase() as "ENQUIRY" | "APPLICATION" | "BOTH"
      : "BOTH",
    rules: rules
      ? {
          minLength: typeof rules.minLength === "number" ? rules.minLength : undefined,
          maxLength: typeof rules.maxLength === "number" ? rules.maxLength : undefined,
          pattern: asString(rules.pattern) || undefined,
          min: typeof rules.min === "number" ? rules.min : undefined,
          max: typeof rules.max === "number" ? rules.max : undefined,
        }
      : undefined,
  };
}

function validateFields(input: unknown): TemplateField[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new BadRequestError("fields must be an array");
  const fields = input.map(validateField);
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) {
      throw new BadRequestError("template field keys must be unique");
    }
    keys.add(field.key);
  }
  return fields.sort((left, right) => left.order - right.order);
}

function validateSections(input: unknown): TemplateSection[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new BadRequestError("sections must be an array");
  const keys = new Set<string>();
  return input.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new BadRequestError("template section must be an object");
    const value = item as Record<string, unknown>;
    const key = asString(value.key);
    const label = asString(value.label);
    if (!key || !/^[a-zA-Z0-9_.-]+$/.test(key)) throw new BadRequestError("template section key is invalid");
    if (!label) throw new BadRequestError("template section label is required");
    if (keys.has(key)) throw new BadRequestError("template section keys must be unique");
    keys.add(key);
    return { key, label, order: typeof value.order === "number" && Number.isFinite(value.order) ? Math.floor(value.order) : index + 1, ...(asString(value.description) ? { description: asString(value.description) } : {}) };
  }).sort((left, right) => left.order - right.order);
}

function validateSystemKeys(input: unknown): string[] {
  const keys = asStringArray(input, "requiredSystemKeys");
  return keys;
}

export function validateTemplateCreateInput(input: unknown): TemplateCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("template input is required");
  }
  const value = input as Record<string, unknown>;
  const code = asString(value.code);
  const name = asString(value.name);
  const templateType = asString(value.templateType).toUpperCase() as TemplateCreateInput["templateType"];

  if (!code) throw new BadRequestError("code is required");
  if (!name) throw new BadRequestError("name is required");
  if (!allowedTypes.includes(templateType as (typeof allowedTypes)[number])) {
    throw new BadRequestError("templateType is required");
  }

  return {
    code,
    name,
    templateType: templateType as TemplateCreateInput["templateType"],
    description: asString(value.description) || undefined,
    subject: asString(value.subject) || undefined,
    body: asString(value.body) || undefined,
    layout: asString(value.layout) || undefined,
    sections: validateSections(value.sections),
    fields: validateFields(value.fields),
    requiredSystemKeys: validateSystemKeys(value.requiredSystemKeys),
  };
}

export function validateTemplateUpdateInput(input: unknown): TemplateUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("template update input is required");
  }
  const value = input as Record<string, unknown>;
  const update: TemplateUpdateInput = {};
  if (value.code !== undefined) {
    const code = asString(value.code);
    if (!code) throw new BadRequestError("code cannot be empty");
    update.code = code;
  }
  if (value.name !== undefined) {
    const name = asString(value.name);
    if (!name) throw new BadRequestError("name cannot be empty");
    update.name = name;
  }
  if (value.templateType !== undefined) {
    const templateType = asString(value.templateType).toUpperCase() as TemplateCreateInput["templateType"];
    if (!allowedTypes.includes(templateType as (typeof allowedTypes)[number])) {
      throw new BadRequestError("templateType is invalid");
    }
    update.templateType = templateType;
  }
  if (value.description !== undefined) update.description = asString(value.description) || undefined;
  if (value.subject !== undefined) update.subject = asString(value.subject) || undefined;
  if (value.body !== undefined) update.body = asString(value.body) || undefined;
  if (value.layout !== undefined) update.layout = asString(value.layout) || undefined;
  if (value.sections !== undefined) update.sections = validateSections(value.sections);
  if (value.fields !== undefined) update.fields = validateFields(value.fields);
  if (value.requiredSystemKeys !== undefined) update.requiredSystemKeys = validateSystemKeys(value.requiredSystemKeys);
  return update;
}

export function validateTemplateListFilter(input: unknown): TemplateListFilter {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("template filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const filter: TemplateListFilter = {};
  const search = asString(value.search);
  const status = asString(value.status).toUpperCase();
  const templateType = asString(value.templateType).toUpperCase();
  if (search) filter.search = search;
  if (status) {
    if (!allowedStatuses.includes(status as TemplateStatus)) {
      throw new BadRequestError("template status is invalid");
    }
    filter.status = status as TemplateStatus;
  }
  if (templateType) {
    if (!allowedTypes.includes(templateType as (typeof allowedTypes)[number])) {
      throw new BadRequestError("templateType is invalid");
    }
    filter.templateType = templateType as TemplateCreateInput["templateType"];
  }
  return filter;
}
