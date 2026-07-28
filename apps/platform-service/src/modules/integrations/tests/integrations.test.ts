import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlatformIntegrationRepository } from "../integrations.repository";
import {
  listPlatformIntegrations,
  setPlatformIntegration,
} from "../integrations.service";
const context: RequestContext = {
  requestId: "req",
  path: "graphql",
  method: "POST",
  headers: {},
  query: {},
  params: {},
  body: undefined,
  authContext: {
    source: "request",
    authenticatedAt: new Date(),
    user: {
      id: "admin",
      role: "SUPER_ADMIN",
      permissions: [
        "platform.integrations.read",
        "platform.integrations.manage",
      ],
      source: "request",
    },
  },
};
test("integration configuration stores a secret reference and never a secret value", async () => {
  const repository = new InMemoryPlatformIntegrationRepository();
  await setPlatformIntegration(
    {
      code: "EMAIL",
      status: "CONFIGURED",
      secretReference:
        "arn:aws:secretsmanager:ap-south-1:123456789012:secret:email",
      settings: { configurationSet: "erp-email-dev" },
    },
    context,
    { repository },
  );
  const records = await listPlatformIntegrations(context, { repository });
  assert.equal(records[0]?.code, "EMAIL");
  assert.ok(
    (records[0]?.secretReference ?? "").startsWith("arn:aws:secretsmanager:"),
  );
});
