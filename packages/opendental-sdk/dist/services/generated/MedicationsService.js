"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Medications API */
class MedicationsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'medications';
    /** GET /medications */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /medications */
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
exports.MedicationsService = MedicationsService;
//# sourceMappingURL=MedicationsService.js.map