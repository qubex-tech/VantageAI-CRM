"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleOpsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ScheduleOps API */
class ScheduleOpsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'scheduleops';
    /** GET /scheduleops */
    async list(params) {
        return this.getList(params);
    }
}
exports.ScheduleOpsService = ScheduleOpsService;
//# sourceMappingURL=ScheduleOpsService.js.map