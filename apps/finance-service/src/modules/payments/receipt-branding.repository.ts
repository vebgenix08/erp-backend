import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";

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

interface NamedAcademicDocument {
  _id: string;
  tenantId: string;
  name?: unknown;
}

const env = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};

export async function getReceiptBranding(
  tenantId: string,
  campusId: string,
  academicYearId: string,
  classId?: string,
  sectionId?: string,
  studentId?: string,
  collectedBy?: string,
  runtime: MongoEnvLike = env(),
): Promise<ReceiptBranding> {
  if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST) {
    return { institutionName: "Institution", campusName: "Campus", academicYearName: "Academic year" };
  }
  const connection = await getMongoConnection(runtime);
  const stage = runtime.environment ?? runtime.STAGE ?? runtime.NODE_ENV ?? "dev";
  const settings = connection.client.db(`settings-service_${stage}`);
  const storage = connection.client.db(`storage-service_${stage}`);
  const academics = connection.client.db(`academics-service_${stage}`);
  const identity = connection.client.db(`identity-service_${stage}`);
  const [profile, campus, year, academicClass, section, student, collector, enrollment] = await Promise.all([
    settings.collection("settings_institution_profiles").findOne({ tenantId }),
    settings.collection("settings_campuses").findOne({ tenantId, id: campusId }),
    settings.collection("settings_academic_years").findOne({ tenantId, id: academicYearId }),
    classId ? academics.collection<NamedAcademicDocument>("academics_classes").findOne({ tenantId, _id: classId }) : null,
    sectionId ? academics.collection<NamedAcademicDocument>("academics_sections").findOne({ tenantId, _id: sectionId }) : null,
    studentId ? academics.collection("academics_students").findOne({ tenantId, id: studentId }) : null,
    collectedBy ? identity.collection("identity_employees").findOne({ tenantId, $or: [{ userId: collectedBy }, { id: collectedBy }] }) : null,
    studentId
      ? academics.collection("academics_enrollments").findOne({
          tenantId,
          studentId,
          campusId,
          academicYearId,
          status: "ACTIVE",
        })
      : null,
  ]);
  const resolvedClass =
    academicClass ??
    (typeof enrollment?.classId === "string"
      ? await academics.collection<NamedAcademicDocument>("academics_classes").findOne({
          tenantId,
          _id: enrollment.classId,
        })
      : null);
  const resolvedSection =
    section ??
    (typeof enrollment?.sectionId === "string"
      ? await academics.collection<NamedAcademicDocument>("academics_sections").findOne({
          tenantId,
          _id: enrollment.sectionId,
        })
      : null);
  const branding: ReceiptBranding = {
    institutionName: String(profile?.name ?? "Institution"),
    campusName: String(campus?.name ?? "Campus"),
    academicYearName: String(year?.name ?? year?.code ?? "Academic year"),
  };
  if (typeof profile?.shortName === "string") branding.shortName = profile.shortName;
  if (typeof profile?.address === "string") branding.address = profile.address;
  if (typeof profile?.contactEmail === "string") branding.contactEmail = profile.contactEmail;
  if (typeof profile?.contactPhone === "string") branding.contactPhone = profile.contactPhone;
  if (typeof resolvedClass?.name === "string") branding.className = resolvedClass.name;
  if (typeof resolvedSection?.name === "string") branding.sectionName = resolvedSection.name;
  if (typeof student?.admissionNumber === "string") branding.admissionNumber = student.admissionNumber;
  if (typeof collector?.fullName === "string") branding.collectedByName = collector.fullName;
  if (typeof profile?.logoFileId === "string") {
    const file = await storage.collection("storage_files").findOne({
      tenantId,
      id: profile.logoFileId,
      status: "AVAILABLE",
    });
    if (file && typeof file.bucket === "string" && typeof file.storageKey === "string") {
      const object = await new S3Client({}).send(new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.storageKey,
      }));
      if (object.Body) {
        branding.logoBytes = await object.Body.transformToByteArray();
        const contentType =
          typeof file.contentType === "string" ? file.contentType : object.ContentType;
        if (contentType) branding.logoContentType = contentType;
      }
    }
  }
  return branding;
}
