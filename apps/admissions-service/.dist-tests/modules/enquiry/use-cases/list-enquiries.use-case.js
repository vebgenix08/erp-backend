"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEnquiriesUseCase = listEnquiriesUseCase;
const enquiry_service_1 = require("../enquiry.service");
function listEnquiriesUseCase(context, deps, filter) {
    return (0, enquiry_service_1.listEnquiries)(context, deps, filter);
}
