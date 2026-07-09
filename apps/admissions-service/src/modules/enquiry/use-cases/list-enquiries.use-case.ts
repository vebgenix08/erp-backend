import type { AdmissionsServiceDeps } from "../enquiry.service";
import { listEnquiries as listEnquiriesService } from "../enquiry.service";
import type { EnquiryListFilter, EnquiryServiceContext } from "../enquiry.model";

export function listEnquiriesUseCase(context: EnquiryServiceContext, deps?: AdmissionsServiceDeps, filter?: EnquiryListFilter) {
  return listEnquiriesService(context, deps, filter);
}
