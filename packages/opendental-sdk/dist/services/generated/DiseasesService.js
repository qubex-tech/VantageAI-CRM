"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiseasesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Diseases API */
class DiseasesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'diseases';
    /** GET /diseases */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /diseases */
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
exports.DiseasesService = DiseasesService;
//# sourceMappingURL=DiseasesService.js.map