"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEnquiryUseCase = updateEnquiryUseCase;
const enquiry_service_1 = require("../enquiry.service");
function updateEnquiryUseCase(id, input, context, deps) {
    return (0, enquiry_service_1.updateEnquiry)(id, input, context, deps);
}
