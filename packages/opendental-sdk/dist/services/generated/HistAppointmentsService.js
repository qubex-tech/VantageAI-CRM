"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistAppointmentsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental HistAppointments API */
class HistAppointmentsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'histappointments';
    /** GET /histappointments */
    async list(params) {
        return this.getList(params);
    }
}
exports.HistAppointmentsService = HistAppointmentsService;
//# sourceMappingURL=HistAppointmentsService.js.map