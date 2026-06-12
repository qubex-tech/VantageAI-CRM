"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmaciesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Pharmacies API */
class PharmaciesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'pharmacies';
    /** GET /pharmacies */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
}
exports.PharmaciesService = PharmaciesService;
//# sourceMappingURL=PharmaciesService.js.map