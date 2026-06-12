"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityPermsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental SecurityPerms API */
class SecurityPermsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'securityperms';
    /** GET /securityperms */
    async list(params) {
        return this.getList(params);
    }
}
exports.SecurityPermsService = SecurityPermsService;
//# sourceMappingURL=SecurityPermsService.js.map