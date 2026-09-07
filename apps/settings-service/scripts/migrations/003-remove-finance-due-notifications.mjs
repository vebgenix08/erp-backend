import { getMongoConnection } from "@school-erp/mongodb";

const environment = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "dev";
if (environment !== "dev") {
  throw new Error("This migration is restricted to the development environment");
}

const connection = await getMongoConnection(process.env);
try {
  const database = connection.client.db(connection.dbName);
  const result = await database
    .collection("notification_policies")
    .updateMany({}, { $pull: { events: { event: { $in: ["FEE_DUE", "FEE_OVERDUE"] } } } });
  console.log(JSON.stringify({ migratedNotificationPolicies: result.modifiedCount }));
} finally {
  await connection.client.close();
}
