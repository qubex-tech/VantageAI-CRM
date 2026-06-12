"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CovCatsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental CovCats API */
class CovCatsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'covcats';
    /** GET /covcats */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /covcats */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.CovCatsService = CovCatsService;
//# sourceMappingURL=CovCatsService.js.map