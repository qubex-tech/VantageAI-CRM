"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountPlanSubsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental DiscountPlanSubs API */
class DiscountPlanSubsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'discountplansubs';
    /** GET /discountplansubs */
    async list(params) {
        return this.getList(params);
    }
    /** POST /discountplansubs */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
}
exports.DiscountPlanSubsService = DiscountPlanSubsService;
//# sourceMappingURL=DiscountPlanSubsService.js.map