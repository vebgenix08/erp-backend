import { ObjectId } from "mongodb";
import { BadRequestError } from "@school-erp/errors";

export function isObjectId(value: unknown): value is ObjectId {
  return value instanceof ObjectId;
}

export function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && ObjectId.isValid(value);
}

export function toObjectId(value: string | ObjectId): ObjectId {
  if (value instanceof ObjectId) {
    return value;
  }
  if (!ObjectId.isValid(value)) {
    throw new BadRequestError("Invalid object id");
  }
  return new ObjectId(value);
}

export function toObjectIdString(value: string | ObjectId): string {
  return value instanceof ObjectId ? value.toHexString() : toObjectId(value).toHexString();
}

export function tryObjectId(value: unknown): ObjectId | null {
  return isObjectId(value) ? value : isObjectIdString(value) ? new ObjectId(value) : null;
}
