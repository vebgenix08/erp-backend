"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAcademicYearView = toAcademicYearView;
function toAcademicYearView(record) {
    return record ? { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt), activatedAt: record.activatedAt ? new Date(record.activatedAt) : undefined, deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined } : null;
}
