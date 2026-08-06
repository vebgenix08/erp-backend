import { ConflictError, NotFoundError } from "@school-erp/errors";
import type { AcademicResponsibility, EmployeeCampusAssignment, FacultyAudit, OfferingTeacherAssignment, TeacherAvailability, TeacherSubjectEligibility, TeacherWorkloadPolicy, WorkloadItem, WorkloadSummary } from "./faculty-planning.model";
type Entity = EmployeeCampusAssignment | TeacherSubjectEligibility | OfferingTeacherAssignment | AcademicResponsibility | TeacherAvailability | TeacherWorkloadPolicy;
type Kind = "campuses" | "eligibility" | "assignments" | "responsibilities" | "availability" | "policies";
const overlap = (a: { effectiveFrom: Date; effectiveUntil?: Date }, b: { effectiveFrom: Date; effectiveUntil?: Date }) => a.effectiveFrom <= (b.effectiveUntil ?? new Date("9999-12-31")) && b.effectiveFrom <= (a.effectiveUntil ?? new Date("9999-12-31"));
export class InMemoryFacultyPlanningRepository {
  private stores: Record<Kind, Map<string, Entity>> = { campuses: new Map(), eligibility: new Map(), assignments: new Map(), responsibilities: new Map(), availability: new Map(), policies: new Map() };
  list<T extends Entity>(kind: Kind, tenantId: string, filter: Partial<T> = {}) { return [...this.stores[kind].values()].filter((r) => r.tenantId === tenantId && Object.entries(filter).every(([k, v]) => r[k as keyof Entity] === v)).map((r) => structuredClone(r as T)); }
  private create<T extends Entity>(kind: Kind, tenantId: string, actorId: string, prefix: string, input: Omit<T, keyof FacultyAudit>) { const now = new Date(), record = { ...input, id: `${prefix}_${crypto.randomUUID()}`, tenantId, createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 } as T; this.stores[kind].set(record.id, record); return structuredClone(record); }
  assignCampus(tenantId: string, actorId: string, input: Omit<EmployeeCampusAssignment, keyof FacultyAudit>) {
    const duplicate = this.list<EmployeeCampusAssignment>("campuses", tenantId, { employeeId: input.employeeId, campusId: input.campusId, status: "ACTIVE" }).some((r) => overlap(r, input));
    if (duplicate) throw new ConflictError("employee already has an overlapping campus assignment");
    return this.create<EmployeeCampusAssignment>("campuses", tenantId, actorId, "employee_campus_assignment", input);
  }
  addEligibility(tenantId: string, actorId: string, input: Omit<TeacherSubjectEligibility, keyof FacultyAudit>) { return this.create<TeacherSubjectEligibility>("eligibility", tenantId, actorId, "teacher_subject_eligibility", input); }
  assignTeacher(tenantId: string, actorId: string, input: Omit<OfferingTeacherAssignment, keyof FacultyAudit>, campusId: string, strictEligibility: boolean) {
    if (!this.list<EmployeeCampusAssignment>("campuses", tenantId, { employeeId: input.employeeId, campusId, availableForTeaching: true, status: "ACTIVE" })[0]) throw new NotFoundError("teacher has no active teaching access to the campus");
    const eligible = this.list<TeacherSubjectEligibility>("eligibility", tenantId, { employeeId: input.employeeId, status: "ACTIVE" }).length > 0;
    if (!eligible && strictEligibility) throw new ConflictError("teacher is not eligible for this subject");
    if (!eligible && input.eligibilityStatus !== "OVERRIDDEN") throw new ConflictError("eligibility override and reason are required");
    if (input.eligibilityStatus === "OVERRIDDEN" && !input.eligibilityOverrideReason?.trim()) throw new ConflictError("eligibility override reason is required");
    if (input.assignmentRole === "PRIMARY" && this.list<OfferingTeacherAssignment>("assignments", tenantId, { subjectOfferingId: input.subjectOfferingId, assignmentRole: "PRIMARY", status: "ACTIVE" }).some((r) => overlap(r, input))) throw new ConflictError("offering already has an overlapping primary teacher");
    return this.create<OfferingTeacherAssignment>("assignments", tenantId, actorId, "teaching_assignment", input);
  }
  addResponsibility(tenantId: string, actorId: string, input: Omit<AcademicResponsibility, keyof FacultyAudit>) {
    if (["CLASS_TEACHER", "SECTION_INCHARGE"].includes(input.responsibilityType) && !input.sectionId) throw new ConflictError("section responsibility requires sectionId");
    return this.create<AcademicResponsibility>("responsibilities", tenantId, actorId, "academic_responsibility", input);
  }
  addAvailability(tenantId: string, actorId: string, input: Omit<TeacherAvailability, keyof FacultyAudit>) { if (input.startTime >= input.endTime) throw new ConflictError("availability end time must be after start time"); return this.create<TeacherAvailability>("availability", tenantId, actorId, "teacher_availability", input); }
  addPolicy(tenantId: string, actorId: string, input: Omit<TeacherWorkloadPolicy, keyof FacultyAudit>) { return this.create<TeacherWorkloadPolicy>("policies", tenantId, actorId, "teacher_workload_policy", input); }
}
export function calculateWorkload(employeeId: string, items: WorkloadItem[], policy: Pick<TeacherWorkloadPolicy, "maximumContactPeriodsPerWeek" | "maximumWeightedUnitsPerWeek">): WorkloadSummary {
  const own = items.filter((item) => item.employeeId === employeeId), campus = new Map<string, { contactPeriods: number; weightedUnits: number }>();
  for (const item of own) { const current = campus.get(item.campusId) ?? { contactPeriods: 0, weightedUnits: 0 }; current.contactPeriods += item.contactPeriods; current.weightedUnits += item.weightedUnits; campus.set(item.campusId, current); }
  const contactPeriods = own.reduce((sum, item) => sum + item.contactPeriods, 0), weightedUnits = own.reduce((sum, item) => sum + item.weightedUnits, 0);
  return { employeeId, contactPeriods, weightedUnits, campusBreakdown: [...campus].map(([campusId, value]) => ({ campusId, ...value })), exceedsContactLimit: policy.maximumContactPeriodsPerWeek !== undefined && contactPeriods > policy.maximumContactPeriodsPerWeek, exceedsWeightedLimit: policy.maximumWeightedUnitsPerWeek !== undefined && weightedUnits > policy.maximumWeightedUnitsPerWeek };
}
