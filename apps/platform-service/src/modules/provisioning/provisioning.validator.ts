import { ValidationError } from "@school-erp/errors";
import { validateEmail, validateNonEmptyString } from "@school-erp/validation";
import type { ProvisionTenantInput } from "./provisioning.model";

export function validateProvisionTenantInput(input: Record<string, unknown>): ProvisionTenantInput {
  const organizationName=validateNonEmptyString(input.organizationName,"organizationName"); const adminName=validateNonEmptyString(input.primaryAdminFullName,"primaryAdminFullName"); const email=validateEmail(input.primaryAdminEmail,"primaryAdminEmail"); const requestId=validateNonEmptyString(input.clientRequestId,"clientRequestId");
  const slug=typeof input.slug==="string"?input.slug.trim().toLowerCase():""; const errors:Array<{field:string;message:string}>=[];
  if(!organizationName.success)errors.push({field:"organizationName",message:"organizationName is required"}); if(!adminName.success)errors.push({field:"primaryAdminFullName",message:"primaryAdminFullName is required"}); if(!email.success)errors.push({field:"primaryAdminEmail",message:"primaryAdminEmail is invalid"}); if(!requestId.success)errors.push({field:"clientRequestId",message:"clientRequestId is required"}); if(!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(slug))errors.push({field:"slug",message:"slug must be 3-63 lowercase letters, numbers, or hyphens"}); if(errors.length)throw new ValidationError(errors);
  return {organizationName:organizationName.success?organizationName.value:"",slug,primaryAdminFullName:adminName.success?adminName.value:"",primaryAdminEmail:email.success?email.value.toLowerCase():"",clientRequestId:requestId.success?requestId.value:""};
}
