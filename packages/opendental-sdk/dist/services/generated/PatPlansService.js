"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatPlansService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PatPlans API */
class PatPlansService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'patplans';
    /** GET /patplans */
    async list(params) {
        return this.getList(params);
    }
    /** POST /patplans */
    async create(body) {
        return this.createRecord(body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
}
exports.PatPlansService = PatPlansService;
//# sourceMappingURL=PatPlansService.js.map