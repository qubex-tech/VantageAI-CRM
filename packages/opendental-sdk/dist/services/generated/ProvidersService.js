"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidersService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Providers API */
class ProvidersService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'providers';
    /** GET /providers */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /providers */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ProvidersService = ProvidersService;
//# sourceMappingURL=ProvidersService.js.map