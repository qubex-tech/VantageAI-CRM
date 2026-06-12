"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPlanChargesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PayPlanCharges API */
class PayPlanChargesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'payplancharges';
    /** GET /payplancharges */
    async list(params) {
        return this.getList(params);
    }
}
exports.PayPlanChargesService = PayPlanChargesService;
//# sourceMappingURL=PayPlanChargesService.js.map