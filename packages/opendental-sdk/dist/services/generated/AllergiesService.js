"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllergiesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Allergies API */
class AllergiesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'allergies';
    /** GET /allergies */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /allergies */
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
exports.AllergiesService = AllergiesService;
//# sourceMappingURL=AllergiesService.js.map