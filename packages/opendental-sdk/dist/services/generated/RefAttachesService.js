"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefAttachesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental RefAttaches API */
class RefAttachesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'refattaches';
    /** GET /refattaches */
    async list(params) {
        return this.getList(params);
    }
    /** POST /refattaches */
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
exports.RefAttachesService = RefAttachesService;
//# sourceMappingURL=RefAttachesService.js.map