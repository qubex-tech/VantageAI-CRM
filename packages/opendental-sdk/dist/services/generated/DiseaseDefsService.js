"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiseaseDefsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental DiseaseDefs API */
class DiseaseDefsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'diseasedefs';
    /** GET /diseasedefs */
    async list(params) {
        return this.getList(params);
    }
    /** GET /{id} */
    async get(id, params) {
        return this.getSingle(id, params);
    }
    /** POST /diseasedefs */
    async create(body) {
        return this.createRecord(body);
    }
}
exports.DiseaseDefsService = DiseaseDefsService;
//# sourceMappingURL=DiseaseDefsService.js.map