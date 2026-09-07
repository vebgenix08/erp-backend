export type SectionFollowUpType = "ACADEMIC" | "ATTENDANCE" | "GENERAL";
export type SectionFollowUpStatus = "OPEN" | "RESOLVED";
export type SectionFollowUpVisibility = "CLASS_TEACHER_ONLY" | "ACADEMIC_TEAM";

export interface SectionStudentFollowUp {
  id: string;
  tenantId: string;
  academicYearId: string;
  campusId: string;
  classId: string;
  sectionId: string;
  studentId: string;
  employeeId: string;
  followUpType: SectionFollowUpType;
  summary: string;
  nextAction?: string;
  followUpDate?: string;
  visibility: SectionFollowUpVisibility;
  status: SectionFollowUpStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface TeacherSectionStudent {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  registrationNumber: string;
  rollNumber?: string;
  guardianName: string;
  guardianPhone?: string;
  attendanceStatusToday?: "PRESENT" | "ABSENT";
  openFollowUps: number;
}

export interface TeacherSectionTimetableEntry {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string;
}

export interface TeacherSectionWorkspace {
  section: { id: string; name: string; classId: string; className: string; campusId: string };
  availableSections: Array<{ id: string; name: string; className: string; campusId: string }>;
  summary: {
    totalStudents: number;
    presentToday: number;
    absentToday: number;
    attendanceSessionsToday: number;
    openFollowUps: number;
    marksSheetsSubmitted: number;
    marksSheetsPending: number;
  };
  students: TeacherSectionStudent[];
  timetable: TeacherSectionTimetableEntry[];
  followUps: SectionStudentFollowUp[];
}
