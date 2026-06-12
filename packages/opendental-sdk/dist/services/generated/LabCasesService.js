"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabCasesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental LabCases API */
class LabCasesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'labcases';
    /** GET /labcases */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /labcases */
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
exports.LabCasesService = LabCasesService;
//# sourceMappingURL=LabCasesService.js.map