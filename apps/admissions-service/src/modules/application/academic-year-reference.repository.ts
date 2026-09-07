import { BadRequestError } from "@school-erp/errors";
import { internalServiceInvoker, type InternalServiceInvoker } from "@school-erp/service-client";

interface AcademicYearReference {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface AcademicYearReferenceReader {
  getCode(tenantId: string, academicYearId: string): Promise<string>;
}

export class SettingsAcademicYearReferenceReader implements AcademicYearReferenceReader {
  constructor(
    private readonly functionName: string,
    private readonly invoker: InternalServiceInvoker = internalServiceInvoker(),
  ) {}

  async getCode(tenantId: string, academicYearId: string) {
    const record = await this.invoker.invoke<
      { tenantId: string; academicYearId: string },
      AcademicYearReference
    >(this.functionName, {
      operation: "GET_ACADEMIC_YEAR",
      payload: { tenantId, academicYearId },
    });
    return normalizeAcademicYearCode(record.code);
  }
}

export function normalizeAcademicYearCode(value: string) {
  const matched = value.trim().match(/^(\d{2,4})\D+(\d{2,4})$/);
  if (!matched) {
    throw new BadRequestError("academic year code must identify a year range");
  }
  return `${String(Number(matched[1]) % 100).padStart(2, "0")}-${String(Number(matched[2]) % 100).padStart(2, "0")}`;
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

let singleton: AcademicYearReferenceReader | undefined;

export function academicYearReferenceReader() {
  if (singleton) return singleton;
  const functionName = runtimeEnv().SETTINGS_FUNCTION_NAME?.trim();
  if (!functionName) throw new BadRequestError("SETTINGS_FUNCTION_NAME is not configured");
  return (singleton = new SettingsAcademicYearReferenceReader(functionName));
}
