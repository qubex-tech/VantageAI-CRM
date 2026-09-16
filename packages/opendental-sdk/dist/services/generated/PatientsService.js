"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Patients API */
class PatientsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'patients';
    /** GET /patients */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** GET /patients/Simple — DateTStamp and other filters only work on this endpoint. */
    async getSimple(params) {
        return this.getSubResource('Simple', params);
    }
    /** POST /patients */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.PatientsService = PatientsService;
//# sourceMappingURL=PatientsService.js.map