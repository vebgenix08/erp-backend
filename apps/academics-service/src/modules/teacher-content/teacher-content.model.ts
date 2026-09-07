export type LessonPlanStatus = "DRAFT" | "READY" | "COMPLETED" | "ARCHIVED";
export type TeachingDiaryStatus = "DRAFT" | "RECORDED" | "ARCHIVED";
export type TeachingResourceStatus = "ACTIVE" | "ARCHIVED";
export type TeachingResourceType = "FILE" | "LINK";

interface TeacherScopedRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  academicYearId: string;
  campusId: string;
  subjectOfferingId: string;
  sectionId?: string;
  subjectBatchId?: string;
  subjectName: string;
  className?: string;
  sectionName?: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface LessonPlanRecord extends TeacherScopedRecord {
  planDate: string;
  title: string;
  learningObjectives: string;
  topics: string;
  learningActivities?: string;
  preparationNotes?: string;
  homework?: string;
  resourceIds: string[];
  status: LessonPlanStatus;
  readyAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface TeachingDiaryRecord extends TeacherScopedRecord {
  entryDate: string;
  topic: string;
  summary: string;
  homework?: string;
  followUp?: string;
  lessonPlanId?: string;
  status: TeachingDiaryStatus;
  recordedAt?: string;
  archivedAt?: string;
}

export interface TeachingResourceRecord extends TeacherScopedRecord {
  title: string;
  description?: string;
  resourceType: TeachingResourceType;
  fileId?: string;
  externalUrl?: string;
  fileName?: string;
  contentType?: string;
  status: TeachingResourceStatus;
  archivedAt?: string;
}

export interface TeacherContentPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
