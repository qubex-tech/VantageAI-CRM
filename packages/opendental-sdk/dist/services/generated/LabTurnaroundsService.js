"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabTurnaroundsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental LabTurnarounds API */
class LabTurnaroundsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'labturnarounds';
    /** GET /labturnarounds */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /labturnarounds */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.LabTurnaroundsService = LabTurnaroundsService;
//# sourceMappingURL=LabTurnaroundsService.js.map