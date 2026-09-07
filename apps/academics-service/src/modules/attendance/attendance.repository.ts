import { ConflictError } from "@school-erp/errors";
import {
  planningStore,
  type PlanningDocument,
  type PlanningStore,
} from "../planning-store/planning-store.repository";
import type { AttendanceSessionRecord } from "./attendance.model";

const toDocument = (record: AttendanceSessionRecord): PlanningDocument => ({
  ...structuredClone(record),
  _id: record.id,
});

const fromDocument = (document: PlanningDocument): AttendanceSessionRecord => {
  const { _id: _ignored, ...record } = document;
  return structuredClone(record) as unknown as AttendanceSessionRecord;
};

export interface AttendanceRepository {
  findByLesson(
    tenantId: string,
    employeeId: string,
    date: string,
    lessonId: string,
  ): Promise<AttendanceSessionRecord | null>;
  save(record: AttendanceSessionRecord, expectedVersion?: number): Promise<AttendanceSessionRecord>;
  listByTeacher(
    tenantId: string,
    employeeId: string,
    academicYearId: string,
  ): Promise<AttendanceSessionRecord[]>;
}

export class PlanningAttendanceRepository implements AttendanceRepository {
  constructor(private readonly store: PlanningStore = planningStore()) {}

  async findByLesson(tenantId: string, employeeId: string, date: string, lessonId: string) {
    const rows = await this.store.list("attendance_sessions", tenantId, {
      employeeId,
      date,
      lessonId,
    });
    return rows[0] ? fromDocument(rows[0]) : null;
  }

  async save(record: AttendanceSessionRecord, expectedVersion?: number) {
    const current = await this.store.get("attendance_sessions", record.tenantId, record.id);
    if (!current) {
      if (expectedVersion !== undefined) throw new ConflictError("attendance version is stale");
      return fromDocument(
        await this.store.insert("attendance_sessions", record.tenantId, toDocument(record)),
      );
    }
    const currentVersion = Number(current.version);
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new ConflictError("attendance version is stale");
    }
    const saved = await this.store.replace(
      "attendance_sessions",
      record.tenantId,
      record.id,
      currentVersion,
      toDocument(record),
    );
    if (!saved) throw new ConflictError("attendance was changed by another user");
    return fromDocument(saved);
  }

  async listByTeacher(tenantId: string, employeeId: string, academicYearId: string) {
    const rows = await this.store.list("attendance_sessions", tenantId, {
      employeeId,
      academicYearId,
    });
    return rows
      .map(fromDocument)
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) || right.startTime.localeCompare(left.startTime),
      );
  }
}

let singleton: AttendanceRepository | undefined;
export function attendanceRepository() {
  return (singleton ??= new PlanningAttendanceRepository());
}
