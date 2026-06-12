"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FamilyModulesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental FamilyModules API */
class FamilyModulesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'familymodules';
    /** GET /familymodules/insurance */
    async getInsurance(params) {
        return this.getSubResource('insurance', params);
    }
}
exports.FamilyModulesService = FamilyModulesService;
//# sourceMappingURL=FamilyModulesService.js.map