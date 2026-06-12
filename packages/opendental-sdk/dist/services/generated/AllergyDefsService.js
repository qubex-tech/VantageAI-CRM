"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllergyDefsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental AllergyDefs API */
class AllergyDefsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'allergydefs';
    /** GET /allergydefs */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /allergydefs */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.AllergyDefsService = AllergyDefsService;
//# sourceMappingURL=AllergyDefsService.js.map