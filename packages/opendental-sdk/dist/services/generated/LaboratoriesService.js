"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaboratoriesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Laboratories API */
class LaboratoriesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'laboratories';
    /** GET /laboratories */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /laboratories */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.LaboratoriesService = LaboratoriesService;
//# sourceMappingURL=LaboratoriesService.js.map