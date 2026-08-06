import { BadRequestError } from "@school-erp/errors";
import type { CreateCampusTransferInput } from "./campus-transfers.model";
const text=(value:unknown)=>typeof value==="string"?value.trim():"";
export function validateCreateCampusTransfer(input:unknown):CreateCampusTransferInput{
  if(!input||typeof input!=="object"||Array.isArray(input))throw new BadRequestError("campus transfer input is required");
  const value=input as Record<string,unknown>;
  const result={studentId:text(value.studentId),targetCampusId:text(value.targetCampusId),academicYearId:text(value.academicYearId),targetClassId:text(value.targetClassId),effectiveAt:text(value.effectiveAt),reason:text(value.reason),clientRequestId:text(value.clientRequestId),...(text(value.targetSectionId)?{targetSectionId:text(value.targetSectionId)}:{}),...(text(value.note)?{note:text(value.note)}:{})};
  for(const field of ["studentId","targetCampusId","academicYearId","targetClassId","effectiveAt","reason","clientRequestId"] as const)if(!result[field])throw new BadRequestError(`${field} is required`);
  if(Number.isNaN(new Date(result.effectiveAt).getTime()))throw new BadRequestError("effectiveAt must be a valid date");
  if(result.reason.length<5)throw new BadRequestError("transfer reason must contain at least 5 characters");
  return result;
}
