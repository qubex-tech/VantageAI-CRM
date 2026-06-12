"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerioExamsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PerioExams API */
class PerioExamsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'perioexams';
    /** GET /perioexams */
    async list(params) {
        return this.getList(params);
    }
    /** POST /perioexams */
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
exports.PerioExamsService = PerioExamsService;
//# sourceMappingURL=PerioExamsService.js.map