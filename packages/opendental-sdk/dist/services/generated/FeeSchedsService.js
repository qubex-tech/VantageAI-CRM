"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeSchedsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental FeeScheds API */
class FeeSchedsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'feescheds';
    /** GET /feescheds */
    async list(params) {
        return this.getList(params);
    }
    /** POST /feescheds */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.FeeSchedsService = FeeSchedsService;
//# sourceMappingURL=FeeSchedsService.js.map