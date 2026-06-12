"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsVerifiesService = void 0;
const BaseDomainService_1 = require("../base/BaseDomainService");
/** Open Dental InsVerifies API */
class InsVerifiesService extends BaseDomainService_1.BaseDomainService {
    resourcePath = 'insverifies';
    /** PUT /{id} */
    async update(id, body) {
        return this.updateRecord(id, body);
    }
}
exports.InsVerifiesService = InsVerifiesService;
//# sourceMappingURL=InsVerifiesService.js.map