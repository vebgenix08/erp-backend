"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
const connection_1 = require("./connection");
async function withTransaction(work, options = {}) {
    const client = options.client ?? (options.env ? await (0, connection_1.getMongoClient)(options.env) : null);
    if (!client) {
        return work(null, options.context);
    }
    const session = client.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session, options.context);
        });
        return result;
    }
    finally {
        await session.endSession();
    }
}
