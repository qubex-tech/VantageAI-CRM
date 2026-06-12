"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatPlanAttachesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental TreatPlanAttaches API */
class TreatPlanAttachesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'treatplanattaches';
    /** GET /treatplanattaches */
    async list(params) {
        return this.getList(params);
    }
}
exports.TreatPlanAttachesService = TreatPlanAttachesService;
//# sourceMappingURL=TreatPlanAttachesService.js.map