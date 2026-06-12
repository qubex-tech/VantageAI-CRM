"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatoriesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Operatories API */
class OperatoriesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'operatories';
    /** GET /operatories */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.OperatoriesService = OperatoriesService;
//# sourceMappingURL=OperatoriesService.js.map