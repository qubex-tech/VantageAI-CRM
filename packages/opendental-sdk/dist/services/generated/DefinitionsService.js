"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionsService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental Definitions API */
class DefinitionsService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'definitions';
    /** GET /definitions */
    async list(params) {
        return this.getList(params);
    }
    /** POST /definitions */
    async create(body) {
        return this.createRecord(body);
    }
}
exports.DefinitionsService = DefinitionsService;
//# sourceMappingURL=DefinitionsService.js.map