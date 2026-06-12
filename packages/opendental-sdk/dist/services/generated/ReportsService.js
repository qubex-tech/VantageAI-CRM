"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Reports API */
class ReportsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'reports';
    /** GET /reports/aging */
    async getAging(params) {
        return this.getSubResource('aging', params);
    }
    /** GET /reports/financecharges */
    async getFinanceCharges(params) {
        return this.getSubResource('financecharges', params);
    }
}
exports.ReportsService = ReportsService;
//# sourceMappingURL=ReportsService.js.map