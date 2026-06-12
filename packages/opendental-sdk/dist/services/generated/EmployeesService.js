"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Employees API */
class EmployeesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'employees';
    /** GET /employees */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /employees */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.EmployeesService = EmployeesService;
//# sourceMappingURL=EmployeesService.js.map