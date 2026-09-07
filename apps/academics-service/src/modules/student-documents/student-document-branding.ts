import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { internalServiceInvoker } from "@school-erp/service-client";
import { classRepository } from "../classes/classes.repository";
import { sectionRepository } from "../sections/sections.repository";

export interface StudentDocumentBranding {
  institutionName: string;
  shortName?: string;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  campusName: string;
  academicYearName: string;
  className: string;
  sectionName?: string;
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
  campus: { name: string };
  academicYear: { name: string; code: string };
}

interface FileMetadata {
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

function functionName(key: string) {
  const value = runtimeEnv()[key]?.trim();
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

export async function getStudentDocumentBranding(
  tenantId: string,
  campusId: string,
  academicYearId: string,
  classId: string,
  sectionId?: string,
): Promise<StudentDocumentBranding> {
  const invoker = internalServiceInvoker();
  const [institution, academicClass, section] = await Promise.all([
    invoker.invoke<
      { tenantId: string; campusId: string; academicYearId: string },
      InstitutionContext
    >(functionName("SETTINGS_FUNCTION_NAME"), {
      operation: "GET_INSTITUTION_CONTEXT",
      payload: { tenantId, campusId, academicYearId },
    }),
    classRepository.getById(tenantId, classId),
    sectionId ? sectionRepository.getById(tenantId, sectionId) : null,
  ]);
  const profile = institution.profile;
  const result: StudentDocumentBranding = {
    institutionName: profile?.name ?? "Institution",
    campusName: institution.campus.name,
    academicYearName: institution.academicYear.name || institution.academicYear.code,
    className: academicClass?.name ?? "Class",
    ...(profile?.shortName ? { shortName: profile.shortName } : {}),
    ...(profile?.address ? { address: profile.address } : {}),
    ...(profile?.contactPhone ? { contactPhone: profile.contactPhone } : {}),
    ...(profile?.contactEmail ? { contactEmail: profile.contactEmail } : {}),
    ...(section?.name ? { sectionName: section.name } : {}),
  };
  if (profile?.logoFileId) {
    const file = await invoker.invoke<{ tenantId: string; fileId: string }, FileMetadata | null>(
      functionName("STORAGE_FUNCTION_NAME"),
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
        result.logoBytes = await object.Body.transformToByteArray();
        const contentType = file.contentType || object.ContentType;
        if (contentType) result.logoContentType = contentType;
      }
    }
  }
  return result;
}
