"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Clinics API */
class ClinicsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'clinics';
    /** GET /clinics */
    async list(params) {
        return this.getList(params);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ClinicsService = ClinicsService;
//# sourceMappingURL=ClinicsService.js.map