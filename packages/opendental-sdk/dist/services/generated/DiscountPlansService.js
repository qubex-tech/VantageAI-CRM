"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountPlansService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental DiscountPlans API */
class DiscountPlansService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'discountplans';
    /** GET /discountplans */
    async list(params) {
        return this.getList(params);
    }
    /** POST /discountplans */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.DiscountPlansService = DiscountPlansService;
//# sourceMappingURL=DiscountPlansService.js.map