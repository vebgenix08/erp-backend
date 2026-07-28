import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@school-erp/errors";
import {
  getMongoConnection,
  type MongoEnvLike,
  withTransaction,
} from "@school-erp/mongodb";
import type { Collection, ClientSession } from "mongodb";
import type {
  CreateStudentFromAdmissionInput,
  EnrollmentRecord,
  StudentListFilter,
  StudentPage,
  StudentRecord,
  StudentWithEnrollment,
} from "./students.model";
interface StudentDocument extends StudentRecord {
  _id: string;
}
interface EnrollmentDocument extends EnrollmentRecord {
  _id: string;
}
interface SequenceDocument {
  _id: string;
  value: number;
}
export interface StudentRepository {
  createFromAdmission(
    tenantId: string,
    input: CreateStudentFromAdmissionInput,
    programId: string,
  ): Promise<StudentWithEnrollment>;
  getById(tenantId: string, id: string): Promise<StudentWithEnrollment | null>;
  getByAdmissionApplicationId(
    tenantId: string,
    applicationId: string,
  ): Promise<StudentWithEnrollment | null>;
  list(
    tenantId: string,
    filter?: StudentListFilter,
  ): Promise<StudentWithEnrollment[]>;
  listPage(tenantId: string, filter: StudentListFilter): Promise<StudentPage>;
  changeEnrollment(
    tenantId: string,
    studentId: string,
    input: { campusId: string; academicYearId: string; programId: string; classId: string; sectionId?: string; rollNumber?: string; changedBy: string },
  ): Promise<{ current: StudentWithEnrollment; previousEnrollmentId: string }>;
}
const tenant = (value: string) => {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestError("tenantId is required");
  return normalized;
};
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cloneStudent = (item: StudentRecord): StudentRecord => {
  const cloned: StudentRecord = {
    ...item,
    guardian: { ...item.guardian },
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
  if (item.dateOfBirth) cloned.dateOfBirth = new Date(item.dateOfBirth);
  else delete cloned.dateOfBirth;
  return cloned;
};
const cloneEnrollment = (item: EnrollmentRecord): EnrollmentRecord => ({
  ...item,
  enrolledAt: new Date(item.enrolledAt),
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt),
});
const pair = (
  student: StudentRecord,
  enrollment: EnrollmentRecord,
): StudentWithEnrollment => ({
  student: cloneStudent(student),
  enrollment: cloneEnrollment(enrollment),
});
export class InMemoryStudentRepository implements StudentRepository {
  private readonly students = new Map<string, StudentRecord>();
  private readonly enrollments = new Map<string, EnrollmentRecord>();
  private readonly sequences = new Map<string, number>();
  private next(tenantId: string, yearId: string) {
    const key = `${tenantId}:${yearId}`;
    const value = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, value);
    return `REG-${yearId
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(-8)
      .toUpperCase()}-${String(value).padStart(5, "0")}`;
  }
  async createFromAdmission(
    tenantId: string,
    input: CreateStudentFromAdmissionInput,
    programId: string,
  ) {
    const tid = tenant(tenantId),
      existing = await this.getByAdmissionApplicationId(
        tid,
        input.admissionApplicationId,
      );
    if (existing) return existing;
    if (
      [...this.students.values()].some(
        (item) =>
          item.tenantId === tid &&
          item.admissionNumber === input.admissionNumber,
      )
    )
      throw new ConflictError("admission number already belongs to a student");
    const at = new Date(input.confirmedAt),
      now = new Date();
    const student: StudentRecord = {
      id: `student_${crypto.randomUUID()}`,
      tenantId: tid,
      admissionApplicationId: input.admissionApplicationId,
      admissionNumber: input.admissionNumber,
      registrationNumber: this.next(tid, input.academicYearId),
      name: input.studentName,
      phone: input.phone,
      guardian: { name: input.parentName },
      status: "ACTIVE",
      createdBy: input.confirmedBy,
      createdAt: now,
      updatedAt: now,
    };
    if (input.dateOfBirth) student.dateOfBirth = new Date(input.dateOfBirth);
    if (input.gender) student.gender = input.gender;
    if (input.email) student.email = input.email;
    if (input.address) student.address = input.address;
    if (input.parentPhone) student.guardian.phone = input.parentPhone;
    if (input.parentRelation) student.guardian.relation = input.parentRelation;
    const enrollment: EnrollmentRecord = {
      id: `enrollment_${crypto.randomUUID()}`,
      tenantId: tid,
      studentId: student.id,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      programId,
      classId: input.classId,
      status: "ACTIVE",
      enrolledAt: at,
      createdBy: input.confirmedBy,
      createdAt: now,
      updatedAt: now,
    };
    if (input.sectionId) enrollment.sectionId = input.sectionId;
    this.students.set(student.id, cloneStudent(student));
    this.enrollments.set(enrollment.id, cloneEnrollment(enrollment));
    return pair(student, enrollment);
  }
  async getById(tenantId: string, id: string) {
    const student = this.students.get(id);
    if (!student || student.tenantId !== tenant(tenantId)) return null;
    const enrollment = [...this.enrollments.values()].find(
      (item) =>
        item.tenantId === student.tenantId &&
        item.studentId === id &&
        item.status === "ACTIVE",
    );
    return enrollment ? pair(student, enrollment) : null;
  }
  async getByAdmissionApplicationId(tenantId: string, applicationId: string) {
    const tid = tenant(tenantId),
      student = [...this.students.values()].find(
        (item) =>
          item.tenantId === tid &&
          item.admissionApplicationId === applicationId,
      );
    return student ? this.getById(tid, student.id) : null;
  }
  async list(tenantId: string, filter: StudentListFilter = {}) {
    const page = await this.listPage(tenantId, {
      ...filter,
      page: Math.floor((filter.offset ?? 0) / (filter.limit ?? 100)) + 1,
      pageSize: filter.limit ?? 100,
    });
    return page.items;
  }
  async listPage(tenantId: string, filter: StudentListFilter = {}) {
    const tid = tenant(tenantId),
      rows: StudentWithEnrollment[] = [];
    for (const student of this.students.values()) {
      if (
        student.tenantId !== tid ||
        (filter.status && student.status !== filter.status)
      )
        continue;
      const enrollment = [...this.enrollments.values()].find(
        (item) =>
          item.tenantId === tid &&
          item.studentId === student.id &&
          item.status === "ACTIVE",
      );
      if (!enrollment) continue;
      if (
        (filter.campusId && enrollment.campusId !== filter.campusId) ||
        (filter.academicYearId &&
          enrollment.academicYearId !== filter.academicYearId) ||
        (filter.classId && enrollment.classId !== filter.classId) ||
        (filter.sectionId && enrollment.sectionId !== filter.sectionId)
      )
        continue;
      if (
        filter.search &&
        !`${student.name} ${student.registrationNumber} ${student.admissionNumber} ${student.phone}`
          .toLowerCase()
          .includes(filter.search.toLowerCase())
      )
        continue;
      rows.push(pair(student, enrollment));
    }
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 25;
    const sortBy = filter.sortBy ?? "name";
    const sortDirection = filter.sortDirection ?? "ASC";
    const direction = sortDirection === "ASC" ? 1 : -1;
    rows.sort((left, right) => {
      const leftValue =
        sortBy === "createdAt"
          ? left.student.createdAt.getTime()
          : left.student[sortBy].toLowerCase();
      const rightValue =
        sortBy === "createdAt"
          ? right.student.createdAt.getTime()
          : right.student[sortBy].toLowerCase();
      const compared =
        typeof leftValue === "number"
          ? leftValue - (rightValue as number)
          : leftValue.localeCompare(rightValue as string);
      return compared === 0
        ? left.student.id.localeCompare(right.student.id)
        : compared * direction;
    });
    const total = rows.length;
    const offset = (page - 1) * pageSize;
    return {
      items: rows.slice(offset, offset + pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      sortBy,
      sortDirection,
    };
  }
  async changeEnrollment(tenantId: string, studentId: string, input: { campusId: string; academicYearId: string; programId: string; classId: string; sectionId?: string; rollNumber?: string; changedBy: string }) {
    const tid = tenant(tenantId), existing = await this.getById(tid, studentId);
    if (!existing) throw new NotFoundError("student was not found");
    const previous = this.enrollments.get(existing.enrollment.id)!;
    previous.status = "COMPLETED"; previous.updatedAt = new Date();
    this.enrollments.set(previous.id, cloneEnrollment(previous));
    const now = new Date(), enrollment: EnrollmentRecord = { id: `enrollment_${crypto.randomUUID()}`, tenantId: tid, studentId, campusId: input.campusId, academicYearId: input.academicYearId, programId: input.programId, classId: input.classId, status: "ACTIVE", enrolledAt: now, createdBy: input.changedBy, createdAt: now, updatedAt: now };
    if (input.sectionId) enrollment.sectionId = input.sectionId;
    if (input.rollNumber) enrollment.rollNumber = input.rollNumber;
    this.enrollments.set(enrollment.id, cloneEnrollment(enrollment));
    return { current: pair(existing.student, enrollment), previousEnrollmentId: previous.id };
  }
}
class MongoStudentRepository implements StudentRepository {
  constructor(
    private readonly students: Collection<StudentDocument>,
    private readonly enrollments: Collection<EnrollmentDocument>,
    private readonly sequences: Collection<SequenceDocument>,
    private readonly env: MongoEnvLike,
  ) {}
  private async enrollment(
    tenantId: string,
    studentId: string,
    session?: ClientSession,
  ) {
    return this.enrollments.findOne(
      { tenantId, studentId, status: "ACTIVE" },
      session ? { session } : {},
    ) as Promise<EnrollmentDocument | null>;
  }
  async createFromAdmission(
    tenantId: string,
    input: CreateStudentFromAdmissionInput,
    programId: string,
  ) {
    const tid = tenant(tenantId),
      existing = await this.getByAdmissionApplicationId(
        tid,
        input.admissionApplicationId,
      );
    if (existing) return existing;
    return withTransaction(
      async (session) => {
        const duplicate = await this.students.findOne(
          {
            tenantId: tid,
            $or: [
              { admissionApplicationId: input.admissionApplicationId },
              { admissionNumber: input.admissionNumber },
            ],
          },
          session ? { session } : {},
        );
        if (duplicate) {
          const current = await this.getByAdmissionApplicationId(
            tid,
            input.admissionApplicationId,
          );
          if (current) return current;
          throw new ConflictError(
            "admission number already belongs to a student",
          );
        }
        const sequence = await this.sequences.findOneAndUpdate(
          { _id: `student-registration:${tid}:${input.academicYearId}` },
          { $inc: { value: 1 } },
          {
            upsert: true,
            returnDocument: "after",
            includeResultMetadata: false,
            ...(session ? { session } : {}),
          },
        );
        const now = new Date(),
          student: StudentRecord = {
            id: `student_${crypto.randomUUID()}`,
            tenantId: tid,
            admissionApplicationId: input.admissionApplicationId,
            admissionNumber: input.admissionNumber,
            registrationNumber: `REG-${input.academicYearId
              .replace(/[^A-Za-z0-9]/g, "")
              .slice(-8)
              .toUpperCase()}-${String(sequence?.value ?? 1).padStart(5, "0")}`,
            name: input.studentName,
            phone: input.phone,
            guardian: { name: input.parentName },
            status: "ACTIVE",
            createdBy: input.confirmedBy,
            createdAt: now,
            updatedAt: now,
          };
        if (input.dateOfBirth)
          student.dateOfBirth = new Date(input.dateOfBirth);
        if (input.gender) student.gender = input.gender;
        if (input.email) student.email = input.email;
        if (input.address) student.address = input.address;
        if (input.parentPhone) student.guardian.phone = input.parentPhone;
        if (input.parentRelation)
          student.guardian.relation = input.parentRelation;
        const enrollment: EnrollmentRecord = {
          id: `enrollment_${crypto.randomUUID()}`,
          tenantId: tid,
          studentId: student.id,
          campusId: input.campusId,
          academicYearId: input.academicYearId,
          programId,
          classId: input.classId,
          status: "ACTIVE",
          enrolledAt: new Date(input.confirmedAt),
          createdBy: input.confirmedBy,
          createdAt: now,
          updatedAt: now,
        };
        if (input.sectionId) enrollment.sectionId = input.sectionId;
        await this.students.insertOne(
          { ...student, _id: student.id },
          session ? { session } : {},
        );
        await this.enrollments.insertOne(
          { ...enrollment, _id: enrollment.id },
          session ? { session } : {},
        );
        return pair(student, enrollment);
      },
      { env: this.env, context: { tenantId: tid, userId: input.confirmedBy } },
    );
  }
  async getById(tenantId: string, id: string) {
    const tid = tenant(tenantId),
      student = await this.students.findOne({ tenantId: tid, _id: id });
    if (!student) return null;
    const enrollment = await this.enrollment(tid, id);
    return enrollment ? pair(student, enrollment) : null;
  }
  async getByAdmissionApplicationId(tenantId: string, applicationId: string) {
    const tid = tenant(tenantId),
      student = await this.students.findOne({
        tenantId: tid,
        admissionApplicationId: applicationId,
      });
    return student ? this.getById(tid, student.id) : null;
  }
  async list(tenantId: string, filter: StudentListFilter = {}) {
    const page = await this.listPage(tenantId, {
      ...filter,
      page: Math.floor((filter.offset ?? 0) / (filter.limit ?? 100)) + 1,
      pageSize: filter.limit ?? 100,
    });
    return page.items;
  }
  async listPage(tenantId: string, filter: StudentListFilter = {}) {
    const tid = tenant(tenantId);
    const enrollmentFilter: Record<string, unknown> = { tenantId: tid, status: "ACTIVE" };
    if (filter.campusId) enrollmentFilter.campusId = filter.campusId;
    if (filter.academicYearId) enrollmentFilter.academicYearId = filter.academicYearId;
    if (filter.classId) enrollmentFilter.classId = filter.classId;
    if (filter.sectionId) enrollmentFilter.sectionId = filter.sectionId;
    const enrollments = await this.enrollments.find(enrollmentFilter).toArray();
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 25;
    const sortBy = filter.sortBy ?? "name";
    const sortDirection = filter.sortDirection ?? "ASC";
    if (!enrollments.length)
      return { items: [], page, pageSize, total: 0, totalPages: 0, sortBy, sortDirection };
    const enrollmentByStudent = new Map(enrollments.map((item) => [item.studentId, item]));
    const studentFilter: Record<string, unknown> = { tenantId: tid, _id: { $in: [...enrollmentByStudent.keys()] } };
    if (filter.status) studentFilter.status = filter.status;
    if (filter.search) {
      const search = { $regex: escapeRegex(filter.search), $options: "i" };
      studentFilter.$or = [{ name: search }, { registrationNumber: search }, { admissionNumber: search }, { phone: search }];
    }
    const total = await this.students.countDocuments(studentFilter);
    const students = await this.students
      .find(studentFilter)
      .sort({ [sortBy]: sortDirection === "ASC" ? 1 : -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return {
      items: students.map((student) => pair(student, enrollmentByStudent.get(student.id)!)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      sortBy,
      sortDirection,
    };
  }
  async changeEnrollment(tenantId: string, studentId: string, input: { campusId: string; academicYearId: string; programId: string; classId: string; sectionId?: string; rollNumber?: string; changedBy: string }) {
    const tid = tenant(tenantId);
    return withTransaction(async (session) => {
      const student = await this.students.findOne({ tenantId: tid, _id: studentId }, session ? { session } : {});
      if (!student) throw new NotFoundError("student was not found");
      const previous = await this.enrollment(tid, studentId, session ?? undefined);
      if (!previous) throw new NotFoundError("active enrollment was not found");
      const now = new Date();
      await this.enrollments.updateOne({ tenantId: tid, _id: previous.id, status: "ACTIVE" }, { $set: { status: "COMPLETED", updatedAt: now } }, session ? { session } : {});
      const enrollment: EnrollmentRecord = { id: `enrollment_${crypto.randomUUID()}`, tenantId: tid, studentId, campusId: input.campusId, academicYearId: input.academicYearId, programId: input.programId, classId: input.classId, status: "ACTIVE", enrolledAt: now, createdBy: input.changedBy, createdAt: now, updatedAt: now };
      if (input.sectionId) enrollment.sectionId = input.sectionId;
      if (input.rollNumber) enrollment.rollNumber = input.rollNumber;
      await this.enrollments.insertOne({ ...enrollment, _id: enrollment.id }, session ? { session } : {});
      return { current: pair(student, enrollment), previousEnrollmentId: previous.id };
    }, { env: this.env, context: { tenantId: tid, userId: input.changedBy } });
  }
}
function runtimeEnv(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}
function hasMongo(env: MongoEnvLike) {
  return Boolean(
    env.MONGODB_URI ||
      env.MONGODB_URI_DEV ||
      env.MONGODB_URI_PROD ||
      env.MONGODB_URI_TEST,
  );
}
export async function createStudentRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<StudentRepository> {
  if (!hasMongo(env)) return new InMemoryStudentRepository();
  const connection = await getMongoConnection(env),
    db = connection.client.db(connection.dbName),
    students = db.collection<StudentDocument>("academics_students"),
    enrollments = db.collection<EnrollmentDocument>("academics_enrollments"),
    sequences = db.collection<SequenceDocument>("academics_sequences");
  await students.createIndex(
    { tenantId: 1, admissionApplicationId: 1 },
    { unique: true },
  );
  await students.createIndex(
    { tenantId: 1, registrationNumber: 1 },
    { unique: true },
  );
  await students.createIndex(
    { tenantId: 1, admissionNumber: 1 },
    { unique: true },
  );
  await enrollments.dropIndex("tenantId_1_studentId_1_academicYearId_1").catch(() => undefined);
  await enrollments.createIndex(
    { tenantId: 1, studentId: 1 },
    { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "uq_active_student_enrollment" },
  );
  await enrollments.createIndex({ tenantId: 1, studentId: 1, academicYearId: 1 });
  await enrollments.createIndex({
    tenantId: 1,
    campusId: 1,
    academicYearId: 1,
    classId: 1,
    sectionId: 1,
  });
  return new MongoStudentRepository(students, enrollments, sequences, env);
}
let singleton: Promise<StudentRepository> | undefined;
export function studentRepository() {
  singleton ??= createStudentRepository();
  return singleton;
}
