"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Referrals API */
class ReferralsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'referrals';
    /** GET /referrals */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /referrals */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ReferralsService = ReferralsService;
//# sourceMappingURL=ReferralsService.js.map