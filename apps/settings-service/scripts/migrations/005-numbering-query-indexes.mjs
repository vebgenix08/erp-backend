import { getMongoConnection } from "@school-erp/mongodb";

const connection = await getMongoConnection(process.env);
const db = connection.client.db(connection.dbName);

try {
  await Promise.all([
    db
      .collection("settings_numbering_policies")
      .createIndex({ tenantId: 1, stream: 1 }, { unique: true }),
    db
      .collection("settings_numbering_counters")
      .createIndex({ tenantId: 1, stream: 1, scopeKey: 1, resetKey: 1 }, { unique: true }),
    db
      .collection("settings_number_issuances")
      .createIndex(
        { tenantId: 1, stream: 1, idempotencyKey: 1 },
        { unique: true, name: "uq_number_issuance_idempotency" },
      ),
    db
      .collection("settings_number_issuances")
      .createIndex(
        { tenantId: 1, counterKey: 1, number: 1 },
        { unique: true, name: "uq_number_issuance_scope" },
      ),
  ]);
  console.log(JSON.stringify({ migrated: "numbering-query-indexes", indexCount: 4 }));
} finally {
  await connection.client.close();
}
