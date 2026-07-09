"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAdmissionsHttp = handleAdmissionsHttp;
exports.createAdmissionsHttpHandler = createAdmissionsHttpHandler;
const routes_1 = require("../routes");
const defaultRouter = (0, routes_1.createAdmissionsRouter)();
async function handleAdmissionsHttp(request) {
    return defaultRouter.handle(request);
}
function createAdmissionsHttpHandler(deps = {}) {
    const router = (0, routes_1.createAdmissionsRouter)(deps);
    return (request) => router.handle(request);
}
