import { ValidationError } from "@school-erp/errors";
import type {
  LessonPlanStatus,
  TeachingDiaryStatus,
  TeachingResourceStatus,
  TeachingResourceType,
} from "./teacher-content.model";

const object = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const requiredText = (value: unknown, field: string, maximumLength = 5000) => {
  const result = optionalText(value);
  if (!result) throw new ValidationError([{ field, message: `${field} is required` }]);
  if (result.length > maximumLength)
    throw new ValidationError([
      { field, message: `${field} must not exceed ${maximumLength} characters` },
    ]);
  return result;
};
const boundedOptionalText = (value: unknown, field: string, maximumLength: number) => {
  const result = optionalText(value);
  if (result && result.length > maximumLength)
    throw new ValidationError([
      { field, message: `${field} must not exceed ${maximumLength} characters` },
    ]);
  return result;
};
const date = (value: unknown, field: string) => {
  const result = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00.000Z`))) {
    throw new ValidationError([{ field, message: `${field} must be a valid YYYY-MM-DD date` }]);
  }
  return result;
};
const positiveInteger = (value: unknown, fallback: number, maximum: number) => {
  const result = Number(value ?? fallback);
  return Number.isInteger(result) && result > 0 ? Math.min(result, maximum) : fallback;
};
const version = (value: unknown) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
const stringList = (value: unknown, field: string, maximum = 20) => {
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new ValidationError([
      { field, message: `${field} must contain at most ${maximum} non-empty values` },
    ]);
  }
  return [...new Set(value.map((item) => String(item).trim()))];
};

function pageInput<Status extends string>(value: unknown, statuses: readonly Status[]) {
  const input = object(value);
  const status = optionalText(input.status) as Status | undefined;
  if (status && !statuses.includes(status))
    throw new ValidationError([{ field: "status", message: "status is invalid" }]);
  return {
    ...(optionalText(input.academicYearId)
      ? { academicYearId: optionalText(input.academicYearId)! }
      : {}),
    ...(optionalText(input.subjectOfferingId)
      ? { subjectOfferingId: optionalText(input.subjectOfferingId)! }
      : {}),
    ...(status ? { status } : {}),
    page: positiveInteger(input.page, 1, 100_000),
    pageSize: positiveInteger(input.pageSize, 20, 100),
  };
}

export const validateLessonPlanPageInput = (value: unknown) =>
  pageInput<LessonPlanStatus>(value, ["DRAFT", "READY", "COMPLETED", "ARCHIVED"]);
export const validateTeachingDiaryPageInput = (value: unknown) =>
  pageInput<TeachingDiaryStatus>(value, ["DRAFT", "RECORDED", "ARCHIVED"]);
export const validateTeachingResourcePageInput = (value: unknown) =>
  pageInput<TeachingResourceStatus>(value, ["ACTIVE", "ARCHIVED"]);

export function validateSaveLessonPlanInput(value: unknown) {
  const input = object(value);
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    ...(version(input.expectedVersion) ? { expectedVersion: version(input.expectedVersion)! } : {}),
    academicYearId: requiredText(input.academicYearId, "academicYearId", 160),
    subjectOfferingId: requiredText(input.subjectOfferingId, "subjectOfferingId", 160),
    planDate: date(input.planDate, "planDate"),
    title: requiredText(input.title, "title", 180),
    learningObjectives: requiredText(input.learningObjectives, "learningObjectives", 3000),
    topics: requiredText(input.topics, "topics", 3000),
    ...(boundedOptionalText(input.learningActivities, "learningActivities", 3000)
      ? {
          learningActivities: boundedOptionalText(
            input.learningActivities,
            "learningActivities",
            3000,
          )!,
        }
      : {}),
    ...(boundedOptionalText(input.preparationNotes, "preparationNotes", 3000)
      ? { preparationNotes: boundedOptionalText(input.preparationNotes, "preparationNotes", 3000)! }
      : {}),
    ...(boundedOptionalText(input.homework, "homework", 2000)
      ? { homework: boundedOptionalText(input.homework, "homework", 2000)! }
      : {}),
    resourceIds: stringList(input.resourceIds, "resourceIds"),
  };
}

export function validateSaveTeachingDiaryInput(value: unknown) {
  const input = object(value);
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    ...(version(input.expectedVersion) ? { expectedVersion: version(input.expectedVersion)! } : {}),
    academicYearId: requiredText(input.academicYearId, "academicYearId", 160),
    subjectOfferingId: requiredText(input.subjectOfferingId, "subjectOfferingId", 160),
    entryDate: date(input.entryDate, "entryDate"),
    topic: requiredText(input.topic, "topic", 240),
    summary: requiredText(input.summary, "summary", 4000),
    ...(boundedOptionalText(input.homework, "homework", 2000)
      ? { homework: boundedOptionalText(input.homework, "homework", 2000)! }
      : {}),
    ...(boundedOptionalText(input.followUp, "followUp", 2000)
      ? { followUp: boundedOptionalText(input.followUp, "followUp", 2000)! }
      : {}),
    ...(optionalText(input.lessonPlanId)
      ? { lessonPlanId: optionalText(input.lessonPlanId)! }
      : {}),
  };
}

export function validateSaveTeachingResourceInput(value: unknown) {
  const input = object(value);
  const resourceType = requiredText(input.resourceType, "resourceType", 10) as TeachingResourceType;
  if (!(["FILE", "LINK"] as const).includes(resourceType))
    throw new ValidationError([
      { field: "resourceType", message: "resourceType must be FILE or LINK" },
    ]);
  const fileId = optionalText(input.fileId);
  const externalUrl = optionalText(input.externalUrl);
  if (resourceType === "FILE" && !fileId)
    throw new ValidationError([
      { field: "fileId", message: "fileId is required for a file resource" },
    ]);
  if (resourceType === "LINK") {
    if (!externalUrl)
      throw new ValidationError([
        { field: "externalUrl", message: "externalUrl is required for a link resource" },
      ]);
    try {
      const url = new URL(externalUrl);
      if (!(["http:", "https:"] as string[]).includes(url.protocol))
        throw new Error("unsupported protocol");
    } catch {
      throw new ValidationError([
        { field: "externalUrl", message: "externalUrl must be a valid HTTP or HTTPS URL" },
      ]);
    }
  }
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    ...(version(input.expectedVersion) ? { expectedVersion: version(input.expectedVersion)! } : {}),
    academicYearId: requiredText(input.academicYearId, "academicYearId", 160),
    subjectOfferingId: requiredText(input.subjectOfferingId, "subjectOfferingId", 160),
    title: requiredText(input.title, "title", 180),
    ...(boundedOptionalText(input.description, "description", 2000)
      ? { description: boundedOptionalText(input.description, "description", 2000)! }
      : {}),
    resourceType,
    ...(fileId ? { fileId } : {}),
    ...(externalUrl ? { externalUrl } : {}),
    ...(optionalText(input.fileName) ? { fileName: optionalText(input.fileName)! } : {}),
    ...(optionalText(input.contentType) ? { contentType: optionalText(input.contentType)! } : {}),
  };
}

export function validateTeacherContentTransitionInput(value: unknown) {
  const input = object(value);
  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    throw new ValidationError([
      { field: "expectedVersion", message: "expectedVersion must be a positive integer" },
    ]);
  return { id: requiredText(input.id, "id", 160), expectedVersion };
}
