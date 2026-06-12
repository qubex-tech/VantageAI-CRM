"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepositsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Deposits API */
class DepositsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'deposits';
    /** GET /deposits */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /deposits */
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
exports.DepositsService = DepositsService;
//# sourceMappingURL=DepositsService.js.map