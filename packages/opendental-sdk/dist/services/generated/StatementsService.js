"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatementsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Statements API */
class StatementsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'statements';
    /** GET /statements */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /statements */
    async create(body) {
        return this.createRecord(body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
}
exports.StatementsService = StatementsService;
//# sourceMappingURL=StatementsService.js.map