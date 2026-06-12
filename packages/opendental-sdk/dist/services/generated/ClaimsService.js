"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Claims API */
class ClaimsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'claims';
    /** GET /claims */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /claims */
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
    /** PUT /{id}/status */
    async updateStatus(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/split */
    async split(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ClaimsService = ClaimsService;
//# sourceMappingURL=ClaimsService.js.map