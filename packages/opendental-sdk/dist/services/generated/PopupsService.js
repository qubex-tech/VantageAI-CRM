"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopupsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Popups API */
class PopupsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'popups';
    /** GET /popups */
    async list(params) {
        return this.getList(params);
    }
    /** POST /popups */
    async create(body) {
        return this.createRecord(body);
    }
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.PopupsService = PopupsService;
//# sourceMappingURL=PopupsService.js.map