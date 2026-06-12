"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApptFieldDefsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ApptFieldDefs API */
class ApptFieldDefsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'apptfielddefs';
    /** GET /apptfielddefs */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /apptfielddefs */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ApptFieldDefsService = ApptFieldDefsService;
//# sourceMappingURL=ApptFieldDefsService.js.map