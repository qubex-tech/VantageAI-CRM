"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPlanLinksService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PayPlanLinks API */
class PayPlanLinksService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'payplanlinks';
    /** GET /payplanlinks */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /payplanlinks */
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
exports.PayPlanLinksService = PayPlanLinksService;
//# sourceMappingURL=PayPlanLinksService.js.map