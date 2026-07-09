"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCampusView = toCampusView;
function toCampusView(record) {
    return record ? { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) } : null;
}
