"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerioMeasuresService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PerioMeasures API */
class PerioMeasuresService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'periomeasures';
    /** GET /periomeasures */
    async list(params) {
        return this.getList(params);
    }
    /** POST /periomeasures */
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
exports.PerioMeasuresService = PerioMeasuresService;
//# sourceMappingURL=PerioMeasuresService.js.map