"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Payments API */
class PaymentsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'payments';
    /** GET /payments */
    async list(params) {
        return this.getList(params);
    }
    /** POST /payments */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /refund */
    async createRefund(body) {
        return this.postAction('refund', body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/partial */
    async updatePartial(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.PaymentsService = PaymentsService;
//# sourceMappingURL=PaymentsService.js.map