import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_NOTIFICATION_EVENTS } from "../notification-policy.model";
import { InMemoryNotificationPolicyRepository, defaultNotificationPolicy } from "../notification-policy.repository";
test("default policy enables email but not sms", () => { const policy = defaultNotificationPolicy("tenant_1"); assert.equal(policy.emailEnabled, true); assert.equal(policy.smsEnabled, false); assert.equal(policy.events.length, 6); });
test("notification policy remains tenant isolated", async () => { const repository = new InMemoryNotificationPolicyRepository(); await repository.save("tenant_1", { emailEnabled: true, smsEnabled: false, timezone: "Asia/Kolkata", adminEmail: "admin@example.com", events: DEFAULT_NOTIFICATION_EVENTS }); assert.equal((await repository.get("tenant_1"))?.adminEmail, "admin@example.com"); assert.equal(await repository.get("tenant_2"), null); });
