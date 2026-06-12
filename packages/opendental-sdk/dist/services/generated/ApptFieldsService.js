"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApptFieldsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ApptFields API */
class ApptFieldsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'apptfields';
    /** GET /apptfields */
    async list(params) {
        return this.getList(params);
    }
    /** POST /apptfields */
    async create(body) {
        return this.createRecord(body);
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
exports.ApptFieldsService = ApptFieldsService;
//# sourceMappingURL=ApptFieldsService.js.map