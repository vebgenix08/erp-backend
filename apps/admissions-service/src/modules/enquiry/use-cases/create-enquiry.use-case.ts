import type { AdmissionsServiceDeps } from "../enquiry.service";
import { createEnquiry as createEnquiryService } from "../enquiry.service";
import type { EnquiryServiceContext } from "../enquiry.model";

export function createEnquiryUseCase(input: unknown, context: EnquiryServiceContext, deps?: AdmissionsServiceDeps) {
  return createEnquiryService(input, context, deps);
}
