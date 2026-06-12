"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatRestrictionsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PatRestrictions API */
class PatRestrictionsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'patrestrictions';
    /** GET /patrestrictions */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /patrestrictions */
    async create(body) {
        return this.createRecord(body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
}
exports.PatRestrictionsService = PatRestrictionsService;
//# sourceMappingURL=PatRestrictionsService.js.map