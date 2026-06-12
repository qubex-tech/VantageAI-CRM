"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Schedules API */
class SchedulesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'schedules';
    /** GET /schedules */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.SchedulesService = SchedulesService;
//# sourceMappingURL=SchedulesService.js.map