import type { AdmissionsServiceDeps } from "../enquiry.service";
import { updateEnquiry as updateEnquiryService } from "../enquiry.service";
import type { EnquiryServiceContext } from "../enquiry.model";

export function updateEnquiryUseCase(id: string, input: unknown, context: EnquiryServiceContext, deps?: AdmissionsServiceDeps) {
  return updateEnquiryService(id, input, context, deps);
}
