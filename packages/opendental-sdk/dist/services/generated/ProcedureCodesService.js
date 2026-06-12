"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcedureCodesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ProcedureCodes API */
class ProcedureCodesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'procedurecodes';
    /** GET /procedurecodes */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /procedurecodes */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ProcedureCodesService = ProcedureCodesService;
//# sourceMappingURL=ProcedureCodesService.js.map