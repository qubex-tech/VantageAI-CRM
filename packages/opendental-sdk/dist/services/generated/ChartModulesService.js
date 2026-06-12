"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartModulesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental ChartModules API */
class ChartModulesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'chartmodules';
    /** GET /chartmodules/prognotes */
    async getProgNotes(params) {
        return this.getSubResource('prognotes', params);
    }
    /** GET /chartmodules/patientinfo */
    async getPatientInfo(params) {
        return this.getSubResource('patientinfo', params);
    }
    /** GET /chartmodules/plannedappts */
    async getPlannedAppts(params) {
        return this.getSubResource('plannedappts', params);
    }
}
exports.ChartModulesService = ChartModulesService;
//# sourceMappingURL=ChartModulesService.js.map