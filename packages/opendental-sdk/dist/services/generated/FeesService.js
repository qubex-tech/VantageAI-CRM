"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Fees API */
class FeesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'fees';
    /** GET /fees */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /fees */
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
exports.FeesService = FeesService;
//# sourceMappingURL=FeesService.js.map