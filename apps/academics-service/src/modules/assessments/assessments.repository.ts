import { ConflictError } from "@school-erp/errors";
import {
  planningStore,
  type PlanningDocument,
  type PlanningStore,
} from "../planning-store/planning-store.repository";
import type { AssessmentDefinitionRecord, MarksSheetRecord } from "./assessments.model";

const toDocument = <RecordType extends { id: string; tenantId: string }>(
  record: RecordType,
): PlanningDocument =>
  ({
    ...structuredClone(record),
    _id: record.id,
  }) as PlanningDocument;

const fromDocument = <RecordType>(document: PlanningDocument): RecordType => {
  const { _id: _ignored, ...record } = document;
  return structuredClone(record) as RecordType;
};

export interface AssessmentRepository {
  listDefinitions(tenantId: string, academicYearId: string): Promise<AssessmentDefinitionRecord[]>;
  getDefinition(tenantId: string, id: string): Promise<AssessmentDefinitionRecord | null>;
  saveDefinition(
    record: AssessmentDefinitionRecord,
    expectedVersion?: number,
  ): Promise<AssessmentDefinitionRecord>;
  findSheet(
    tenantId: string,
    employeeId: string,
    assessmentId: string,
    subjectOfferingId: string,
  ): Promise<MarksSheetRecord | null>;
  saveSheet(record: MarksSheetRecord, expectedVersion?: number): Promise<MarksSheetRecord>;
  listSheets(
    tenantId: string,
    employeeId: string,
    academicYearId: string,
  ): Promise<MarksSheetRecord[]>;
}

export class PlanningAssessmentRepository implements AssessmentRepository {
  constructor(private readonly store: PlanningStore = planningStore()) {}

  async listDefinitions(tenantId: string, academicYearId: string) {
    const rows = await this.store.list("assessment_definitions", tenantId, { academicYearId });
    return rows
      .map((row) => fromDocument<AssessmentDefinitionRecord>(row))
      .sort(
        (left, right) =>
          left.sequence - right.sequence || left.assessmentDate.localeCompare(right.assessmentDate),
      );
  }

  async getDefinition(tenantId: string, id: string) {
    const row = await this.store.get("assessment_definitions", tenantId, id);
    return row ? fromDocument<AssessmentDefinitionRecord>(row) : null;
  }

  async saveDefinition(record: AssessmentDefinitionRecord, expectedVersion?: number) {
    return this.save("assessment_definitions", record, expectedVersion, "assessment definition");
  }

  async findSheet(
    tenantId: string,
    employeeId: string,
    assessmentId: string,
    subjectOfferingId: string,
  ) {
    const rows = await this.store.list("marks_sheets", tenantId, {
      employeeId,
      assessmentId,
      subjectOfferingId,
    });
    return rows[0] ? fromDocument<MarksSheetRecord>(rows[0]) : null;
  }

  async saveSheet(record: MarksSheetRecord, expectedVersion?: number) {
    return this.save("marks_sheets", record, expectedVersion, "marks sheet");
  }

  async listSheets(tenantId: string, employeeId: string, academicYearId: string) {
    const rows = await this.store.list("marks_sheets", tenantId, {
      employeeId,
      academicYearId,
    });
    return rows
      .map((row) => fromDocument<MarksSheetRecord>(row))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async save<RecordType extends { id: string; tenantId: string; version: number }>(
    collection: "assessment_definitions" | "marks_sheets",
    record: RecordType,
    expectedVersion: number | undefined,
    label: string,
  ): Promise<RecordType> {
    const current = await this.store.get(collection, record.tenantId, record.id);
    if (!current) {
      if (expectedVersion !== undefined) throw new ConflictError(`${label} version is stale`);
      return fromDocument(await this.store.insert(collection, record.tenantId, toDocument(record)));
    }
    const currentVersion = Number(current.version);
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new ConflictError(`${label} version is stale`);
    }
    const saved = await this.store.replace(
      collection,
      record.tenantId,
      record.id,
      currentVersion,
      toDocument(record),
    );
    if (!saved) throw new ConflictError(`${label} was changed by another user`);
    return fromDocument(saved);
  }
}

let singleton: AssessmentRepository | undefined;
export function assessmentRepository() {
  return (singleton ??= new PlanningAssessmentRepository());
}
