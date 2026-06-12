"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClockEventsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ClockEvents API */
class ClockEventsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'clockevents';
    /** GET /clockevents */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.ClockEventsService = ClockEventsService;
//# sourceMappingURL=ClockEventsService.js.map