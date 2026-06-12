"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimPaymentsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ClaimPayments API */
class ClaimPaymentsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'claimpayments';
    /** GET /claimpayments */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /claimpayments */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /batch */
    async createBatch(body) {
        return this.postAction('batch', body);
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
exports.ClaimPaymentsService = ClaimPaymentsService;
//# sourceMappingURL=ClaimPaymentsService.js.map