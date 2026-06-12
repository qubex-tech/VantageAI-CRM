"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatFieldDefsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PatFieldDefs API */
class PatFieldDefsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'patfielddefs';
    /** GET /patfielddefs */
    async list(params) {
        return this.getList(params);
    }
    /** POST /patfielddefs */
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
exports.PatFieldDefsService = PatFieldDefsService;
//# sourceMappingURL=PatFieldDefsService.js.map