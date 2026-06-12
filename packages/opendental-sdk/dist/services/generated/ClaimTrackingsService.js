"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimTrackingsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ClaimTrackings API */
class ClaimTrackingsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'claimtrackings';
    /** GET /claimtrackings */
    async list(params) {
        return this.getList(params);
    }
    /** POST /claimtrackings */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.ClaimTrackingsService = ClaimTrackingsService;
//# sourceMappingURL=ClaimTrackingsService.js.map