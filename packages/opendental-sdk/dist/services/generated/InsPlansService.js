"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsPlansService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental InsPlans API */
class InsPlansService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'insplans';
    /** GET /insplans */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /insplans */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.InsPlansService = InsPlansService;
//# sourceMappingURL=InsPlansService.js.map