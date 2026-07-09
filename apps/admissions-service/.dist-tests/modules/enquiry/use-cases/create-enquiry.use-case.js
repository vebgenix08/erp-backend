"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnquiryUseCase = createEnquiryUseCase;
const enquiry_service_1 = require("../enquiry.service");
function createEnquiryUseCase(input, context, deps) {
    return (0, enquiry_service_1.createEnquiry)(input, context, deps);
}
