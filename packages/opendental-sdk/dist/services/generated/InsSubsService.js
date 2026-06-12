"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsSubsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental InsSubs API */
class InsSubsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'inssubs';
    /** POST /inssubs */
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
exports.InsSubsService = InsSubsService;
//# sourceMappingURL=InsSubsService.js.map