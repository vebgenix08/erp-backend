import type {
  TeacherWorkloadWorkspace,
  WorkloadAssignmentView,
  WorkloadLessonView,
} from "../teacher-workload/teacher-workload.model";

export interface TeacherClassWorkspaceInput {
  academicYearId?: string;
  subjectOfferingId: string;
}

export interface TeacherClassStudentView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  registrationNumber: string;
  rollNumber?: string;
  status: string;
}

export interface TeacherClassWorkspace {
  teacher: TeacherWorkloadWorkspace["teacher"];
  academicYear: TeacherWorkloadWorkspace["academicYear"];
  assignment: WorkloadAssignmentView;
  students: TeacherClassStudentView[];
  timetableEntries: WorkloadLessonView[];
}
