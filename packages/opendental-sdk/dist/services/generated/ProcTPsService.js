"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcTPsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ProcTPs API */
class ProcTPsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'proctps';
    /** GET /proctps */
    async list(params) {
        return this.getList(params);
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
exports.ProcTPsService = ProcTPsService;
//# sourceMappingURL=ProcTPsService.js.map