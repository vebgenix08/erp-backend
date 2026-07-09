"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toInstitutionProfileView = toInstitutionProfileView;
function toInstitutionProfileView(record) {
    return record ? { ...record } : null;
}
