"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenefitsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Benefits API */
class BenefitsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'benefits';
    /** GET /benefits */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /benefits */
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
exports.BenefitsService = BenefitsService;
//# sourceMappingURL=BenefitsService.js.map