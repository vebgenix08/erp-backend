"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.admissionsServiceRouter = void 0;
exports.createAdmissionsRouter = createAdmissionsRouter;
const api_1 = require("@school-erp/api");
const enquiry_routes_1 = require("../modules/enquiry/enquiry.routes");
function createAdmissionsRouter(deps = {}) {
    const router = (0, api_1.createRouter)();
    router.use((0, api_1.tenantMiddleware)());
    router.use((0, api_1.authMiddleware)());
    (0, enquiry_routes_1.createEnquiryRouter)(router, deps);
    return router;
}
exports.admissionsServiceRouter = createAdmissionsRouter();
