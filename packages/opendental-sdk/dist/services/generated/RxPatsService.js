"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RxPatsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental RxPats API */
class RxPatsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'rxpats';
    /** GET /rxpats */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.RxPatsService = RxPatsService;
//# sourceMappingURL=RxPatsService.js.map