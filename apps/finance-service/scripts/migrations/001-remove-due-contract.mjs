import { MongoClient } from "mongodb";

const environment = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "dev";
if (environment !== "dev") {
  throw new Error("This migration is restricted to the development environment");
}

const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is required");

const client = new MongoClient(uri);
await client.connect();

try {
  const db = client.db(process.env.MONGODB_DB_NAME?.trim() || "finance-service_dev");
  const configuration = db.collection("finance_configuration");
  const orders = db.collection("finance_fee_orders");
  const generalCharges = db.collection("finance_general_charges");
  const settings = client
    .db(process.env.SETTINGS_MONGODB_DB_NAME?.trim() || "settings-service_dev")
    .collection("notification_policies");

  const schedules = await configuration
    .find({ kind: "SCHEDULE" })
    .project({
      _id: 1,
      "record.code": 1,
      "record.name": 1,
      "record.mode": 1,
      "record.pattern": 1,
    })
    .toArray();

  let migratedSchedules = 0;
  const scheduleNames = new Map();
  for (const schedule of schedules) {
    const legacyMode = schedule.record?.mode;
    const pattern =
      schedule.record?.code === "FS-0001"
        ? "ANNUAL"
        :
      schedule.record?.pattern ??
      (legacyMode === "FULL_PAYMENT" ? "ANNUAL" : "PERIODIC");
    const legacyName = schedule.record?.name ?? "Fee collection";
    const cleanedName = legacyName
      .replace(/full payment/gi, "annual collection")
      .replace(/quarterly schedule/gi, "periodic collection")
      .replace(/three term schedule/gi, "periodic collection")
      .replace(/half-yearly schedule/gi, "periodic collection")
      .replace(/six installment schedule/gi, "periodic collection")
      .replace(/installments?/gi, "collection");
    const normalizedName =
      cleanedName === "Fee collection"
        ? `${pattern === "ANNUAL" ? "Annual" : "Periodic"} collection (${schedule.record?.code ?? schedule._id})`
        : cleanedName;
    scheduleNames.set(String(schedule._id), normalizedName);
    const result = await configuration.updateOne(
      { _id: schedule._id, kind: "SCHEDULE" },
      {
        $set: { "record.pattern": pattern, "record.name": normalizedName },
        $unset: {
          "record.mode": "",
          "record.graceDays": "",
          "record.slots": "",
        },
      },
    );
    migratedSchedules += result.modifiedCount;
  }

  const feeOrders = await orders.find({}).toArray();
  let migratedOrders = 0;
  for (const document of feeOrders) {
    const charges = (document.record?.charges ?? []).map((charge, index) => {
      const {
        dueDate: _dueDate,
        scheduleSlotId: _scheduleSlotId,
        scheduleLabel: _scheduleLabel,
        ...rest
      } = charge;
      return { ...rest, sequence: charge.sequence ?? index + 1 };
    });
    const result = await orders.updateOne(
      { _id: document._id },
      {
        $set: {
          "record.charges": charges,
          "record.scheduleName":
            scheduleNames.get(document.record?.scheduleId) ??
            document.record?.scheduleName
              ?.replace(/full payment/gi, "annual collection")
              .replace(/quarterly schedule/gi, "periodic collection")
              .replace(/three term schedule/gi, "periodic collection")
              .replace(/half-yearly schedule/gi, "periodic collection")
              .replace(/six installment schedule/gi, "periodic collection")
              .replace(/installments?/gi, "collection") ??
            "Fee collection",
        },
        $unset: { "record.graceDays": "" },
      },
    );
    migratedOrders += result.modifiedCount;
  }

  const chargeResult = await generalCharges.updateMany(
    {},
    { $unset: { dueDate: "" } },
  );
  const policyResult = await settings.updateMany(
    {},
    { $pull: { events: { event: { $in: ["FEE_DUE", "FEE_OVERDUE"] } } } },
  );

  console.log(
    JSON.stringify({
      environment,
      migratedSchedules,
      migratedOrders,
      migratedGeneralCharges: chargeResult.modifiedCount,
      migratedNotificationPolicies: policyResult.modifiedCount,
    }),
  );
} finally {
  await client.close();
}
