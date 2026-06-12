"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtranssService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Etranss API */
class EtranssService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'etranss';
    /** GET /etranss */
    async list(params) {
        return this.getList(params);
    }
}
exports.EtranssService = EtranssService;
//# sourceMappingURL=EtranssService.js.map