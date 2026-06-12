"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecallTypesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental RecallTypes API */
class RecallTypesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'recalltypes';
    /** GET /recalltypes */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.RecallTypesService = RecallTypesService;
//# sourceMappingURL=RecallTypesService.js.map