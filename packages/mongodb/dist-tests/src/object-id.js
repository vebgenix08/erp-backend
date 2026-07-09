"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObjectId = isObjectId;
exports.isObjectIdString = isObjectIdString;
exports.toObjectId = toObjectId;
exports.toObjectIdString = toObjectIdString;
exports.tryObjectId = tryObjectId;
const mongodb_1 = require("mongodb");
const errors_1 = require("@school-erp/errors");
function isObjectId(value) {
    return value instanceof mongodb_1.ObjectId;
}
function isObjectIdString(value) {
    return typeof value === "string" && mongodb_1.ObjectId.isValid(value);
}
function toObjectId(value) {
    if (value instanceof mongodb_1.ObjectId) {
        return value;
    }
    if (!mongodb_1.ObjectId.isValid(value)) {
        throw new errors_1.BadRequestError("Invalid object id");
    }
    return new mongodb_1.ObjectId(value);
}
function toObjectIdString(value) {
    return value instanceof mongodb_1.ObjectId ? value.toHexString() : toObjectId(value).toHexString();
}
function tryObjectId(value) {
    return isObjectId(value) ? value : isObjectIdString(value) ? new mongodb_1.ObjectId(value) : null;
}
