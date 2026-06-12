"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatPlansService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental TreatPlans API */
class TreatPlansService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'treatplans';
    /** GET /treatplans */
    async list(params) {
        return this.getList(params);
    }
    /** POST /treatplans */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /saved */
    async createSaved(body) {
        return this.postAction('saved', body);
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
exports.TreatPlansService = TreatPlansService;
//# sourceMappingURL=TreatPlansService.js.map