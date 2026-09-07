import { getMongoConnection } from "@school-erp/mongodb";

const connection = await getMongoConnection(process.env);
const settingsDb = connection.client.db(connection.dbName);
const issuances = settingsDb.collection("settings_number_issuances");

try {
  const indexes = await issuances.indexes();
  const obsoleteIndex = indexes.find(
    (index) =>
      index.unique === true &&
      Object.keys(index.key).length === 2 &&
      index.key.tenantId === 1 &&
      index.key.number === 1,
  );

  await issuances.createIndex(
    { tenantId: 1, counterKey: 1, number: 1 },
    { unique: true, name: "uq_number_issuance_scope" },
  );

  if (obsoleteIndex) {
    await issuances.dropIndex(obsoleteIndex.name);
  }

  console.log(
    JSON.stringify({
      created: "uq_number_issuance_scope",
      removed: obsoleteIndex?.name ?? null,
    }),
  );
} finally {
  await connection.client.close();
}
