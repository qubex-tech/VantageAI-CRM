"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EhrPatientsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental EhrPatients API */
class EhrPatientsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'ehrpatients';
    /** GET /ehrpatients */
    async list(params) {
        return this.getList(params);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.EhrPatientsService = EhrPatientsService;
//# sourceMappingURL=EhrPatientsService.js.map