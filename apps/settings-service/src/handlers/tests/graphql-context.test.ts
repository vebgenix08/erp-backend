import assert from "node:assert/strict";
import test from "node:test";
import { createSettingsGraphqlContext } from "../graphql";

test("settings GraphQL context derives tenant and setup permissions from verified claims", () => {
  const context = createSettingsGraphqlContext({
    info: { fieldName: "campuses" },
    identity: {
      sub: "user_1",
      claims: {
        email: "admin@example.com",
        "custom:tenantId": "tenant_A7K2Q9",
        "cognito:groups": ["TENANT_ADMIN"],
      },
    },
  });
  assert.equal(context.tenantContext?.tenantId, "tenant_A7K2Q9");
  assert.equal(context.authContext?.user?.role, "TENANT_ADMIN");
  assert.equal(context.authContext?.user?.permissions.includes("settings.campuses.create"), true);
});

test("settings GraphQL context rejects identities without tenant membership", () => {
  let rejected = false;
  try {
    createSettingsGraphqlContext({
      info: { fieldName: "institutionProfile" },
      identity: { sub: "user_1", claims: { "cognito:groups": ["TENANT_ADMIN"] } },
    });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true);
});
