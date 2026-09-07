import { internalServiceInvoker, type InternalServiceInvoker } from "@school-erp/service-client";
import type { PlanningDocument } from "./planning-store.repository";

export interface PlanningReferenceReader {
  getEmployee(tenantId: string, employeeId: string): Promise<PlanningDocument>;
  getEmployees?(tenantId: string, employeeIds: string[]): Promise<PlanningDocument[]>;
  getEmployeeByPrincipal(tenantId: string, principalId: string): Promise<PlanningDocument | null>;
  getAcademicYear(tenantId: string, academicYearId: string): Promise<PlanningDocument>;
  listAcademicYears(tenantId: string): Promise<PlanningDocument[]>;
  listCampuses(tenantId: string): Promise<PlanningDocument[]>;
}

export class InternalPlanningReferenceReader implements PlanningReferenceReader {
  constructor(
    private readonly identityFunctionName: string,
    private readonly settingsFunctionName: string,
    private readonly invoker: InternalServiceInvoker = internalServiceInvoker(),
  ) {}

  getEmployee(tenantId: string, employeeId: string) {
    return this.invoker.invoke<{ tenantId: string; employeeId: string }, PlanningDocument>(
      this.identityFunctionName,
      {
        operation: "GET_EMPLOYEE",
        payload: { tenantId, employeeId },
      },
    );
  }

  async getEmployees(tenantId: string, employeeIds: string[]) {
    const ids = [...new Set(employeeIds)];
    const records: PlanningDocument[] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      records.push(
        ...(await this.invoker.invoke<
          { tenantId: string; employeeIds: string[] },
          PlanningDocument[]
        >(this.identityFunctionName, {
          operation: "GET_EMPLOYEES",
          payload: { tenantId, employeeIds: ids.slice(offset, offset + 100) },
        })),
      );
    }
    return records;
  }

  getEmployeeByPrincipal(tenantId: string, principalId: string) {
    return this.invoker.invoke<{ tenantId: string; principalId: string }, PlanningDocument | null>(
      this.identityFunctionName,
      {
        operation: "GET_EMPLOYEE_BY_PRINCIPAL",
        payload: { tenantId, principalId },
      },
    );
  }

  getAcademicYear(tenantId: string, academicYearId: string) {
    return this.invoker.invoke<{ tenantId: string; academicYearId: string }, PlanningDocument>(
      this.settingsFunctionName,
      {
        operation: "GET_ACADEMIC_YEAR",
        payload: { tenantId, academicYearId },
      },
    );
  }

  listAcademicYears(tenantId: string) {
    return this.invoker.invoke<{ tenantId: string }, PlanningDocument[]>(
      this.settingsFunctionName,
      { operation: "LIST_ACADEMIC_YEARS", payload: { tenantId } },
    );
  }

  listCampuses(tenantId: string) {
    return this.invoker.invoke<{ tenantId: string }, PlanningDocument[]>(
      this.settingsFunctionName,
      { operation: "LIST_CAMPUSES", payload: { tenantId } },
    );
  }
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

let singleton: PlanningReferenceReader | undefined;

export function planningReferenceReader() {
  if (singleton) return singleton;
  const env = runtimeEnv();
  const identityFunction = env.IDENTITY_FUNCTION_NAME?.trim();
  const settingsFunction = env.SETTINGS_FUNCTION_NAME?.trim();
  if (!identityFunction || !settingsFunction) {
    throw new Error("IDENTITY_FUNCTION_NAME and SETTINGS_FUNCTION_NAME are required");
  }
  return (singleton = new InternalPlanningReferenceReader(identityFunction, settingsFunction));
}
