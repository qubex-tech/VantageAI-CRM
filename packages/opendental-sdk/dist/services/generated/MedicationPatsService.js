"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationPatsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental MedicationPats API */
class MedicationPatsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'medicationpats';
    /** GET /medicationpats */
    async list(params) {
        return this.getList(params);
    }
    /** POST /medicationpats */
    async create(body) {
        return this.createRecord(body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
}
exports.MedicationPatsService = MedicationPatsService;
//# sourceMappingURL=MedicationPatsService.js.map