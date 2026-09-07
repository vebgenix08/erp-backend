export type AcademicSequenceType = "program" | "class" | "section" | "subject";

export function academicSequenceFilter(
  type: AcademicSequenceType,
  tenantId: string,
  campusId: string,
) {
  const owner = tenantId.trim();
  if (!owner) throw new Error("tenantId is required");
  if (!campusId.trim()) throw new Error("campusId is required");
  return { _id: `${type}:${owner}:${campusId}` };
}
