export type StudentAttendanceStatus = "PRESENT" | "ABSENT";
export type AttendanceSessionStatus = "DRAFT" | "SUBMITTED";

export interface AttendanceStudentEntry {
  studentId: string;
  enrollmentId: string;
  studentName: string;
  rollNumber?: string;
  status: StudentAttendanceStatus;
}

export interface AttendanceSessionRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  academicYearId: string;
  campusId: string;
  date: string;
  lessonId: string;
  timetableEntryId: string;
  timetableVersionId: string;
  subjectOfferingId: string;
  sectionId?: string;
  subjectBatchId?: string;
  teachingGroupId?: string;
  subjectName: string;
  className?: string;
  sectionName?: string;
  startTime: string;
  endTime: string;
  status: AttendanceSessionStatus;
  students: AttendanceStudentEntry[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  submittedBy?: string;
  submittedAt?: string;
}

export interface TeacherAttendanceWorkspaceInput {
  date: string;
  academicYearId?: string;
  lessonId?: string;
}

export interface SaveTeacherAttendanceInput extends TeacherAttendanceWorkspaceInput {
  lessonId: string;
  expectedVersion?: number;
  submit: boolean;
  students: Array<{ studentId: string; status: StudentAttendanceStatus }>;
}

export interface TeacherAttendanceSessionView {
  id: string;
  timetableEntryId: string;
  timetableVersionId: string;
  campusId: string;
  campusName: string;
  academicYearId: string;
  subjectOfferingId: string;
  sectionId?: string;
  subjectBatchId?: string;
  teachingGroupId?: string;
  subjectName: string;
  className?: string;
  sectionName?: string;
  startTime: string;
  endTime: string;
  state: "PERMANENT" | "SUBSTITUTION";
}

export interface TeacherAttendanceWorkspace {
  date: string;
  teacherId: string;
  teacherName: string;
  academicYear: { id: string; name: string };
  sessions: TeacherAttendanceSessionView[];
  selectedSession?: TeacherAttendanceSessionView;
  attendance?: AttendanceSessionRecord;
  students: AttendanceStudentEntry[];
  canEdit: boolean;
}
