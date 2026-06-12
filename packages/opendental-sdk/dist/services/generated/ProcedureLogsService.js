"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcedureLogsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ProcedureLogs API */
class ProcedureLogsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'procedurelogs';
    /** GET /procedurelogs */
    async list(params) {
        return this.getList(params);
    }
    /** GET /insurancehistory */
    async getInsuranceHistory(params) {
        return this.getSubResource('insurancehistory', params);
    }
    /** POST /procedurelogs */
    async create(body) {
        return this.createRecord(body);
    }
    /** POST /insurancehistory */
    async createInsuranceHistory(body) {
        return this.postAction('insurancehistory', body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
    /** POST /groupnote */
    async createGroupNote(body) {
        return this.postAction('groupnote', body);
    }
    /** PUT /groupnote */
    async updateGroupNote(body) {
        return this.updateSubResource('groupnote', body);
    }
    /** DELETE /groupnote */
    async deleteGroupNote() {
        return this.removeSubResource('groupnote');
    }
}
exports.ProcedureLogsService = ProcedureLogsService;
//# sourceMappingURL=ProcedureLogsService.js.map