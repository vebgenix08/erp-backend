"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnquiryUseCase = getEnquiryUseCase;
const enquiry_service_1 = require("../enquiry.service");
function getEnquiryUseCase(id, context, deps) {
    return (0, enquiry_service_1.getEnquiry)(id, context, deps);
}
