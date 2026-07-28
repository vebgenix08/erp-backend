import { BadRequestError } from "@school-erp/errors";
import type {
  CreateFeeHeadInput,
  CreateFeeMappingInput,
  CreateFeeScheduleInput,
  CreateFeeStructureInput,
  FeeCollectionPolicy,
  FeeHeadCategory,
  FeeSchedulePattern,
} from "./fee-configuration.model";

const categories: FeeHeadCategory[] = [
  "TUITION",
  "ADMISSION",
  "EXAM",
  "LIBRARY",
  "LAB",
  "TRANSPORT",
  "HOSTEL",
  "OTHER",
];
const object = (input: unknown, message: string): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError(message);
  return input as Record<string, unknown>;
};
const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestError(`${field} is required`);
  return value.trim();
};
const integer = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new BadRequestError(`${field} must be a non-negative integer`);
  return value;
};
const scope = (value: Record<string, unknown>) => ({
  campusId: text(value.campusId, "campusId"),
  academicYearId: text(value.academicYearId, "academicYearId"),
});

export function validateFeeHead(input: unknown): CreateFeeHeadInput {
  const value = object(input, "fee head input is required");
  const category = text(
    value.category,
    "category",
  ).toUpperCase() as FeeHeadCategory;
  if (!categories.includes(category))
    throw new BadRequestError("category is invalid");
  const result: CreateFeeHeadInput = {
    name: text(value.name, "name"),
    category,
    refundable: value.refundable === true,
  };
  if (typeof value.description === "string" && value.description.trim())
    result.description = value.description.trim();
  return result;
}

export function validateFeeSchedule(input: unknown): CreateFeeScheduleInput {
  const value = object(input, "fee schedule input is required");
  const pattern = text(value.pattern, "pattern") as FeeSchedulePattern;
  const collectionPolicy = text(
    value.collectionPolicy,
    "collectionPolicy",
  ) as FeeCollectionPolicy;
  if (!["ANNUAL", "ONE_TIME", "PERIODIC", "MANUAL"].includes(pattern))
    throw new BadRequestError("pattern is invalid");
  if (!["FULL_ONLY", "PARTIAL_ALLOWED"].includes(collectionPolicy))
    throw new BadRequestError("collectionPolicy is invalid");
  return {
    ...scope(value),
    name: text(value.name, "name"),
    pattern,
    collectionPolicy,
  };
}

export function validateFeeStructure(input: unknown): CreateFeeStructureInput {
  const value = object(input, "fee structure input is required");
  if (!Array.isArray(value.components) || value.components.length === 0)
    throw new BadRequestError("at least one fee component is required");
  const components = value.components.map((item, index) => {
    const component = object(item, `component ${index + 1} is invalid`);
    const amountMinor = integer(
      component.amountMinor,
      `components[${index}].amountMinor`,
    );
    if (amountMinor === 0)
      throw new BadRequestError(
        `components[${index}].amountMinor must be greater than zero`,
      );
    return {
      feeHeadId: text(component.feeHeadId, `components[${index}].feeHeadId`),
      amountMinor,
      allocationPriority:
        component.allocationPriority === undefined
          ? index + 1
          : integer(
              component.allocationPriority,
              `components[${index}].allocationPriority`,
            ),
    };
  });
  if (
    new Set(components.map((item) => item.feeHeadId)).size !== components.length
  )
    throw new BadRequestError("fee heads cannot be duplicated in a structure");
  if (components.some((item) => item.allocationPriority <= 0))
    throw new BadRequestError("allocation priority must be greater than zero");
  if (
    new Set(components.map((item) => item.allocationPriority)).size !==
    components.length
  )
    throw new BadRequestError(
      "allocation priorities must be unique within a fee structure",
    );
  return { ...scope(value), name: text(value.name, "name"), components };
}

export function validateFeeMapping(input: unknown): CreateFeeMappingInput {
  const value = object(input, "fee mapping input is required");
  const target = object(value.target, "target is required");
  const normalizedTarget: CreateFeeMappingInput["target"] = {
    classId: text(target.classId, "target.classId"),
  };
  if (typeof target.programId === "string" && target.programId.trim())
    normalizedTarget.programId = target.programId.trim();
  if (typeof target.sectionId === "string" && target.sectionId.trim())
    normalizedTarget.sectionId = target.sectionId.trim();
  return {
    ...scope(value),
    structureId: text(value.structureId, "structureId"),
    scheduleId: text(value.scheduleId, "scheduleId"),
    target: normalizedTarget,
  };
}

export function validateScope(input: unknown): {
  campusId: string;
  academicYearId: string;
} {
  return scope(object(input, "finance scope is required"));
}
