"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPlansService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PayPlans API */
class PayPlansService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'payplans';
    /** GET /payplans */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /payplans */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /dynamic */
    async createDynamic(body) {
        return this.postAction('dynamic', body);
    }
    /** PUT /{id}/dynamic */
    async updateDynamic(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.PayPlansService = PayPlansService;
//# sourceMappingURL=PayPlansService.js.map