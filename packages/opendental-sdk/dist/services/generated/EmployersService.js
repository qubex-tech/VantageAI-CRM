"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployersService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Employers API */
class EmployersService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'employers';
    /** GET /employers */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /employers */
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
exports.EmployersService = EmployersService;
//# sourceMappingURL=EmployersService.js.map