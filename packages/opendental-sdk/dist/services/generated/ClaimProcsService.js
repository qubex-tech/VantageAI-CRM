"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimProcsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ClaimProcs API */
class ClaimProcsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'claimprocs';
    /** GET /claimprocs */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /insadjust */
    async createInsAdjust(body) {
        return this.postAction('insadjust', body);
    }
    /** PUT /insadjust */
    async updateInsAdjust(body) {
        return this.updateSubResource('insadjust', body);
    }
    /** POST /supplemental */
    async createSupplemental(body) {
        return this.postAction('supplemental', body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ClaimProcsService = ClaimProcsService;
//# sourceMappingURL=ClaimProcsService.js.map