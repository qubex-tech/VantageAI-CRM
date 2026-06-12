"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecallsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Recalls API */
class RecallsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'recalls';
    /** GET /recalls */
    async list(params) {
        return this.getList(params);
    }
    /** GET /list */
    async getList2(params) {
        return this.getSubResource('list', params);
    }
    /** POST /recalls */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/status */
    async updateStatus(id, body) {
        return this.updateRecord(id, body);
    }
    /** PUT /{id}/switchtype */
    async switchType(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.RecallsService = RecallsService;
//# sourceMappingURL=RecallsService.js.map