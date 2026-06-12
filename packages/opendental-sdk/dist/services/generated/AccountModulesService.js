"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountModulesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental AccountModules API */
class AccountModulesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'accountmodules';
    /** GET /accountmodules/aging */
    async getAging(params) {
        return this.getSubResource('aging', params);
    }
    /** GET /accountmodules/patientbalances */
    async getPatientBalances(params) {
        return this.getSubResource('patientbalances', params);
    }
    /** GET /accountmodules/servicedateview */
    async getServiceDateView(params) {
        return this.getSubResource('servicedateview', params);
    }
}
exports.AccountModulesService = AccountModulesService;
//# sourceMappingURL=AccountModulesService.js.map