"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferencesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Preferences API */
class PreferencesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'preferences';
    /** GET /preferences */
    async list(params) {
        return this.getList(params);
    }
}
exports.PreferencesService = PreferencesService;
//# sourceMappingURL=PreferencesService.js.map