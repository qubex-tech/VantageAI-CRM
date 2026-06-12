"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtransMessageTextsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental EtransMessageTexts API */
class EtransMessageTextsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'etransmessagetexts';
    /** GET /etransmessagetexts */
    async list(params) {
        return this.getList(params);
    }
}
exports.EtransMessageTextsService = EtransMessageTextsService;
//# sourceMappingURL=EtransMessageTextsService.js.map