"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimFormsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ClaimForms API */
class ClaimFormsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'claimforms';
    /** GET /claimforms */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.ClaimFormsService = ClaimFormsService;
//# sourceMappingURL=ClaimFormsService.js.map