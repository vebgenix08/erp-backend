import type { TenantStatus, TenantType, UserStatus } from "@school-erp/types";

export interface TenantFixture {
  id: string;
  clientRequestId: string;
  name: string;
  code: string;
  type: TenantType;
  status: TenantStatus;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  academicYearStartMonth?: number;
}

export interface UserFixture {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  status: UserStatus;
}

export type FixtureRecord<T> = T & Record<string, unknown>;

export function createTenantFixture(overrides: Partial<TenantFixture> = {}): FixtureRecord<TenantFixture> {
  return {
    id: "tenant_test_1",
    clientRequestId: "request_tenant_test_1",
    name: "Sample School",
    code: "SAMPLE-SCHOOL",
    type: "SCHOOL",
    status: "ACTIVE",
    contactEmail: "admin@sample-school.test",
    contactPhone: "+1 555 0100",
    address: "Sample Address",
    academicYearStartMonth: 6,
    ...overrides,
  };
}

export function createUserFixture(overrides: Partial<UserFixture> = {}): FixtureRecord<UserFixture> {
  return {
    id: "user_test_1",
    tenantId: "tenant_test_1",
    name: "Sample User",
    email: "user@sample.test",
    status: "ACTIVE",
    ...overrides,
  };
}
