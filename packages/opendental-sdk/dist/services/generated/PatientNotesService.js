"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientNotesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PatientNotes API */
class PatientNotesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'patientnotes';
    /** GET /patientnotes */
    async list(params) {
        return this.getList(params);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.PatientNotesService = PatientNotesService;
//# sourceMappingURL=PatientNotesService.js.map