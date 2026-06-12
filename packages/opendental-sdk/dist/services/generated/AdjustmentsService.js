"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdjustmentsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Adjustments API */
class AdjustmentsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'adjustments';
    /** GET /adjustments */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /adjustments */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.AdjustmentsService = AdjustmentsService;
//# sourceMappingURL=AdjustmentsService.js.map