"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientRacesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental PatientRaces API */
class PatientRacesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'patientraces';
    /** GET /patientraces */
    async list(params) {
        return this.getList(params);
    }
}
exports.PatientRacesService = PatientRacesService;
//# sourceMappingURL=PatientRacesService.js.map