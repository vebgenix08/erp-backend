export type AssessmentDefinitionStatus = "DRAFT" | "OPEN" | "CLOSED";
export type MarksSheetStatus = "DRAFT" | "SUBMITTED";
export type StudentMarkStatus = "NOT_RECORDED" | "RECORDED" | "ABSENT";

export interface AssessmentDefinitionRecord {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  classId?: string;
  name: string;
  assessmentDate: string;
  attendanceWindowStart: string;
  attendanceWindowEnd: string;
  maximumMarks: number;
  sequence: number;
  status: AssessmentDefinitionStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface MarksSheetStudentEntry {
  studentId: string;
  enrollmentId: string;
  studentName: string;
  rollNumber?: string;
  status: StudentMarkStatus;
  marks?: number;
}

export interface MarksSheetRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  academicYearId: string;
  campusId: string;
  assessmentId: string;
  subjectOfferingId: string;
  subjectName: string;
  className?: string;
  sectionName?: string;
  sectionId?: string;
  subjectBatchId?: string;
  status: MarksSheetStatus;
  students: MarksSheetStudentEntry[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  submittedBy?: string;
  submittedAt?: string;
}

export interface TeacherMarksOffering {
  id: string;
  campusId: string;
  campusName: string;
  subjectName: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  subjectBatchId?: string;
  subjectBatchName?: string;
}

export interface TeacherMarksStudent extends MarksSheetStudentEntry {
  registrationNumber: string;
  attendanceAttended: number;
  attendanceHeld: number;
  attendancePercentage?: number;
}

export interface TeacherMarksWorkspace {
  teacher: { id: string; name: string };
  academicYear: { id: string; name: string };
  offerings: TeacherMarksOffering[];
  assessments: AssessmentDefinitionRecord[];
  selectedOffering?: TeacherMarksOffering;
  selectedAssessment?: AssessmentDefinitionRecord;
  sheet?: MarksSheetRecord;
  students: TeacherMarksStudent[];
  summary: {
    students: number;
    recorded: number;
    absent: number;
    pending: number;
    averageMarks?: number;
    highestMarks?: number;
    lowestMarks?: number;
  };
  canEdit: boolean;
}
