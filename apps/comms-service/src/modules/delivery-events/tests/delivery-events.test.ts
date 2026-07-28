import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEmailDeliveryEventRepository } from "../delivery-events.repository";
import { listSesDeliveryEvents, recordSesDeliveryEvent } from "../delivery-events.service";
test("SES delivery events are normalized and idempotent", async () => {
  const repository = new InMemoryEmailDeliveryEventRepository();
  const event = {
    id: "evt-1",
    time: "2026-07-14T10:00:00.000Z",
    "detail-type": "Email Delivered",
    detail: {
      mail: { messageId: "ses-1", destination: ["admin@example.com"] },
    },
  };
  const first = await recordSesDeliveryEvent(event, repository);
  const repeated = await recordSesDeliveryEvent(event, repository);
  assert.equal(first.eventType, "DELIVERY");
  assert.deepEqual(first.recipients, ["admin@example.com"]);
  assert.equal(first, repeated);
  const history = await listSesDeliveryEvents("admin@example.com", repository);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.messageId, "ses-1");
});
