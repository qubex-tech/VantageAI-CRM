"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickPasteCatsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental QuickPasteCats API */
class QuickPasteCatsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'quickpastecats';
    /** GET /quickpastecats */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.QuickPasteCatsService = QuickPasteCatsService;
//# sourceMappingURL=QuickPasteCatsService.js.map