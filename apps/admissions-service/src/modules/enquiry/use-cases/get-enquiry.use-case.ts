import type { AdmissionsServiceDeps } from "../enquiry.service";
import { getEnquiry as getEnquiryService } from "../enquiry.service";
import type { EnquiryServiceContext } from "../enquiry.model";

export function getEnquiryUseCase(id: string, context: EnquiryServiceContext, deps?: AdmissionsServiceDeps) {
  return getEnquiryService(id, context, deps);
}
