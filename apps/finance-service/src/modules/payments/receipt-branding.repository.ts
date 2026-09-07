import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { internalServiceInvoker } from "@school-erp/service-client";

export interface ReceiptBranding {
  institutionName: string;
  shortName?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  campusName: string;
  academicYearName: string;
  className?: string;
  sectionName?: string;
  admissionNumber?: string;
  collectedByName?: string;
  logoBytes?: Uint8Array;
  logoContentType?: string;
}

interface InstitutionContext {
  profile: {
    name: string;
    shortName?: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
    logoFileId?: string;
  } | null;
  campus: { id: string; name: string; code: string };
  academicYear: { id: string; name: string; code: string };
}

interface StudentFinanceContext {
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
}

interface EmployeeContext {
  id: string;
  fullName: string;
}

interface FileMetadata {
  id: string;
  bucket: string;
  storageKey: string;
  contentType: string;
}

function runtimeEnv() {
  return (
    (
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {}
  );
}

function requiredFunction(name: string) {
  const value = runtimeEnv()[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function getReceiptBranding(
  tenantId: string,
  campusId: string,
  academicYearId: string,
  classId?: string,
  sectionId?: string,
  studentId?: string,
  collectedBy?: string,
): Promise<ReceiptBranding> {
  const invoker = internalServiceInvoker();
  const [institution, student, collector] = await Promise.all([
    invoker.invoke<
      { tenantId: string; campusId: string; academicYearId: string },
      InstitutionContext
    >(requiredFunction("SETTINGS_FUNCTION_NAME"), {
      operation: "GET_INSTITUTION_CONTEXT",
      payload: { tenantId, campusId, academicYearId },
    }),
    studentId
      ? invoker.invoke<
          {
            tenantId: string;
            studentId: string;
            classId?: string;
            sectionId?: string;
          },
          StudentFinanceContext
        >(requiredFunction("ACADEMICS_FUNCTION_NAME"), {
          operation: "GET_STUDENT_FINANCE_CONTEXT",
          payload: {
            tenantId,
            studentId,
            ...(classId ? { classId } : {}),
            ...(sectionId ? { sectionId } : {}),
          },
        })
      : null,
    collectedBy
      ? invoker.invoke<{ tenantId: string; principalId: string }, EmployeeContext | null>(
          requiredFunction("IDENTITY_FUNCTION_NAME"),
          {
            operation: "GET_EMPLOYEE_BY_PRINCIPAL",
            payload: { tenantId, principalId: collectedBy },
          },
        )
      : null,
  ]);

  const profile = institution.profile;
  const branding: ReceiptBranding = {
    institutionName: profile?.name ?? "Institution",
    campusName: institution.campus.name,
    academicYearName: institution.academicYear.name || institution.academicYear.code,
    ...(profile?.shortName ? { shortName: profile.shortName } : {}),
    ...(profile?.address ? { address: profile.address } : {}),
    ...(profile?.contactEmail ? { contactEmail: profile.contactEmail } : {}),
    ...(profile?.contactPhone ? { contactPhone: profile.contactPhone } : {}),
    ...(student?.className ? { className: student.className } : {}),
    ...(student?.sectionName ? { sectionName: student.sectionName } : {}),
    ...(student?.admissionNumber ? { admissionNumber: student.admissionNumber } : {}),
    ...(collector?.fullName ? { collectedByName: collector.fullName } : {}),
  };

  if (profile?.logoFileId) {
    const file = await invoker.invoke<{ tenantId: string; fileId: string }, FileMetadata | null>(
      requiredFunction("STORAGE_FUNCTION_NAME"),
      {
        operation: "GET_FILE_METADATA",
        payload: { tenantId, fileId: profile.logoFileId },
      },
    );
    if (file) {
      const object = await new S3Client({}).send(
        new GetObjectCommand({ Bucket: file.bucket, Key: file.storageKey }),
      );
      if (object.Body) {
        branding.logoBytes = await object.Body.transformToByteArray();
        const contentType = file.contentType || object.ContentType;
        if (contentType) branding.logoContentType = contentType;
      }
    }
  }
  return branding;
}
