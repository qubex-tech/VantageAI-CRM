"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityLogsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental SecurityLogs API */
class SecurityLogsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'securitylogs';
    /** GET /securitylogs */
    async list(params) {
        return this.getList(params);
    }
}
exports.SecurityLogsService = SecurityLogsService;
//# sourceMappingURL=SecurityLogsService.js.map