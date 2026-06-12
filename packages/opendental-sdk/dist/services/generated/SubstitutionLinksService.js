"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubstitutionLinksService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental SubstitutionLinks API */
class SubstitutionLinksService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'substitutionlinks';
    /** GET /substitutionlinks */
    async list(params) {
        return this.getList(params);
    }
    /** POST /substitutionlinks */
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
exports.SubstitutionLinksService = SubstitutionLinksService;
//# sourceMappingURL=SubstitutionLinksService.js.map