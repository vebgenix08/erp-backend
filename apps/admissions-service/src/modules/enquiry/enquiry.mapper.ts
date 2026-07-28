import type { EnquiryRecord, EnquiryView } from "./enquiry.model";

export function toEnquiryView(enquiry: EnquiryRecord | null): EnquiryView | null {
  if (!enquiry) {
    return null;
  }
  return {
    id: enquiry.id,
    tenantId: enquiry.tenantId,
    enquiryNumber: enquiry.enquiryNumber,
    campusId: enquiry.campusId,
    academicYearId: enquiry.academicYearId,
    academicTargetId: enquiry.academicTargetId,
    studentName: enquiry.studentName,
    dateOfBirth: enquiry.dateOfBirth?.toISOString(),
    gender: enquiry.gender,
    parentName: enquiry.parentName,
    phone: enquiry.phone,
    email: enquiry.email,
    interestedClass: enquiry.interestedClass,
    source: enquiry.source,
    status: enquiry.status,
    notes: enquiry.notes,
    templateId: enquiry.templateId,
    templateVersion: enquiry.templateVersion,
    customFields: enquiry.customFields ? { ...enquiry.customFields } : undefined,
    createdBy: enquiry.createdBy,
    createdAt: enquiry.createdAt.toISOString(),
    updatedAt: enquiry.updatedAt.toISOString(),
    closedAt: enquiry.closedAt?.toISOString(),
  };
}
