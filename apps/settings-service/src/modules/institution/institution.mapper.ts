import type { InstitutionProfileRecord, InstitutionProfileView } from "./institution.model";

export function toInstitutionProfileView(record: InstitutionProfileRecord | null): InstitutionProfileView | null {
  return record ? { ...record } : null;
}
