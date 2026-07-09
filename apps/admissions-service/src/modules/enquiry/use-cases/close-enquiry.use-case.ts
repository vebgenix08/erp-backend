import type { AdmissionsServiceDeps } from "../enquiry.service";
import { closeEnquiry as closeEnquiryService } from "../enquiry.service";
import type { EnquiryServiceContext } from "../enquiry.model";

export function closeEnquiryUseCase(id: string, context: EnquiryServiceContext, deps?: AdmissionsServiceDeps) {
  return closeEnquiryService(id, context, deps);
}
