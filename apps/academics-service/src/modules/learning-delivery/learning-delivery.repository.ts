import { ConflictError, NotFoundError } from "@school-erp/errors";
import type { ParallelTimetableBlock, SectionSubjectException, StudentSubjectChoice, SubjectChoiceGroup, SubjectOffering, TeachingGroup, TeachingGroupMembership } from "./learning-delivery.model";

type Entity = SectionSubjectException | SubjectChoiceGroup | StudentSubjectChoice | TeachingGroup | TeachingGroupMembership | SubjectOffering | ParallelTimetableBlock;
type Kind = "sectionExceptions" | "choiceGroups" | "studentChoices" | "teachingGroups" | "memberships" | "offerings" | "parallelBlocks";
const clone = <T extends Entity>(record: T): T => structuredClone(record);
const dates = () => new Date();
const activeOverlap = (fromA: Date, untilA: Date | undefined, fromB: Date, untilB: Date | undefined) =>
  fromA <= (untilB ?? new Date("9999-12-31")) && fromB <= (untilA ?? new Date("9999-12-31"));

export class InMemoryLearningDeliveryRepository {
  private readonly stores: Record<Kind, Map<string, Entity>> = {
    sectionExceptions: new Map(), choiceGroups: new Map(), studentChoices: new Map(), teachingGroups: new Map(),
    memberships: new Map(), offerings: new Map(), parallelBlocks: new Map(),
  };
  list<T extends Entity>(kind: Kind, tenantId: string, filter: Partial<T> = {}) {
    return [...this.stores[kind].values()].filter((record) => record.tenantId === tenantId &&
      Object.entries(filter).every(([key, value]) => record[key as keyof Entity] === value)).map((record) => clone(record as T));
  }
  get<T extends Entity>(kind: Kind, tenantId: string, id: string) {
    const record = this.stores[kind].get(id); return record?.tenantId === tenantId ? clone(record as T) : null;
  }
  private create<T extends Entity>(kind: Kind, tenantId: string, actorId: string, prefix: string, input: Omit<T, keyof AuditRecord>) {
    const now = dates(), record = { ...input, id: `${prefix}_${crypto.randomUUID()}`, tenantId, createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 } as T;
    this.stores[kind].set(record.id, record); return clone(record);
  }
  createSectionException(tenantId: string, actorId: string, input: Omit<SectionSubjectException, keyof AuditRecord>) {
    if (!input.reason.trim()) throw new ConflictError("section exception reason is required");
    return this.create<SectionSubjectException>("sectionExceptions", tenantId, actorId, "section_subject_exception", input);
  }
  createChoiceGroup(tenantId: string, actorId: string, input: Omit<SubjectChoiceGroup, keyof AuditRecord>) {
    if (input.minimumSelections < 0 || input.maximumSelections < input.minimumSelections || input.maximumSelections > input.optionCurriculumSubjectIds.length) throw new ConflictError("choice selection limits are invalid");
    if (new Set(input.optionCurriculumSubjectIds).size !== input.optionCurriculumSubjectIds.length) throw new ConflictError("choice options must be unique");
    return this.create<SubjectChoiceGroup>("choiceGroups", tenantId, actorId, "subject_choice_group", input);
  }
  createStudentChoice(tenantId: string, actorId: string, input: Omit<StudentSubjectChoice, keyof AuditRecord>) {
    const group = this.get<SubjectChoiceGroup>("choiceGroups", tenantId, input.choiceGroupId);
    if (!group || !group.optionCurriculumSubjectIds.includes(input.curriculumSubjectId)) throw new NotFoundError("subject is not an option in the choice group");
    const overlaps = this.list<StudentSubjectChoice>("studentChoices", tenantId, { studentId: input.studentId, choiceGroupId: input.choiceGroupId, status: "ACTIVE" }).some((choice) => activeOverlap(choice.effectiveFrom, choice.effectiveUntil, input.effectiveFrom, input.effectiveUntil));
    if (overlaps) throw new ConflictError("student already has an active choice in this group");
    return this.create<StudentSubjectChoice>("studentChoices", tenantId, actorId, "student_subject_choice", input);
  }
  createTeachingGroup(tenantId: string, actorId: string, input: Omit<TeachingGroup, keyof AuditRecord>) {
    if (input.type === "SECTION" && !input.homeSectionId) throw new ConflictError("section teaching group requires homeSectionId");
    return this.create<TeachingGroup>("teachingGroups", tenantId, actorId, "teaching_group", input);
  }
  ensureSectionGroup(tenantId: string, actorId: string, input: Omit<TeachingGroup, keyof AuditRecord>) {
    const existing = this.list<TeachingGroup>("teachingGroups", tenantId, {
      academicYearId: input.academicYearId, type: "SECTION", status: "ACTIVE",
      ...(input.homeSectionId ? { homeSectionId: input.homeSectionId } : {}),
    })[0];
    return existing ?? this.createTeachingGroup(tenantId, actorId, { ...input, type: "SECTION" });
  }
  addMembership(tenantId: string, actorId: string, input: Omit<TeachingGroupMembership, keyof AuditRecord>) {
    const group = this.get<TeachingGroup>("teachingGroups", tenantId, input.teachingGroupId);
    if (!group) throw new NotFoundError("teaching group was not found");
    const duplicate = this.list<TeachingGroupMembership>("memberships", tenantId, { teachingGroupId: input.teachingGroupId, studentId: input.studentId, status: "ACTIVE" })[0];
    if (duplicate) throw new ConflictError("student already belongs to the teaching group");
    return this.create<TeachingGroupMembership>("memberships", tenantId, actorId, "teaching_group_membership", input);
  }
  createOffering(tenantId: string, actorId: string, input: Omit<SubjectOffering, keyof AuditRecord>) {
    if (input.requiredPeriodsPerWeek < 1 || input.preferredSessionLength < 1 || input.requiredConsecutiveSlots < 1) throw new ConflictError("offering periods must be positive");
    if (input.targetType === "SECTION" ? !input.sectionId || Boolean(input.subjectBatchId) : !input.subjectBatchId || Boolean(input.sectionId)) throw new ConflictError("offering must target exactly one section or subject batch");
    return this.create<SubjectOffering>("offerings", tenantId, actorId, "subject_offering", input);
  }
  createParallelBlock(tenantId: string, actorId: string, input: Omit<ParallelTimetableBlock, keyof AuditRecord>) {
    if (input.requiredOfferingIds.length < 2) throw new ConflictError("parallel block requires at least two offerings");
    return this.create<ParallelTimetableBlock>("parallelBlocks", tenantId, actorId, "parallel_timetable_block", input);
  }
}
type AuditRecord = import("./learning-delivery.model").AuditRecord;
