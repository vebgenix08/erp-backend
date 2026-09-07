export type MentorAssignmentStatus = "ACTIVE" | "ENDED";
export type MentorInteractionType = "MEETING" | "CALL" | "ACADEMIC" | "ATTENDANCE" | "GENERAL";
export type MentorInteractionStatus = "OPEN" | "COMPLETED" | "CANCELLED";
export type MentorInteractionVisibility = "MENTOR_ONLY" | "ACADEMIC_TEAM";

interface AuditVersion {
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface StudentMentorAssignment extends AuditVersion {
  id: string;
  tenantId: string;
  academicYearId: string;
  campusId: string;
  mentorEmployeeId: string;
  studentId: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: MentorAssignmentStatus;
}

export interface MentorInteraction extends AuditVersion {
  id: string;
  tenantId: string;
  assignmentId: string;
  academicYearId: string;
  campusId: string;
  mentorEmployeeId: string;
  studentId: string;
  interactionType: MentorInteractionType;
  interactionDate: string;
  summary: string;
  actionItems: string[];
  followUpDate?: string;
  visibility: MentorInteractionVisibility;
  status: MentorInteractionStatus;
  completedAt?: string;
}

export interface TeacherMenteeSummary {
  assignmentId: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  rollNumber?: string;
  campusId: string;
  className: string;
  sectionName?: string;
  guardianName: string;
  guardianPhone?: string;
  lastInteractionAt?: string;
  nextFollowUpDate?: string;
  openActionCount: number;
}

export interface TeacherMentoringPage {
  items: TeacherMenteeSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pendingFollowUps: number;
  openActions: number;
}

export interface TeacherMenteeWorkspace {
  mentee: TeacherMenteeSummary;
  interactions: MentorInteraction[];
}
