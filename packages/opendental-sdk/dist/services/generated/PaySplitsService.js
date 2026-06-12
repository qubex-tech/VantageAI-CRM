"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaySplitsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PaySplits API */
class PaySplitsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'paysplits';
    /** GET /paysplits */
    async list(params) {
        return this.getList(params);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.PaySplitsService = PaySplitsService;
//# sourceMappingURL=PaySplitsService.js.map