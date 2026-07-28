import { ValidationError } from "@school-erp/errors";
import type { ReceiptTemplateInput } from "./receipt-template.model";
function text(value: unknown, field: string, required = false): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ValidationError([{ field, message: `${field} is required` }]);
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length > 500) throw new ValidationError([{ field, message: `${field} is invalid` }]);
  return value.trim();
}
function flag(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new ValidationError([{ field, message: `${field} must be a boolean` }]);
  return value;
}
export function validateReceiptTemplate(input: unknown): ReceiptTemplateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError([{ field: "input", message: "receipt template is required" }]);
  const value = input as Record<string, unknown>;
  const accentColor = text(value.accentColor, "accentColor", true)!;
  const headerText = text(value.headerText, "headerText");
  const footerText = text(value.footerText, "footerText");
  if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) throw new ValidationError([{ field: "accentColor", message: "accentColor must be a six-digit hex color" }]);
  return {
    title: text(value.title, "title", true)!,
    ...(headerText ? { headerText } : {}),
    ...(footerText ? { footerText } : {}),
    signatureLabel: text(value.signatureLabel, "signatureLabel", true)!,
    paperSize: "A4",
    accentColor,
    showInstitutionLogo: flag(value.showInstitutionLogo, "showInstitutionLogo"),
    showInstitutionAddress: flag(value.showInstitutionAddress, "showInstitutionAddress"),
    showPaymentMethod: flag(value.showPaymentMethod, "showPaymentMethod"),
    showPaymentReference: flag(value.showPaymentReference, "showPaymentReference"),
  };
}
