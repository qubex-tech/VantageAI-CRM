"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentTypesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental AppointmentTypes API */
class AppointmentTypesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'appointmenttypes';
    /** GET /appointmenttypes */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.AppointmentTypesService = AppointmentTypesService;
//# sourceMappingURL=AppointmentTypesService.js.map