"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeEnquiryUseCase = closeEnquiryUseCase;
const enquiry_service_1 = require("../enquiry.service");
function closeEnquiryUseCase(id, context, deps) {
    return (0, enquiry_service_1.closeEnquiry)(id, context, deps);
}
