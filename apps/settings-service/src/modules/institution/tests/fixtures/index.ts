import type { InstitutionProfileInput } from "../../institution.model";

export function createInstitutionFixture(overrides: Partial<InstitutionProfileInput> = {}): InstitutionProfileInput {
  return {
    name: "Sample Institution",
    shortName: "Sample",
    contactEmail: "admin@sample.test",
    contactPhone: "+1 555 0100",
    address: "Sample Address",
    logoUrl: "https://example.com/logo.png",
    ...overrides,
  };
}
