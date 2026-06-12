"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Subscriptions API */
class SubscriptionsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'subscriptions';
    /** GET /subscriptions */
    async list(params) {
        return this.getList(params);
    }
    /** POST /subscriptions */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.SubscriptionsService = SubscriptionsService;
//# sourceMappingURL=SubscriptionsService.js.map