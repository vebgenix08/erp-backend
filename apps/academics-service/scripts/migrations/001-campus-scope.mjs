import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { MongoClient } from "mongodb";

const secretId = process.env.MONGODB_SECRET_NAME?.trim();
if (!secretId) throw new Error("MONGODB_SECRET_NAME is required");
const region = process.env.AWS_REGION?.trim();
if (!region) throw new Error("AWS_REGION is required");
const rawPlan = process.env.CAMPUS_SCOPE_MIGRATION_JSON?.trim();
if (!rawPlan) {
  throw new Error(
    "CAMPUS_SCOPE_MIGRATION_JSON is required and must map each tenantId to one campusId",
  );
}
const campusByTenant = JSON.parse(rawPlan);
if (!campusByTenant || typeof campusByTenant !== "object" || Array.isArray(campusByTenant)) {
  throw new Error("CAMPUS_SCOPE_MIGRATION_JSON must be an object keyed by tenantId");
}

const result = await new SecretsManagerClient({ region }).send(
  new GetSecretValueCommand({ SecretId: secretId }),
);
if (!result.SecretString) throw new Error("MongoDB secret value is empty");
const trimmed = result.SecretString.trim();
const parsed =
  trimmed.startsWith("mongodb://") || trimmed.startsWith("mongodb+srv://")
    ? { uri: trimmed }
    : JSON.parse(trimmed);
const uri = parsed.uri ?? parsed.mongodbUri ?? parsed.MONGODB_URI;
if (typeof uri !== "string" || !uri.trim())
  throw new Error("MongoDB secret does not contain a URI");

const client = new MongoClient(uri);
await client.connect();
try {
  const databaseName = process.env.MONGODB_DB_NAME?.trim();
  if (!databaseName) throw new Error("MONGODB_DB_NAME is required");
  const db = client.db(databaseName);

  const modules = [
    ["academics_programs", "program", "PROG"],
    ["academics_classes", "class", "CLASS"],
    ["academics_sections", "section", "SEC"],
    ["academics_subjects", "subject", "SUB"],
  ];
  const sequenceCollection = db.collection("academics_sequences");
  for (const [collectionName, sequenceName, prefix] of modules) {
    const collection = db.collection(collectionName);
    const legacyTenants = await collection.distinct("tenantId", {
      $or: [{ campusId: { $exists: false } }, { campusId: null }, { campusId: "" }],
    });
    for (const tenantId of legacyTenants) {
      const campusId = campusByTenant[tenantId];
      if (typeof campusId !== "string" || !campusId.trim()) {
        throw new Error(`${collectionName}: explicit campus mapping is required for ${tenantId}`);
      }
      await collection.updateMany(
        { tenantId, $or: [{ campusId: { $exists: false } }, { campusId: null }, { campusId: "" }] },
        { $set: { campusId: campusId.trim() } },
      );
    }
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find(
      (index) => JSON.stringify(index.key) === JSON.stringify({ tenantId: 1, code: 1 }),
    );
    if (legacyIndex?.name) await collection.dropIndex(legacyIndex.name);
    await collection.createIndex({ tenantId: 1, campusId: 1, code: 1 }, { unique: true });

    const groups = await collection
      .aggregate([
        { $match: { campusId: { $type: "string" } } },
        {
          $group: {
            _id: { tenantId: "$tenantId", campusId: "$campusId" },
            codes: { $push: "$code" },
          },
        },
      ])
      .toArray();
    for (const group of groups) {
      const maximum = group.codes.reduce((value, code) => {
        const match = new RegExp(`^${prefix}-(\\d+)$`).exec(code);
        return Math.max(value, match ? Number(match[1]) : 0);
      }, 0);
      await sequenceCollection.updateOne(
        { _id: `${sequenceName}:${group._id.tenantId}:${group._id.campusId}` },
        { $max: { value: maximum } },
        { upsert: true },
      );
    }
  }
  console.log("Campus scope migration completed");
} finally {
  await client.close();
}
