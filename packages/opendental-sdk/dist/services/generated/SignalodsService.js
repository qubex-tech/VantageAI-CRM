"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalodsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Signalods API */
class SignalodsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'signalods';
    /** GET /signalods */
    async list(params) {
        return this.getList(params);
    }
}
exports.SignalodsService = SignalodsService;
//# sourceMappingURL=SignalodsService.js.map