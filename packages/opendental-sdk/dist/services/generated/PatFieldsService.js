"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatFieldsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PatFields API */
class PatFieldsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'patfields';
    /** GET /patfields */
    async list(params) {
        return this.getList(params);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.PatFieldsService = PatFieldsService;
//# sourceMappingURL=PatFieldsService.js.map