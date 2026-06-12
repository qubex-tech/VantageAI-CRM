"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToothInitialsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ToothInitials API */
class ToothInitialsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'toothinitials';
    /** GET /toothinitials */
    async list(params) {
        return this.getList(params);
    }
    /** POST /toothinitials */
    async create(body) {
        return this.createRecord(body);
    }
    /** DELETE /{id} */
    async delete(id) {
        return this.removeRecord(id);
    }
}
exports.ToothInitialsService = ToothInitialsService;
//# sourceMappingURL=ToothInitialsService.js.map