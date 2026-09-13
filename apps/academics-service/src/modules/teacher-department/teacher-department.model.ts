export interface TeacherDepartmentWorkspaceInput {
  academicYearId?: string;
  responsibilityId?: string;
  campusId?: string;
  date?: string;
}

export interface DepartmentFacultyView {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  staffType?: string;
  employmentType?: string;
  joiningDate?: string;
  status: string;
  loginStatus: string;
  assignmentCount: number;
  requiredPeriods: number;
  scheduledPeriods: number;
  menteeCount: number;
  responsibilityTypes: string[];
  allocations: DepartmentFacultyAllocationView[];
  schedule: DepartmentFacultyScheduleView[];
}

export interface DepartmentFacultyAllocationView {
  teachingAssignmentId: string;
  subjectOfferingId: string;
  subjectName: string;
  className: string;
  sectionName?: string;
  requiredPeriods: number;
  scheduledPeriods: number;
}

export interface DepartmentFacultyScheduleView {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  periodLabel: string;
  subjectName: string;
  className: string;
  sectionName: string;
}

export interface DepartmentCoverageView {
  subjectOfferingId: string;
  subjectName: string;
  className: string;
  sectionName?: string;
  requiredPeriods: number;
  scheduledPeriods: number;
  teacherNames: string[];
  status: "READY" | "UNASSIGNED" | "INCOMPLETE";
}

export interface DepartmentTimetableView {
  workingDays: string[];
  slots: Array<{
    id: string;
    sequence: number;
    label: string;
    startTime: string;
    endTime: string;
    slotType: string;
    applicableDays?: string[];
  }>;
  entries: Array<{
    id: string;
    dayOfWeek: string;
    periodSlotIds: string[];
    subjectName: string;
    teacherNames: string[];
    teacherEmployeeIds: string[];
  }>;
  sectionId: string;
  className: string;
  sectionName: string;
  versionId?: string;
  versionName?: string;
  status: "PUBLISHED" | "DRAFT" | "NOT_CREATED";
  entryCount: number;
  conflictCount: number;
}

export interface DepartmentCompletionView {
  sectionId: string;
  className: string;
  sectionName: string;
  attendanceStatus: "SUBMITTED" | "PENDING";
  submittedAttendanceSessions: number;
  marksSubmitted: number;
  marksPending: number;
}

export interface DepartmentIssueView {
  code: string;
  severity: "ERROR" | "WARNING";
  title: string;
  scope: string;
  action: string;
}

export interface TeacherDepartmentWorkspace {
  scope: {
    responsibilityId: string;
    campusId: string;
    campusName: string;
    academicUnitId?: string;
    programId?: string;
    programName?: string;
  };
  availableScopes: Array<{
    responsibilityId: string;
    campusId: string;
    campusName: string;
    academicUnitId?: string;
    programId?: string;
    programName?: string;
  }>;
  academicYear: { id: string; name: string };
  date: string;
  summary: {
    faculty: number;
    classes: number;
    sections: number;
    subjectOfferings: number;
    unassignedOfferings: number;
    incompleteAllocations: number;
    publishedTimetables: number;
    pendingAttendanceSections: number;
    pendingMarksSheets: number;
  };
  faculty: DepartmentFacultyView[];
  coverage: DepartmentCoverageView[];
  timetables: DepartmentTimetableView[];
  completion: DepartmentCompletionView[];
  issues: DepartmentIssueView[];
}
