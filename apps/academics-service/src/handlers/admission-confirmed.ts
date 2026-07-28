import { createRuntimeEventPublisher, type AdmissionConfirmedEvent, type StudentEnrolledEvent } from "@school-erp/events";
import { createStudentFromAdmission } from "../modules/students/students.service";
import { hydrateAcademicsRuntimeConfig } from "./runtime-config";

interface EventBridgeEnvelope {
  detail: AdmissionConfirmedEvent;
}

export async function handler(event: EventBridgeEnvelope): Promise<void> {
  await hydrateAcademicsRuntimeConfig();
  const domainEvent = event.detail;
  if (domainEvent.type !== "admissions.admission.confirmed.v1" || domainEvent.source !== "erp.admissions") {
    throw new Error("unsupported admissions event");
  }
  const result = await createStudentFromAdmission(domainEvent.data, domainEvent.tenantId);
  const enrolledEvent: StudentEnrolledEvent = {
    id: `student-enrolled-${domainEvent.id}`,
    type: "academics.student.enrolled.v1",
    source: "erp.academics",
    tenantId: domainEvent.tenantId,
    occurredAt: result.enrollment.enrolledAt,
    ...(domainEvent.correlationId ? { correlationId: domainEvent.correlationId } : {}),
    data: {
      admissionApplicationId: result.admissionApplicationId,
      studentId: result.id,
      studentName: result.name,
      registrationNumber: result.registrationNumber,
      enrollmentId: result.enrollment.id,
      campusId: result.enrollment.campusId,
      academicYearId: result.enrollment.academicYearId,
      programId: result.enrollment.programId,
      classId: result.enrollment.classId,
      ...(result.enrollment.sectionId ? { sectionId: result.enrollment.sectionId } : {}),
      enrolledAt: result.enrollment.enrolledAt,
      createdBy: result.createdBy,
    },
  };
  await createRuntimeEventPublisher("erp.academics").publish(enrolledEvent);
}
